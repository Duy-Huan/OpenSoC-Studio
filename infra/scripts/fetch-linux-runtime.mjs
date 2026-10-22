import { mkdir, writeFile, rename } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
const base = 'https://cloud-images.ubuntu.com/daily/server/wsl/releases/noble/current/';
const file = 'ubuntu-noble-wsl-amd64-24.04lts.rootfs.tar.gz';
const sums = await (await fetch(base+'SHA256SUMS')).text();
const expected = sums.split('\n').find(line => line.endsWith(file))?.split(/\s+/)[0];
if (!/^[0-9a-f]{64}$/.test(expected ?? '')) throw Error('Official checksum unavailable');
if (expected !== '2a790896740b14d637dbdc583cce1ba081ac53b9e9cdb46dc09a2f73abbd9934') throw Error('Official rootfs changed from the reviewed pin');
await mkdir('.tools/downloads', {recursive: true});
const response = await fetch(base+file);
if (!response.ok) throw Error(`HTTP ${response.status}`);
const hash = createHash('sha256'); let bytes = 0, last = 0;
await pipeline(Readable.fromWeb(response.body), new Transform({transform(chunk, _, cb) {
  hash.update(chunk); bytes += chunk.length;
  if (bytes-last > 50_000_000) { console.log(`Ubuntu rootfs: ${Math.round(bytes/1e6)} MB`); last = bytes; }
  cb(null, chunk);
}}), createWriteStream('.tools/downloads/ubuntu-rootfs.tar.gz.part'));
const actual = hash.digest('hex');
if (actual !== expected) throw Error('Rootfs digest mismatch');
await rename('.tools/downloads/ubuntu-rootfs.tar.gz.part', '.tools/downloads/ubuntu-rootfs.tar.gz');
await mkdir('docs/test-evidence/runtime', {recursive: true});
await writeFile('docs/test-evidence/runtime/linux-download.json', JSON.stringify({url:base+file, sha256:actual, bytes, checksum_source:base+'SHA256SUMS', signature_verified:false, scope:'Dedicated development WSL; not a certified OS sandbox'}, null, 2)+'\n');
console.log(`Verified Ubuntu rootfs ${actual}`);
