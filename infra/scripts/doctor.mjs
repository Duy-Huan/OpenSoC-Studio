import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { platform, arch } from 'node:os';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
export function probe(command, args) {
  const r = spawnSync(command, args, { encoding: 'utf8', timeout: 12000, windowsHide: true, shell: false, maxBuffer: 200000 });
  return { command: [command, ...args], status: r.status === 0 ? 'AVAILABLE' : 'UNAVAILABLE', exit_code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.code ?? null };
}
export function collect() {
  const python = process.env.OPENSOC_PYTHON ?? (existsSync('.tools/python/python.exe') ? resolve('.tools/python/python.exe') : 'python');
  return { schema_version: '1.0', checked_at: new Date().toISOString(), platform: platform(), arch: arch(), node: process.version,
    probes: [probe('git', ['--version']), { ...probe(python, ['--version']), name: 'python' }, probe('python3', ['--version']), probe('verilator', ['--version']), probe('fusesoc', ['--version']), probe('scons', ['--version']), probe('g++', ['--version']), probe('cmake', ['--version']), probe('cargo', ['--version']), probe('riscv32-unknown-elf-gcc', ['--version']), probe('docker', ['version', '--format', '{{json .Server}}'])] };
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/doctor.mjs')) {
  const report = collect();
  await mkdir('docs/test-evidence/current', { recursive: true });
  await writeFile('docs/test-evidence/current/environment.json', JSON.stringify(report, null, 2) + '\n');
  for (const p of report.probes) console.log(`${p.name ?? p.command[0]}: ${p.status}`);
  console.log('Inventory only; AVAILABLE does not certify sandbox or simulation capability.');
}
