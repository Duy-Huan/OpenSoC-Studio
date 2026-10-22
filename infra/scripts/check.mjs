import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const commands = [
  ['--test', 'tests/contract/model.test.mjs', 'tests/licensing/policy.test.mjs'],
  ['infra/scripts/license-audit.mjs'],
];
const evidence = [];
for (const args of commands) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000, shell: false, windowsHide: true });
  evidence.push({ command: ['node', ...args], exit_code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.message ?? null });
  console.log(r.stdout ?? '');
  if (r.stderr) console.error(r.stderr);
}
const inputs = {};
for (const p of ['AI_START_HERE_OpenSoC.md', 'OpenSoC_Studio_Engineering_Blueprint_v1_0.md', 'package-lock.json', ...((await readdir('docs/contracts')).filter(f => f.endsWith('.json')).map(f => `docs/contracts/${f}`))]) inputs[p] = createHash('sha256').update(await readFile(p)).digest('hex');
await mkdir('docs/test-evidence/current', { recursive: true });
const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true });
const report = { checked_at: new Date().toISOString(), node: process.version, base_commit: head.status === 0 ? head.stdout.trim() : null, commit_note: 'Working changes are not committed; exact input SHA256 recorded.', inputs, commands: evidence, status: evidence.every(e => e.exit_code === 0) ? 'PASS' : 'FAIL', scope: 'Shared contract and installed npm license checks only; not hardware acceptance' };
await writeFile('docs/test-evidence/current/checks.json', JSON.stringify(report, null, 2) + '\n');
process.exitCode = report.status === 'PASS' ? 0 : 1;
