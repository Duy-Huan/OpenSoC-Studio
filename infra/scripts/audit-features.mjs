import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const lock = JSON.parse(await readFile('docs/compliance/upstream-lock.json', 'utf8'));
const requests = [
  ['ibex', 'examples/simple_system/README.md', ['fusesoc', 'hello_test', '--meminit', 'trace_core']],
  ['gem5', 'util/tlm/README', ['Gem5SlaveTransactor', 'libgem5_opt.so', 'pthread', 'tcmalloc']],
  ['systemc', 'README.md', ['SystemC']],
  ['wellen', 'Cargo.toml', ['rust-version', 'license']],
  ['rohd-wave', 'README.md', ['Flutter']],
  ['rohd-schematic', 'README.md', ['schematic']],
  ['slang', 'README.md', ['SystemVerilog']],
  ['fusesoc', 'README.md', ['FuseSoC']],
  ['chipyard', 'README.md', ['Chipyard']],
  ['opentitan', 'README.md', ['OpenTitan']],
];
const results = [];
for (const [name, file, markers] of requests) {
  const p = lock.components.find(c => c.name === name);
  const url = `${p.repository.replace('https://github.com/', 'https://raw.githubusercontent.com/')}/${p.revision}/${file}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    const body = await r.text();
    const checks = markers.map(marker => ({ marker, found: body.toLowerCase().includes(marker.toLowerCase()) }));
    results.push({ name, revision: p.revision, url, sha256: createHash('sha256').update(body).digest('hex'), checks, status: checks.every(c => c.found) ? 'SOURCE_MARKERS_FOUND' : 'MANUAL_REVIEW_REQUIRED' });
    console.log(`${name}: ${results.at(-1).status}`);
    // Print only feature lines for reviewer; never treats documentation as runtime proof.
    console.log(body.split('\n').filter(line => /work.in.progress|rust-version|version =|SystemC 2|SystemC 3|SYSTEMC_HOME|LGPL|Artistic/i.test(line)).slice(0, 15).join('\n'));
  } catch (e) { results.push({ name, url, status: 'UNVERIFIED', error: e.message }); }
}
await writeFile('docs/compliance/upstream-feature-evidence.json', JSON.stringify({ checked_at: new Date().toISOString(), scope: 'Documentation/source inspection, NOT runtime compatibility', results }, null, 2) + '\n');
process.exitCode = results.some(r => r.status === 'UNVERIFIED') ? 1 : 0;
