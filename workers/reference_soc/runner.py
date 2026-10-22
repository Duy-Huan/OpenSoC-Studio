"""Actual PicoRV32 RTL/firmware regression for one pinned, reviewed reference.

No arbitrary source/command parameters; this is NOT a general untrusted RTL worker.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from .job import WindowsJob
from .oracles import check_uart

ROOT = Path(__file__).resolve().parents[2]
REVISION = 'ef203c2b0a3fb793280f5114941416c425c5b461'
SOURCE = ROOT/'.cache/upstream/picorv32'
TOOLS = ROOT/'.tools/oss-cad-suite'
GCC = ROOT/'.tools/xpack-riscv-none-elf-gcc-15.2.0-1/bin'
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()


class Regression:
    def __init__(self, output):
        self.output = output.resolve()
        if not self.output.is_relative_to(ROOT/'artifacts/real-soc'): raise ValueError('Output must stay under workspace artifacts/real-soc')
        self.output.mkdir(parents=True, exist_ok=False)
        self.commands, self.cases = [], []
        self.env = {**os.environ, 'PATH': os.pathsep.join(map(str, [TOOLS/'bin', TOOLS/'lib', GCC]))+os.pathsep+os.environ['PATH']}
        self.env['LC_ALL'] = 'C'

    def command(self, label, argv, cwd=None, timeout=120, allow_failure=False):
        folder = self.output/'logs'; folder.mkdir(exist_ok=True)
        number = len(self.commands)
        out, err = folder/f'{number:03}-{label}.stdout.log', folder/f'{number:03}-{label}.stderr.log'
        start = time.monotonic()
        with out.open('wb') as stdout, err.open('wb') as stderr:
            process = subprocess.Popen(list(map(str, argv)), cwd=cwd or self.output, env=self.env, stdout=stdout, stderr=stderr, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), shell=False)
            try: job = WindowsJob(process)
            except Exception:
                process.kill(); process.wait(); raise
            try:
                while process.poll() is None:
                    if time.monotonic()-start > timeout: job.kill(); raise TimeoutError(f'{label}: wall-time limit')
                    if out.stat().st_size+err.stat().st_size > 30_000_000: job.kill(); raise RuntimeError('Tool log quota exceeded')
                    if cwd and any(p.stat().st_size > 200_000_000 for p in Path(cwd).glob('*.vcd')): job.kill(); raise RuntimeError('Waveform quota exceeded')
                    time.sleep(.02)
                code = process.wait()
            finally: job.close()
        result = {'label': label, 'argv': list(map(str, argv)), 'cwd': str(cwd or self.output), 'exit_code': code, 'elapsed_s': round(time.monotonic()-start, 3), 'stdout': str(out.relative_to(ROOT)), 'stderr': str(err.relative_to(ROOT)), 'stdout_sha256': sha(out), 'stderr_sha256': sha(err), 'resource_boundary': 'WINDOWS_JOB_OBJECT_1G_PROCESS_2G_JOB_16_PROCESSES', 'network_isolated': False}
        self.commands.append(result)
        (self.output/'commands.json').write_text(json.dumps(self.commands, indent=2)+'\n')
        if code and not allow_failure: raise RuntimeError(f'{label} exited {code}: {err.read_text(errors="replace")[-3000:]}')
        return result, out.read_text(errors='replace')

    def build(self):
        revision = subprocess.check_output(['git', '-C', str(SOURCE), 'rev-parse', 'HEAD'], text=True).strip()
        if revision != REVISION: raise RuntimeError('Upstream source pin mismatch')
        if subprocess.check_output(['git', '-C', str(SOURCE), 'status', '--porcelain', '--untracked-files=all'], text=True).strip():
            raise RuntimeError('Upstream checkout has local changes or untracked inputs')
        subprocess.run(['git', '-C', str(SOURCE), 'diff', '--exit-code'], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(['git', '-C', str(SOURCE), 'diff', '--cached', '--exit-code'], check=True, stdout=subprocess.DEVNULL)
        self.source_hashes = {str(p.relative_to(SOURCE)): sha(p) for p in SOURCE.rglob('*') if p.is_file() and '.git' not in p.relative_to(SOURCE).parts}
        for name, exe in [('compiler', GCC/'riscv-none-elf-gcc.exe'), ('simulator', TOOLS/'bin/vvp.exe')]:
            self.command(name+'-version', [exe, '--version' if name == 'compiler' else '-V'])
        self.work = self.output/'source'
        shutil.copytree(SOURCE, self.work, ignore=shutil.ignore_patterns('.git'))
        objects = []
        cfiles = ['irq', 'print', 'hello', 'sieve', 'multest', 'stats']
        inputs = [self.work/'firmware/start.S'] + [self.work/f'firmware/{n}.c' for n in cfiles] + sorted((self.work/'tests').glob('*.S'))
        cc = GCC/'riscv-none-elf-gcc.exe'
        for source in inputs:
            obj = self.output/'objects'/f'{source.parent.name}-{source.stem}.o'; obj.parent.mkdir(exist_ok=True)
            march = 'rv32im_zicsr_zifencei' if source.parent.name == 'tests' else 'rv32ic_zicsr_zifencei' if source.suffix == '.c' else 'rv32imc_zicsr_zifencei'
            argv = [cc, '-c', '-mabi=ilp32', f'-march={march}', '-Os', '-ffreestanding', '-nostdlib', '-o', obj, source]
            if source.suffix == '.c': argv += ['--std=c99', '-Wall', '-Wextra']
            if source.parent.name == 'tests': argv += [f'-DTEST_FUNC_NAME={source.stem}', f'-DTEST_FUNC_TXT="{source.stem}"', f'-DTEST_FUNC_RET={source.stem}_ret']
            self.command('compile-'+source.stem, argv, self.work)
            objects.append(obj)
        self.elf = self.output/'firmware.elf'
        self.command('link', [cc, '-mabi=ilp32', '-march=rv32imc_zicsr_zifencei', '-ffreestanding', '-nostdlib', '-Wl,--build-id=none,-Bstatic', '-T', self.work/'firmware/sections.lds', '-o', self.elf, *objects, '-lgcc'], self.work)
        binary = self.output/'firmware.bin'
        self.command('objcopy', [GCC/'riscv-none-elf-objcopy.exe', '-O', 'binary', self.elf, binary])
        data = binary.read_bytes()
        if len(data) >= 128*1024: raise RuntimeError('Firmware exceeds upstream RAM')
        padded = data + bytes((-len(data)) % 4)
        words = [f'{w[0]:08x}' for w in struct.iter_unpack('<I', padded)]
        self.hexfile = self.output/'firmware.hex'
        self.hexfile.write_text('\n'.join(words+['00000000']*(32768-len(words)))+'\n')
        self.test_names = [p.stem for p in sorted((self.work/'tests').glob('*.S'))]
        self.program = self.output/'testbench.vvp'
        self.command('compile-rtl', [TOOLS/'bin/iverilog.exe', '-g2012', '-DCOMPRESSED_ISA', '-s', 'testbench', '-s', 'opensoc_monitor', '-o', self.program, self.work/'testbench.v', self.work/'picorv32.v', ROOT/'workers/reference_soc/monitor.v'])
        print(f'Compiled actual firmware ({len(data)} bytes, {len(self.test_names)} assembly tests) and CPU RTL', flush=True)

    def simulate(self, name, axi=False, wave=False, seed=None, bad=False, program=None):
        folder = self.output/name; folder.mkdir()
        firmware = self.hexfile
        if bad:
            firmware = folder/'corrupt.hex'
            lines = self.hexfile.read_text().splitlines(); lines[0] = 'ffffffff'; firmware.write_text('\n'.join(lines)+'\n')
        executable = program or self.program
        if seed is not None:
            executable = folder/'seeded.vvp'
            self.command(name+'-rtl', [TOOLS/'bin/iverilog.exe', '-g2012', '-DCOMPRESSED_ISA', '-s', 'testbench', '-s', 'opensoc_monitor', f'-Popensoc_monitor.SEED={seed}', '-o', executable, self.work/'testbench.v', self.work/'picorv32.v', ROOT/'workers/reference_soc/monitor.v'])
        argv = [TOOLS/'bin/vvp.exe', '-N', executable, f'+firmware={firmware}', '+trace']
        if axi: argv.append('+axi_test')
        if wave: argv.append('+opensoc_wave')
        record, text = self.command(name, argv, folder, allow_failure=True)
        mmio = [json.loads(line) for line in (folder/'mmio.jsonl').read_text().splitlines()]
        sentinel = any(e['address'] == '0x20000000' and int(e['write_data'], 16) == 123456789 for e in mmio)
        checks = check_uart(text, self.test_names)
        instructions = checks['assembly_names']
        uart = ''.join(chr(int(e['write_data'], 16) & 255) for e in mmio if e['address'] == '0x10000000')
        checks['mmio_uart_matches_stdout'] = bool(uart) and uart.strip() in text
        checks['timestamps_monotonic'] = [int(e['sim_time']['ticks']) for e in mmio] == sorted(int(e['sim_time']['ticks']) for e in mmio)
        success = record['exit_code'] == 0 and 'ALL TESTS PASSED.' in text and sentinel and all(checks[key] for key in ['assembly_complete', 'prime_values_correct', 'independent_arithmetic_correct', 'interrupts_observed', 'mmio_uart_matches_stdout', 'timestamps_monotonic']) and 'hello world' in text and ' ERROR' not in text and 'TIMEOUT' not in text
        if bad:
            passed = not success and not sentinel and 'ALL TESTS PASSED.' not in text and ('ERROR!' in text or 'TIMEOUT' in text)
            status = 'EXPECTED_FAIL_DETECTED' if passed else 'FAIL'
        else:
            passed = success; status = 'PASS' if passed else 'FAIL'
        result = {'id': name, 'status': status, 'regression_passed': passed, 'simulation_executed': True, 'exit_code': record['exit_code'], 'axi_random_delays': axi, 'seed': str(seed or 88172645463325252), 'passed_assembly_tests': instructions, 'expected_assembly_count': len(self.test_names), 'checks': checks, 'mmio_events': len(mmio), 'success_sentinel_observed': sentinel, 'cycles': int(re.search(r'TRAP after (\d+) clock cycles', text)[1]) if re.search(r'TRAP after (\d+) clock cycles', text) else None, 'log': record['stdout'], 'firmware_sha256': sha(firmware), 'trace_sha256': sha(folder/'testbench.trace'), 'mmio_sha256': sha(folder/'mmio.jsonl')}
        self.cases.append(result)
        print(f'{name}: {status}; asm={len(instructions)}/{len(self.test_names)}; MMIO={len(mmio)}; cycles={result["cycles"]}', flush=True)
        return result

    def finish(self):
        files = {str(p.relative_to(ROOT)): {'sha256': sha(p), 'size': p.stat().st_size} for p in self.output.rglob('*') if p.is_file() and p.suffix in {'.elf', '.bin', '.hex', '.vvp', '.vcd', '.trace', '.jsonl'}}
        inputs = [Path(__file__), ROOT/'workers/reference_soc/oracles.py', ROOT/'workers/reference_soc/monitor.v', ROOT/'workers/reference_soc/counter_monitor.v', ROOT/'workers/reference_soc/job.py', TOOLS/'bin/iverilog.exe', TOOLS/'bin/vvp.exe', GCC/'riscv-none-elf-gcc.exe', GCC/'riscv-none-elf-objcopy.exe']
        result = {'schema_version': '1.0', 'profile_id': 'picorv32_upstream_axi_reference', 'run_at': datetime.now(timezone.utc).isoformat(), 'source_repository': 'https://github.com/YosysHQ/picorv32', 'source_revision': REVISION, 'source_hashes': self.source_hashes, 'worker_tool_hashes': {str(p.relative_to(ROOT)): sha(p) for p in inputs}, 'status': 'PASS' if self.cases and all(c['regression_passed'] for c in self.cases) else 'FAIL', 'simulation_executed': True, 'simulator': 'Icarus Verilog / vvp', 'rtl_cpu': 'actual upstream PicoRV32', 'commands': self.commands, 'cases': self.cases, 'artifacts': files,
          'limitations': ['Reviewed fixed reference only; not arbitrary imported RTL.', 'Windows Job Object resource limits are not an OS/network sandbox.', 'MMIO decoder correlation is DERIVED; fetch addresses are not retired instruction PCs.', 'Does not establish Ibex/gem5/SystemC or full V1.0 acceptance.']}
        target = ROOT/'docs/test-evidence/real-soc'; target.mkdir(parents=True, exist_ok=True)
        saved_logs = target/'logs'; saved_logs.mkdir(exist_ok=True)
        for case in self.cases:
            shutil.copyfile(ROOT/case['log'], saved_logs/(case['id']+'.stdout.log'))
        (target/'regression.json').write_text(json.dumps(result, indent=2)+'\n')
        (self.output/'regression.json').write_text(json.dumps(result, indent=2)+'\n')
        suite = ET.Element('testsuite', name='PicoRV32 actual RTL regression', tests=str(len(self.cases)), failures=str(sum(not c['regression_passed'] for c in self.cases)))
        for c in self.cases:
            case = ET.SubElement(suite, 'testcase', name=c['id'])
            if not c['regression_passed']: ET.SubElement(case, 'failure', message='Real RTL oracle failed').text = json.dumps(c)
        ET.ElementTree(suite).write(target/'junit.xml', encoding='utf-8', xml_declaration=True)
        return result

    def counter_reset(self):
        folder = self.output/'counter_reset'; folder.mkdir()
        program = folder/'counter.vvp'
        self.command('counter-reset-rtl', [TOOLS/'bin/iverilog.exe', '-g2012', '-s', 'testbench', '-s', 'opensoc_counter_monitor', '-o', program, self.work/'testbench_ez.v', self.work/'picorv32.v', ROOT/'workers/reference_soc/counter_monitor.v'])
        record, text = self.command('counter-reset', [TOOLS/'bin/vvp.exe', '-N', program, '+vcd'], folder, allow_failure=True)
        before, separator, after = text.partition('OPENSOC_RESET_RELEASE')
        def writes(log):
            return [int(v, 16) for v in re.findall(r'write\s+0x000003fc: 0x([0-9a-f]{8}) \(wstrb=1111\)', log)]
        sequences = [writes(before), writes(after)]
        checks = {'reset_observed': 'OPENSOC_RESET_ASSERT' in before and bool(separator), 'counter_restarts_at_zero': all(len(s) >= 5 and s == list(range(len(s))) for s in sequences), 'no_trap': 'Unexpected CPU trap' not in text}
        passed = record['exit_code'] == 0 and all(checks.values())
        self.cases.append({'id': 'counter_reset', 'status': 'PASS' if passed else 'FAIL', 'regression_passed': passed, 'simulation_executed': True, 'exit_code': record['exit_code'], 'checks': checks, 'counter_writes_before_after': [len(s) for s in sequences], 'log': record['stdout']})
        print(f'counter_reset: {self.cases[-1]["status"]}; writes before/after reset: {[len(s) for s in sequences]}', flush=True)

    def replay(self):
        baseline = self.cases[0]
        replay = self.simulate('replay')
        replay['checks']['identical_trace_mmio_cycles'] = all(replay[k] == baseline[k] for k in ['trace_sha256', 'mmio_sha256', 'cycles', 'firmware_sha256'])
        if not replay['checks']['identical_trace_mmio_cycles']:
            replay.update(status='FAIL', regression_passed=False)


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--output'); parser.add_argument('--quick', action='store_true'); args = parser.parse_args()
    folder = ROOT/(args.output or f'artifacts/real-soc/{datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")}')
    regression = Regression(folder)
    regression.build()
    regression.simulate('baseline', wave=True)
    if not args.quick:
        regression.simulate('axi_delays_seed_default', axi=True)
        regression.simulate('axi_delays_seed_17', axi=True, seed=17)
        program = regression.output/'singleport.vvp'
        regression.command('singleport-rtl', [TOOLS/'bin/iverilog.exe', '-g2012', '-DCOMPRESSED_ISA', '-DSP_TEST', '-s', 'testbench', '-s', 'opensoc_monitor', '-o', program, regression.work/'testbench.v', regression.work/'picorv32.v', ROOT/'workers/reference_soc/monitor.v'])
        regression.simulate('singleport_register_file', program=program)
        regression.replay()
        regression.counter_reset()
        regression.simulate('corrupt_firmware_negative_control', bad=True)
    result = regression.finish()
    print(f'Regression {result["status"]}: {len(result["cases"])} actual simulation cases. Artifacts: {regression.output}', flush=True)
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__': raise SystemExit(main())
