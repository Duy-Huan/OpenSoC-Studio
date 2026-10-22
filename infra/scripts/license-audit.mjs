import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { licenseDecision } from './license-policy.mjs';
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const lock = await read('package-lock.json');
const root = await read('package.json');
const components = [];
const notices = [];
const skipped = [];
for (const [path, pkg] of Object.entries(lock.packages)) {
  if (!path) continue;
  let installed;
  try { installed = await read(`${path}/package.json`); }
  catch (e) { if (e.code === 'ENOENT' && pkg.optional) { skipped.push({ path, version: pkg.version, reason: 'OPTIONAL_PLATFORM_PACKAGE_NOT_INSTALLED' }); continue; } throw e; }
  const name = installed.name;
  const expression = installed.license;
  const policy = licenseDecision(name, expression);
  if (name === 'dompurify' && expression === '(MPL-2.0 OR Apache-2.0)') {
    policy.decision = 'PREFERRED'; policy.reason = 'APACHE_2_ALTERNATIVE_SELECTED';
  }
  if (name === 'caniuse-lite' && expression === 'CC-BY-4.0') {
    policy.decision = 'PREFERRED'; policy.reason = 'BUILD_TIME_DATA_ATTRIBUTION_RETAINED';
  }
  if (installed.version !== pkg.version || expression !== pkg.license) throw Error(`LOCK_MISMATCH: ${path}`);
  // Include exact installed license text, not just registry declarations.
  const { readdir } = await import('node:fs/promises');
  let licenseFiles = (await readdir(path)).filter(f => /^(licen[cs]e|copying)(\.|-|$)/i.test(f)).map(file => ({ file, path: `${path}/${file}` }));
  const parentPath = name.startsWith('@esbuild/') ? 'node_modules/esbuild' : name.startsWith('@rollup/rollup-') ? 'node_modules/rollup' : null;
  if (!licenseFiles.length && parentPath) {
    const parent = await read(`${parentPath}/package.json`);
    if (parent.version === pkg.version && parent.license === expression) {
      licenseFiles = (await readdir(parentPath)).filter(f => /^(licen[cs]e|copying)(\.|-|$)/i.test(f)).map(file => ({ file: `${parent.name}/${file}`, path: `${parentPath}/${file}` }));
      policy.reason = 'MATCHING_VERSION_NATIVE_PACKAGE_PARENT_LICENSE_RETAINED';
    }
  }
  if (!licenseFiles.length) { policy.decision = 'BLOCKED'; policy.reason = 'MISSING_LICENSE_TEXT'; }
  const licenseEvidence = [];
  for (const entry of licenseFiles) {
    const body = await readFile(entry.path, 'utf8');
    licenseEvidence.push({ file: entry.file, source_path: entry.path, sha256: createHash('sha256').update(body).digest('hex') });
    notices.push(`## ${name}@${pkg.version} — ${entry.file}\n\n${body}`);
  }
  components.push({ name, version: pkg.version, path, license_expression: expression, resolved: pkg.resolved, integrity: pkg.integrity, license_evidence: licenseEvidence, ...policy });
}
const release = process.argv.includes('--release');
const blockers = components.filter(p => p.decision !== 'PREFERRED').map(p => `${p.name}: ${p.reason}`);
if (release) {
  if (root.license === 'UNLICENSED') blockers.push('PROJECT_LICENSE_NOT_SELECTED');
  blockers.push('M0_FEASIBILITY_GATES_OPEN', 'PRODUCT_TRANSITIVE_AUDIT_NOT_EXECUTED', 'SIGNED_RELEASE_MANIFEST_MISSING');
}
await mkdir('sbom', { recursive: true });
await mkdir('docs/test-evidence/M0', { recursive: true });
const report = { schema_version: '1.0', scope: 'Installed npm workbench/runtime and development dependencies only; excludes OS/tools/Python', generated_at: new Date().toISOString(), mode: release ? 'release' : 'development', status: blockers.length ? 'BLOCKED' : 'PASS', components, skipped, blockers };
await mkdir('docs/test-evidence/current', { recursive: true });
await writeFile(`docs/test-evidence/current/license-${release ? 'release' : 'development'}.json`, JSON.stringify(report, null, 2) + '\n');
const bom = { bomFormat: 'CycloneDX', specVersion: '1.5', version: 1, metadata: { component: { type: 'application', name: root.name, version: root.version } }, components: components.map(p => ({ type: 'library', name: p.name, version: p.version, purl: `pkg:npm/${p.name}@${p.version}`, licenses: [{ expression: p.name === 'dompurify' ? 'Apache-2.0' : p.license_expression }], externalReferences: [{ type: 'distribution', url: p.resolved }] })) };
await writeFile('sbom/workbench-npm.cdx.json', JSON.stringify(bom, null, 2) + '\n');
await writeFile('THIRD_PARTY_NOTICES.md', '# Installed npm dependency notices\n\nOnly npm packages in `sbom/workbench-npm.cdx.json` are included below. Research upstream licenses are retained under `docs/compliance/license-evidence/`. DOMPurify uses the offered Apache-2.0 alternative; no MPL integration is selected. Python/image/toolchains require separate audit. No full-product compliance claim.\n\n' + notices.join('\n\n') + '\n');
console.log(`${report.status}: ${components.length} installed dependencies audited (${report.mode})`);
for (const b of blockers) console.log(`BLOCKED: ${b}`);
process.exitCode = blockers.length ? 1 : 0;
