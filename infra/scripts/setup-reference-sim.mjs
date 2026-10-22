import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../..', import.meta.url)));
if (process.platform !== 'win32') throw Error('This pinned portable toolchain is tested on Windows x64 only.');
function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true, shell: false });
  if (result.error || result.status !== 0) throw result.error ?? Error(`${command} exited ${result.status}`);
}
const tar = resolve(process.env.WINDIR, 'System32/tar.exe');
if (!existsSync('.tools/oss-cad-suite/bin/iverilog.exe')) {
  run(process.execPath, ['infra/scripts/fetch-simulation-tools.mjs']);
  run(tar, ['-xzf', '.tools/downloads/oss-cad-suite.tgz', '-C', '.tools']);
}
if (!existsSync('.tools/xpack-riscv-none-elf-gcc-15.2.0-1/bin/riscv-none-elf-gcc.exe')) {
  run(process.execPath, ['infra/scripts/fetch-simulation-tools.mjs', 'gcc']);
  run(tar, ['-xf', '.tools/downloads/riscv-gcc.zip', '-C', '.tools']);
}
if (!existsSync('.cache/upstream/picorv32/.git')) {
  mkdirSync('.cache/upstream', { recursive: true });
  run('git', ['init', '.cache/upstream/picorv32']);
  const prefix = ['-C', '.cache/upstream/picorv32'];
  run('git', [...prefix, 'remote', 'add', 'origin', 'https://github.com/YosysHQ/picorv32.git']);
  run('git', [...prefix, 'fetch', '--depth', '1', 'origin', 'ef203c2b0a3fb793280f5114941416c425c5b461']);
  run('git', [...prefix, 'checkout', '--detach', 'FETCH_HEAD']);
}
console.log('Reference tools ready. Run npm.cmd run sim:reference. Existing checkouts are never reset; runner checks exact pin and clean status.');
