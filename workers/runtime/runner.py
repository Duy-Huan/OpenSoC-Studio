"""Fixed reviewed engine workflows. Linux only; never executes uploaded build scripts."""
import argparse
import hashlib
import json
import os
import resource
import re
import shutil
import signal
import struct
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from workers.reference_soc.oracles import check_uart

ROOT = Path(__file__).resolve().parents[2]
PIN = 'ef203c2b0a3fb793280f5114941416c425c5b461'
PROFILES = ['picorv32_icarus', 'picorv32_verilator', 'systemc_tlm', 'systemc_verilated', 'yosys_netlist', 'gem5_riscv', 'gem5_tlm_roundtrip', 'ibex_simple_system']

def sha(path):
    with Path(path).open('rb') as stream: return hashlib.file_digest(stream, 'sha256').hexdigest()


class Run:
    def __init__(self, output, profile, scenario):
        self.output = Path(output).resolve()
        if not self.output.is_relative_to(ROOT/'artifacts/runtime'): raise ValueError('Output escapes runtime boundary')
        self.output.mkdir(parents=True, exist_ok=True)
        self.profile, self.scenario = profile, scenario
        self.commands, self.stages = [], []
        self.events = self.output/'events.jsonl'
        self.env = {**os.environ, 'LC_ALL': 'C', 'OMP_NUM_THREADS': '2', 'PATH': '/opt/opensoc/venv/bin:/usr/local/bin:/usr/bin:/bin'}
        inputs = list((ROOT/'workers/runtime').glob('*.py'))+list((ROOT/'workers/runtime').glob('*.v'))+list((ROOT/'workers/runtime').glob('*.cpp'))+list((ROOT/'workers/runtime').glob('*.S'))+[ROOT/'workers/reference_soc/oracles.py',ROOT/'workers/reference_soc/monitor.v',ROOT/'reference/register_bank/rtl/register_bank.sv']
        self.input_hashes={str(p.relative_to(ROOT)):sha(p) for p in inputs}
        marker=ROOT/'.tools/runtime-ready.json'
        self.toolchain=json.loads(marker.read_text()) if marker.is_file() else None

    def emit(self, kind, data):
        with self.events.open('a') as stream:
            stream.write(json.dumps({'kind': kind, 'data': data})+'\n')

    def stage(self, name):
        item = {'id': name, 'state': 'RUNNING', 'started_at': datetime.now(timezone.utc).isoformat()}
        self.stages.append(item); self.emit('stage.state', item)

    def end_stage(self, passed=True, details=None):
        item = self.stages[-1]; item.update(state='PASS' if passed else 'FAIL', details=details or {})
        self.emit('stage.state', item)

    def command(self, label, argv, cwd=None, timeout=600, allow_failure=False):
        folder = self.output/'logs'; folder.mkdir(exist_ok=True)
        out, err = folder/f'{len(self.commands):03}-{label}.stdout.log', folder/f'{len(self.commands):03}-{label}.stderr.log'
        def limits():
            resource.setrlimit(resource.RLIMIT_AS, (6*1024**3, 6*1024**3))
            resource.setrlimit(resource.RLIMIT_FSIZE, (512*1024**2, 512*1024**2))
            resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
            resource.setrlimit(resource.RLIMIT_CPU, (900, 900))
            resource.setrlimit(resource.RLIMIT_NPROC, (128, 128))
            resource.setrlimit(resource.RLIMIT_NOFILE, (1024, 1024))
        start = time.monotonic(); reason = None
        self.emit('build.log', {'message': label, 'argv': list(map(str, argv))})
        with out.open('wb') as stdout, err.open('wb') as stderr:
            process = subprocess.Popen(list(map(str, argv)), cwd=cwd or self.output, env=self.env, stdout=stdout, stderr=stderr, start_new_session=True, preexec_fn=limits)
            try:
                while process.poll() is None:
                    if (self.output/'cancel.request').exists(): reason = 'CANCELLED'
                    elif time.monotonic()-start > timeout: reason = 'TIMED_OUT'
                    elif out.stat().st_size+err.stat().st_size > 30_000_000: reason = 'LOG_QUOTA'
                    if reason:
                        os.killpg(process.pid, signal.SIGKILL); break
                    time.sleep(.05)
                code = process.wait()
            finally:
                if process.poll() is None: os.killpg(process.pid, signal.SIGKILL); process.wait()
        item = {'stage': self.stages[-1]['id'], 'label': label, 'argv': list(map(str, argv)), 'exit_code': code, 'elapsed_s': round(time.monotonic()-start, 3), 'reason': reason, 'stdout': str(out.relative_to(ROOT)), 'stderr': str(err.relative_to(ROOT)), 'stdout_sha256': sha(out), 'stderr_sha256': sha(err)}
        self.commands.append(item); self.emit('command.completed', item)
        if reason: raise RuntimeError(reason)
        if code and not allow_failure: raise RuntimeError(f'{label} exited {code}; {err.read_text(errors="replace")[-1500:]}')
        return item, out.read_text(errors='replace')

    def sources(self):
        self.stage('source_snapshot')
        source = ROOT/'.cache/upstream/picorv32'
        git = ['git', '-c', f'safe.directory={source}', '-c', 'core.autocrlf=true', '-c', 'core.filemode=false', '-C', source]
        revision = subprocess.check_output([*git, 'rev-parse', 'HEAD'], text=True).strip()
        dirty = subprocess.check_output([*git, 'status', '--porcelain', '--untracked-files=all'], text=True).strip()
        if revision != PIN or dirty: raise RuntimeError('Reference source pin/cleanliness mismatch')
        self.source = self.output/'source'
        self.source_hashes = {str(p.relative_to(source)): sha(p) for p in source.rglob('*') if p.is_file() and '.git' not in p.relative_to(source).parts}
        # Copy bytes only: NTFS/DrvFS metadata cannot be chmod/copystat by the Linux worker.
        for name in self.source_hashes:
            destination = self.source/name; destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source/name, destination)
        self.end_stage(details={'revision': PIN, 'file_count': len(self.source_hashes)})

    def firmware(self):
        self.stage('firmware_build')
        cc = 'riscv64-unknown-elf-gcc'
        self.command('gcc-version', [cc, '--version'])
        objects = []; objdir = self.output/'objects'; objdir.mkdir()
        files = [self.source/'firmware/start.S'] + [self.source/f'firmware/{name}.c' for name in ['irq','print','hello','sieve','multest','stats']] + sorted((self.source/'tests').glob('*.S'))
        for source in files:
            obj = objdir/f'{source.parent.name}-{source.stem}.o'
            march = 'rv32im_zicsr_zifencei' if source.parent.name == 'tests' else 'rv32ic_zicsr_zifencei' if source.suffix == '.c' else 'rv32imc_zicsr_zifencei'
            args = [cc, '-c', '-mabi=ilp32', f'-march={march}', '-Os', '-ffreestanding', '-nostdlib', '-o', obj, source]
            if source.suffix == '.c': args += ['-std=c99', '-Wall', '-Wextra']
            if source.parent.name == 'tests': args += [f'-DTEST_FUNC_NAME={source.stem}', f'-DTEST_FUNC_TXT="{source.stem}"', f'-DTEST_FUNC_RET={source.stem}_ret']
            self.command('firmware-'+source.stem, args); objects.append(obj)
        self.command('firmware-link', [cc, '-mabi=ilp32', '-march=rv32imc_zicsr_zifencei', '-nostdlib', '-Wl,--build-id=none,-Bstatic', '-T', self.source/'firmware/sections.lds', '-o', self.output/'firmware.elf', *objects, '-lgcc'])
        self.command('firmware-objcopy', ['riscv64-unknown-elf-objcopy', '-O', 'binary', self.output/'firmware.elf', self.output/'firmware.bin'])
        binary = (self.output/'firmware.bin').read_bytes()
        if len(binary) >= 128*1024: raise RuntimeError('Firmware exceeds RAM')
        padded = binary + bytes((-len(binary))%4)
        words = [f'{word[0]:08x}' for word in struct.iter_unpack('<I', padded)]
        if self.scenario == 'negative_control': words[0] = 'ffffffff'
        self.hex = self.output/'firmware.hex'
        self.hex.write_text('\n'.join(words+['00000000']*(32768-len(words)))+'\n')
        self.end_stage(details={'binary_bytes':len(binary), 'elf_sha256':sha(self.output/'firmware.elf')})

    def picorv32(self):
        self.sources(); self.firmware(); self.stage('rtl_build')
        rtl = [self.source/'testbench.v', self.source/'picorv32.v', ROOT/'workers/reference_soc/monitor.v', ROOT/'workers/runtime/reference_top.v']
        if self.profile == 'picorv32_verilator':
            self.command('verilator-version', ['verilator', '--version'])
            executable = self.output/'Vreference'
            self.command('verilator-build', ['verilator', '--binary', '--timing', '--trace', '-Wno-fatal', '-UVERILATOR', '-DCOMPRESSED_ISA', '--top-module', 'opensoc_reference', '--Mdir', self.output/'obj_dir', '-o', executable, '-j', '2', *rtl], timeout=900)
            argv = [executable]
        else:
            executable = self.output/'reference.vvp'
            self.command('icarus-build', ['iverilog', '-g2012', '-DCOMPRESSED_ISA', '-s', 'opensoc_reference', '-o', executable, *rtl])
            argv = ['vvp', '-N', executable]
        self.end_stage(); self.stage('rtl_simulation')
        argv += [f'+firmware={self.hex}', '+trace', '+opensoc_wave']
        if self.scenario == 'backpressure': argv.append('+axi_test')
        command, text = self.command('rtl-execute', argv, timeout=120, allow_failure=True)
        self.end_stage(details={'exit_code':command['exit_code']}); self.stage('independent_oracle')
        checks = check_uart(text, [p.stem for p in sorted((self.source/'tests').glob('*.S'))])
        mmio = [json.loads(line) for line in (self.output/'mmio.jsonl').read_text().splitlines()]
        sentinel = any(event['address']=='0x20000000' and int(event['write_data'],16)==123456789 for event in mmio)
        uart = ''.join(chr(int(event['write_data'],16)&255) for event in mmio if event['address']=='0x10000000')
        checks['mmio_uart_matches_stdout'] = bool(uart) and uart.strip() in text
        checks['success_sentinel'] = sentinel
        keys = ['assembly_complete','prime_values_correct','independent_arithmetic_correct','interrupts_observed','mmio_uart_matches_stdout','success_sentinel']
        passed = command['exit_code']==0 and 'ALL TESTS PASSED.' in text and all(checks[key] for key in keys)
        if self.scenario == 'negative_control':
            passed = not sentinel and 'ALL TESTS PASSED.' not in text and ('ERROR!' in text or 'TIMEOUT' in text)
            checks['negative_control_detected'] = passed
        self.end_stage(passed, checks)
        if not passed: raise AssertionError('Actual CPU RTL oracle failed')
        return checks

    def execute(self):
        status = 'PASS'; checks = {}; error = None
        try:
            if self.profile.startswith('picorv32_'): checks = self.picorv32()
            elif self.profile in {'systemc_tlm','systemc_verilated'}: checks = self.systemc()
            elif self.profile == 'yosys_netlist': checks = self.yosys()
            elif self.profile in {'gem5_riscv','gem5_tlm_roundtrip'}: checks = self.gem5()
            elif self.profile == 'ibex_simple_system': checks = self.ibex()
            waves = sorted(self.output.glob('*.vcd')) + sorted(self.output.glob('*.fst'))
            if waves and self.scenario != 'negative_control':
                self.stage('wellen_waveform')
                from .wave import window
                index = window(waves[0])
                (self.output/'wave-index.json').write_text(json.dumps(index,indent=2)+'\n')
                if not index['window']: raise AssertionError('No actual wave signals indexed')
                self.end_stage(details={'reader':index['reader'],'signals':len(index['signals']),'tick_fs':index['tick_fs']})
        except Exception as exc:
            error = f'{type(exc).__name__}: {exc}'
            status = 'FAIL' if isinstance(exc, AssertionError) else 'CANCELLED' if str(exc)=='CANCELLED' else 'TIMED_OUT' if str(exc)=='TIMED_OUT' else 'FAILED_INFRA'
            if self.stages and self.stages[-1]['state']=='RUNNING': self.end_stage(False, {'error':error})
        if status=='PASS' and (self.output/'cancel.request').exists(): status='CANCELLED';error='Cancellation requested before terminal verdict'
        paths = [p for p in self.output.rglob('*') if p.is_file() and 'source' not in p.relative_to(self.output).parts and 'obj_dir' not in p.relative_to(self.output).parts and p.name not in {'result.json','events.jsonl','cancel.request','launcher.stdout.log','launcher.stderr.log'}]
        result = {'schema_version':'1.0', 'profile_id':self.profile, 'scenario':self.scenario, 'status':status, 'error':error, 'run_at':datetime.now(timezone.utc).isoformat(), 'simulation_executed':any(c['label'] in {'rtl-execute','systemc-execute','netlist-execute','gem5-execute','ibex-execute'} for c in self.commands) and not(self.profile=='ibex_simple_system' and self.scenario=='negative_control'), 'stages':self.stages, 'commands':self.commands, 'checks':checks, 'source_revision':PIN if self.profile.startswith('picorv32_') else checks.get('source_revision'), 'source_hashes':getattr(self,'source_hashes',{}), 'worker_hashes':self.input_hashes,'toolchain':self.toolchain, 'artifacts':{str(p.relative_to(ROOT)):{'sha256':sha(p),'size':p.stat().st_size} for p in paths}, 'isolation':'UNPRIVILEGED_WSL_RESOURCE_LIMITED_NOT_FULL_OS_SANDBOX', 'network_isolated':False}
        temporary = self.output/'result.json.tmp'; temporary.write_text(json.dumps(result,indent=2)+'\n'); temporary.replace(self.output/'result.json')
        self.emit('run.verdict', {'status':status, 'error':error})
        print(f'{self.profile}: {status}', flush=True)
        return 0 if status=='PASS' else 1

    def systemc(self):
        self.stage('systemc_build')
        flags=subprocess.check_output(['pkg-config','--cflags','--libs','systemc'],text=True).split()
        binary=self.output/'tlm-reference'
        if self.profile=='systemc_verilated':
            self.command('systemc-verilator-build',['verilator','--sc','--exe','--build','-Wno-fatal','--top-module','register_bank','--Mdir',self.output/'obj_dir','-o',binary,'-j','2','-CFLAGS','-std=c++17 -DOPENSOC_VERILATED','-LDFLAGS','-lsystemc -pthread',ROOT/'reference/register_bank/rtl/register_bank.sv',ROOT/'workers/runtime/tlm_reference.cpp'])
        else: self.command('systemc-compile',['g++','-std=c++17','-O2',ROOT/'workers/runtime/tlm_reference.cpp','-o',binary,*flags,'-pthread'])
        self.end_stage(); self.stage('systemc_simulation')
        command,text=self.command('systemc-execute',[binary,self.scenario],allow_failure=True)
        self.end_stage(details={'exit_code':command['exit_code']}); self.stage('tlm_oracle')
        events=[json.loads(line) for line in (self.output/'transactions.jsonl').read_text().splitlines()]
        paired=len(events)==12 and all(events[i]['id']==events[i+1]['id'] and int(events[i+1]['ticks'])>int(events[i]['ticks']) for i in range(0,len(events),2))
        passed=paired and (command['exit_code']==2 and 'SYSTEMC_ORACLE_FAIL' in text if self.scenario=='negative_control' else command['exit_code']==0 and 'SYSTEMC_ORACLE_PASS' in text)
        checks={'paired_transactions':paired,'transaction_count':len(events)//2,'fidelity':'SYSTEMC_TLM_TO_ACTUAL_VERILATED_REGISTER' if self.profile=='systemc_verilated' else 'SYNTHETIC_TLM_INITIATOR_NOT_CPU','negative_control':self.scenario=='negative_control'}
        self.end_stage(passed,checks)
        if not passed: raise AssertionError('SystemC TLM oracle failed')
        return checks

    def yosys(self):
        self.stage('yosys_synthesis')
        source=ROOT/'reference/register_bank/rtl/register_bank.sv'
        self.source_hashes={str(source.relative_to(ROOT)):sha(source)}
        self.command('yosys-synthesize',['yosys','-p',f'read_verilog -sv {source}; synth -top register_bank; rename register_bank register_bank_gate; check -assert; write_json netlist.json; write_verilog -noattr netlist.v'])
        self.end_stage(); self.stage('post_synthesis_simulation')
        argv=['iverilog','-g2012','-s','register_compare','-o',self.output/'register.vvp',source,self.output/'netlist.v',ROOT/'workers/runtime/register_compare.v']
        if self.scenario=='negative_control': argv.insert(2,'-DNEGATIVE_CONTROL')
        self.command('netlist-compile',argv)
        command,text=self.command('netlist-execute',['vvp','-N',self.output/'register.vvp'],allow_failure=True)
        passed=command['exit_code']!=0 and 'REGISTER_ORACLE_FAIL' in text if self.scenario=='negative_control' else command['exit_code']==0 and 'REGISTER_ORACLE_PASS' in text
        self.end_stage(passed,{'vectors':16,'hold_checks':16,'reset_checks':2})
        if not passed: raise AssertionError('Post-synthesis behavior mismatch')
        return {'rtl_vs_netlist':True,'vectors':16,'negative_control':self.scenario=='negative_control'}

    def gem5(self):
        self.stage('gem5_firmware_build')
        revision=subprocess.check_output(['git','-C','/opt/opensoc/src/gem5','rev-parse','HEAD'],text=True).strip()
        if revision!='b9da2bfe1e21f6efa2730edd4e80e58c5d965458': raise RuntimeError('gem5 source pin mismatch')
        self.command('gem5-source-clean',['git','-C','/opt/opensoc/src/gem5','diff','--exit-code'])
        binary=self.output/'workload.elf'
        argv=['riscv64-unknown-elf-gcc','-march=rv64imac_zicsr_zifencei','-mabi=lp64','-nostdlib','-nostartfiles','-static','-Wl,--build-id=none,-Ttext=0x10000','-o',binary,ROOT/'workers/runtime/gem5_workload.S']
        if self.scenario=='negative_control': argv.insert(1,'-DNEGATIVE_CONTROL')
        self.command('gem5-workload-build',argv);self.end_stage();self.stage('gem5_simulation')
        executable=Path('/opt/opensoc/src/gem5/build/RISCV/gem5.opt')
        argv=[executable,'--outdir='+str(self.output/'m5out')]
        if self.profile=='gem5_tlm_roundtrip': argv+=['--debug-flags=TlmBridge,CommMonitor','--debug-file=tlm-bridge.log']
        argv += [ROOT/'workers/runtime/gem5_config.py',binary]
        if self.profile=='gem5_tlm_roundtrip': argv+=['tlm_roundtrip']
        command,text=self.command('gem5-execute',argv,allow_failure=True)
        self.end_stage(details={'exit_code':command['exit_code']});self.stage('gem5_oracle')
        exit_event=json.loads((self.output/'gem5-exit.json').read_text())
        stats=(self.output/'m5out/stats.txt').read_text()
        passed=command['exit_code']!=0 and exit_event['code']==1 and 'GEM5_WORKLOAD_FAIL' in text if self.scenario=='negative_control' else command['exit_code']==0 and exit_event['code']==0 and 'GEM5_WORKLOAD_PASS sum=5050' in text
        instructions=re.findall(r'^simInsts\s+(\d+)',stats,re.M);ticks=re.findall(r'^simTicks\s+(\d+)',stats,re.M)
        passed=passed and int(exit_event['tick'])>0 and bool(instructions) and int(instructions[-1])>500 and bool(ticks) and int(ticks[-1])>0
        checks={**exit_event,'stats_present':bool(instructions) and bool(ticks),'sim_instructions':int(instructions[-1]) if instructions else None,'simulator_sha256':sha(executable),'negative_control':self.scenario=='negative_control','source_revision':revision}
        if self.profile=='gem5_tlm_roundtrip':
            from .tlm_trace import correlate
            paired=correlate(self.output/'m5out/tlm-bridge.log')
            checks.update(tlm_transactions=len(paired),correlation='DERIVED_FIFO_SINGLE_OUTSTANDING_TIMING_CPU',bridge_monitors_match=bool(paired))
            with (self.output/'tlm-transactions.jsonl').open('w') as stream:
                for event in paired: stream.write(json.dumps(event)+'\n')
            passed=passed and bool(paired)
        self.end_stage(passed,checks)
        if not passed: raise AssertionError('gem5 workload/termination oracle failed')
        return checks

    def ibex(self):
        self.stage('ibex_source_toolchain')
        source=Path('/opt/opensoc/src/ibex')
        revision=subprocess.check_output(['git','-C',source,'rev-parse','HEAD'],text=True).strip()
        if revision!='1b29dae8866e6c0f0a3cd9dead53a77b4f45e357': raise RuntimeError('Ibex source pin mismatch')
        self.command('ibex-source-clean',['git','-C',source,'diff','--exit-code'])
        simulator=source/'build/lowrisc_ibex_ibex_simple_system_0/sim-verilator/Vibex_simple_system'
        self.end_stage(details={'revision':revision})
        self.stage('fusesoc_edalize_verilator_build')
        self.command('ibex-config',['python','util/ibex_config.py','small','fusesoc_opts'],cwd=source)
        options=subprocess.check_output(['/opt/opensoc/venv/bin/python','util/ibex_config.py','small','fusesoc_opts'],cwd=source,text=True).split()
        self.command('ibex-fusesoc',['fusesoc','--cores-root=.','run','--target=sim','--setup','--build','lowrisc:ibex:ibex_simple_system',*options],cwd=source,timeout=900)
        self.end_stage(details={'simulator_sha256':sha(simulator)})
        self.stage('ibex_firmware_build')
        self.command('ibex-firmware',['make','-B','-C',source/'examples/sw/simple_system/hello_test','CC=riscv64-unknown-elf-gcc','ARCH=rv32imc_zicsr_zifencei'])
        firmware=source/'examples/sw/simple_system/hello_test/hello_test.elf'
        shutil.copyfile(firmware,self.output/'firmware.elf')
        if self.scenario=='negative_control':
            # Invalid input ELF exercises the loader's rejection path, not a CPU functional PASS.
            (self.output/'invalid.elf').write_bytes(b'invalid ELF')
            firmware=self.output/'invalid.elf'
        self.end_stage();self.stage('ibex_rtl_simulation')
        command,text=self.command('ibex-execute',[simulator,'-t',f'--meminit=ram,{firmware}'],allow_failure=True,timeout=120)
        self.end_stage(details={'exit_code':command['exit_code']});self.stage('ibex_oracle')
        log=self.output/'ibex_simple_system.log'
        uart=log.read_text() if log.exists() else ''
        traces=list(self.output.glob('trace_core_*.log')); waves=list(self.output.glob('*.fst'))
        stderr=(ROOT/command['stderr']).read_text(errors='replace')
        # The pinned upstream loader reports invalid ELF on stderr but exits zero.
        # Its exit code alone cannot establish simulation success or rejection.
        rejected='ERROR: Failed to load ELF file' in stderr and 'not an ELF file' in stderr and not uart and not traces and not waves
        passed=rejected if self.scenario=='negative_control' else command['exit_code']==0 and 'ERROR:' not in stderr and all(marker.lower() in uart.lower() for marker in ['Hello simple system','deadbeef','baadf00d']) and bool(traces) and traces[0].stat().st_size>0 and bool(waves)
        checks={'hello':uart[:2000],'instruction_trace':bool(traces),'fst_waveform':bool(waves),'source_revision':revision,'negative_control':self.scenario=='negative_control','invalid_elf_rejected':rejected,'loader_exit_zero_on_error':rejected and command['exit_code']==0}
        self.end_stage(passed,checks)
        if not passed: raise AssertionError('Ibex firmware/trace oracle failed')
        return checks


def main():
    parser = argparse.ArgumentParser(); parser.add_argument('--profile', choices=PROFILES, required=True); parser.add_argument('--scenario', choices=['baseline','backpressure','negative_control'], default='baseline'); parser.add_argument('--output',required=True)
    args = parser.parse_args()
    return Run(args.output,args.profile,args.scenario).execute()

if __name__=='__main__': raise SystemExit(main())
