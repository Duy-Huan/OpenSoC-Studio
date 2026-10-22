import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { pythonExecutable } from './python-path.mjs';
const npmCli = process.env.npm_execpath;
if (!npmCli) throw Error('Run via npm.cmd run verify (Windows) or npm run verify.');
const commands = [
  [process.execPath, [npmCli, 'run', 'check']],
  [process.execPath, [npmCli, 'run', 'build:web']],
  [pythonExecutable, ['-m', 'pytest', 'tests/integration', '-q', '--junitxml=docs/test-evidence/current/api-tests.xml']],
  [process.execPath, ['node_modules/playwright/cli.js', 'test']],
];
const results = [];
for (const [command, args] of commands) {
  const run = spawnSync(command, args, { encoding: 'utf8', windowsHide: true, shell: false, timeout: 90000, maxBuffer: 3000000 });
  const result = { command: [command, ...args], exit_code: run.status, stdout: run.stdout ?? '', stderr: run.stderr ?? '', error: run.error?.message ?? null };
  results.push(result);
  console.log(result.stdout); if (result.stderr) console.error(result.stderr);
  if (run.status !== 0) break;
}
await mkdir('docs/test-evidence/current', { recursive: true });
const pass = results.length === commands.length && results.every(r => r.exit_code === 0);
await writeFile('docs/test-evidence/current/verification.json', JSON.stringify({ checked_at: new Date().toISOString(), scope: 'Local workbench/analysis/composer/ELF parser and reference evidence access; native execution reported separately in real-soc/regression.json', status: pass ? 'PASS' : 'FAIL', commands: results }, null, 2)+'\n');
process.exitCode = pass ? 0 : 1;
