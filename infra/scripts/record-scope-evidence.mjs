import { spawnSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const records = [];
const commands = [
  ['node', ['infra/scripts/doctor.mjs']],
  ['node', ['infra/scripts/spike-preflight.mjs', 'A']],
  ['node', ['infra/scripts/spike-preflight.mjs', 'B']],
  ['node', ['infra/scripts/license-audit.mjs', '--release']],
];
if (process.platform === 'win32') {
  commands.push(['C:/Program Files/Git/bin/bash.exe', ['-n', 'infra/spikes/run-a.sh']]);
  commands.push(['C:/Program Files/Git/bin/bash.exe', ['-n', 'infra/spikes/run-b-demo.sh']]);
}
for (const [command, args] of commands) {
  const r = spawnSync(command, args, { encoding: 'utf8', timeout: 60000, shell: false, windowsHide: true });
  records.push({ command: [command, ...args], exit_code: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.message ?? null });
}
const sha = body => createHash('sha256').update(body).digest('hex');
const files = {};
async function walk(dir = '.') {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, e.name).replaceAll('\\', '/');
    if (['.git', 'node_modules', '.cache', '.tools', '.opensoc', 'artifacts', 'dist', '__pycache__', '.pytest_cache', 'test-results', 'playwright-report'].includes(e.name) || path.startsWith('docs/test-evidence/')) continue;
    if (e.isDirectory()) await walk(path);
    else if (e.isFile()) files[path] = sha(await readFile(path));
  }
}
await walk();
await writeFile('docs/test-evidence/current/scope-commands.json', JSON.stringify({ checked_at: new Date().toISOString(), note: 'Expected exits: preflight A/B=2; release gate=1. bash -n is syntax only, not execution.', commands: records }, null, 2) + '\n');
const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true });
await writeFile('docs/test-evidence/current/source-hashes.json', JSON.stringify({ algorithm: 'SHA256', base_commit: head.status === 0 ? head.stdout.trim() : null, note: 'Uncommitted implementation. Evidence and local runtime/data excluded.', files }, null, 2) + '\n');
for (const r of records) console.log(`${r.command.join(' ')} => ${r.exit_code}`);
