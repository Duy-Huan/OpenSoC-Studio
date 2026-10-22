import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = [
  ['https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip', '.tools/python.zip'],
  ['https://bootstrap.pypa.io/get-pip.py', '.tools/get-pip.py'],
];
await mkdir('.tools', { recursive: true });
const evidence = [];
let previous;
try { previous = JSON.parse(await readFile('docs/compliance/python-bootstrap.json', 'utf8')); } catch {}
for (const [url, path] of files) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw Error(`HTTP ${r.status}: ${url}`);
  const bytes = Buffer.from(await r.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const expected = previous?.files.find(f => f.url === url)?.sha256;
  if (expected && expected !== sha256) throw Error(`Bootstrap input changed at ${url}; review before refreshing the recorded hash.`);
  await writeFile(path, bytes);
  evidence.push({ url, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const pins = { fastapi: '0.159.1', pyslang: '12.0.0' };
for (const name of previous ? [] : ['uvicorn', 'websockets', 'pytest', 'httpx', 'jsonschema']) {
  const r = await fetch(`https://pypi.org/pypi/${name}/json`);
  if (!r.ok) throw Error(`PyPI ${r.status}`);
  const data = await r.json(); pins[name] = data.info.version;
}
await mkdir('apps/api', { recursive: true });
if (!previous) {
  await writeFile('apps/api/requirements.in', Object.entries(pins).map(([n, v]) => `${n}==${v}`).join('\n') + '\n');
  await writeFile('docs/compliance/python-bootstrap.json', JSON.stringify({ checked_at: new Date().toISOString(), purpose: 'Workspace-local development runtime; PSF license and full dependency audit required before redistribution', files: evidence, direct_pins: pins }, null, 2) + '\n');
}
console.log(pins);
