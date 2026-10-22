import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Public upstream metadata only. No user RTL, credentials or project sources leave host.
const repos = [
  ['ibex', 'lowRISC/ibex', 'master', 'LICENSE'],
  ['gem5', 'gem5/gem5', 'v24.1.0.3', 'LICENSE'],
  ['systemc', 'accellera-official/systemc', '3.0.1', 'LICENSE'],
  ['verilator', 'verilator/verilator', 'v5.032', 'LICENSE'],
  ['fusesoc', 'olofk/fusesoc', 'main', 'LICENSE'],
  ['edalize', 'olofk/edalize', 'main', 'LICENSE'],
  ['slang', 'MikePopoloski/slang', 'master', 'LICENSE'],
  ['yosys', 'YosysHQ/yosys', 'main', 'COPYING'],
  ['wellen', 'ekiwi/wellen', 'main', 'LICENSE'],
  ['rohd-schematic', 'intel/rohd-schematic-viewer', 'main', 'LICENSE'],
  ['rohd-wave', 'intel/rohd-wave-viewer', 'main', 'LICENSE'],
  ['chipyard', 'ucb-bar/chipyard', 'main', 'LICENSE'],
  ['opentitan', 'lowRISC/opentitan', 'master', 'LICENSE'],
  ['dockview', 'dockview/dockview', 'master', 'LICENSE'],
  ['react-flow', 'xyflow/xyflow', 'main', 'LICENSE'],
];
const sha256 = data => createHash('sha256').update(data).digest('hex');
async function get(url, json = true) {
  const r = await fetch(url, { headers: { 'User-Agent': 'OpenSoC-M0-audit', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw Error(`${r.status}: ${url}`);
  return json ? r.json() : r.text();
}
await mkdir('docs/compliance/license-evidence', { recursive: true });
const components = [];
// Sequential to avoid GitHub anonymous API burst limits; bounded timeout per request.
for (const [name, repo, ref, licensePath] of repos) {
  const record = { name, repository: `https://github.com/${repo}`, requested_ref: ref, status: 'UNVERIFIED', transitive_audit: 'NOT_EXECUTED' };
  try {
    const commit = await get(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`);
    record.revision = commit.sha;
    record.source_url = `${record.repository}/tree/${commit.sha}`;
    let license;
    try {
      license = await get(`https://api.github.com/repos/${repo}/license?ref=${commit.sha}`);
    } catch {
      license = { path: licensePath, license: { spdx_id: 'NOASSERTION' } };
    }
    record.license_expression = license.license?.spdx_id ?? 'NOASSERTION';
    record.license_url = `https://raw.githubusercontent.com/${repo}/${commit.sha}/${license.path}`;
    const body = await get(record.license_url, false);
    record.license_sha256 = sha256(body);
    record.license_file = `docs/compliance/license-evidence/${name}.txt`;
    await writeFile(record.license_file, body);
    record.status = 'PINNED_ROOT_LICENSE_ONLY';
  } catch (e) { record.error = e.message; }
  components.push(record);
  console.log(`${name}: ${record.status} ${record.revision ?? ''}`);
}
const npmNames = ['react', 'dockview-react', '@xyflow/react', 'monaco-editor', 'elkjs', 'ajv'];
for (const name of npmNames) {
  try {
    const version = name === 'ajv' ? '8.17.1' : 'latest';
    const p = await get(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`);
    components.push({ name, version: p.version, license_expression: p.license ?? 'NOASSERTION', source_url: p.repository?.url,
      integrity: p.dist?.integrity, status: 'REGISTRY_METADATA_ONLY', transitive_audit: 'NOT_EXECUTED', installed: name === 'ajv' });
    console.log(`${name}: ${p.version} ${p.license}`);
  } catch (e) { components.push({ name, status: 'UNVERIFIED', error: e.message }); }
}
await writeFile('docs/compliance/upstream-lock.json', JSON.stringify({ schema_version: '1.0', checked_at: new Date().toISOString(), purpose: 'M0 research pins; NOT a tested toolchain lock', components }, null, 2) + '\n');
if (components.some(c => c.status === 'UNVERIFIED')) process.exitCode = 1;
