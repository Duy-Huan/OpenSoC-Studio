import { readFile, writeFile } from 'node:fs/promises';
import { licenseDecision } from './license-policy.mjs';
const lock = JSON.parse(await readFile('docs/compliance/upstream-lock.json', 'utf8'));
const lines = [
  '# Initial dependency / license matrix', '',
  'Generated from public metadata and pinned license evidence. Research pins are not a tested dependency lock. Only Ajv and its npm transitives are installed for M0. No row constitutes redistribution approval.', '',
  '| Component | Exact pin | Root reported SPDX | Policy | Evidence |',
  '|---|---|---|---|---|',
];
for (const c of lock.components) {
  const policy = licenseDecision(c.name, c.license_expression);
  lines.push(`| ${c.name} | ${c.revision ? `[${c.revision}](${c.source_url})` : c.version ?? 'UNKNOWN'} | ${c.license_expression ?? 'NOASSERTION'} | ${policy.decision} | ${c.license_file ? `[saved root license](license-evidence/${c.name}.txt)` : 'Registry metadata only; package text/transitives not audited'} |`);
}
lines.push('', 'Interpretation:', '',
  '- gem5 root BSD-style text, Chipyard root BSD-3-Clause text and Dockview mixed monorepo text are saved; metadata NOASSERTION stays blocked until scoped manual review. Do not classify the whole Dockview repository as MIT.',
  '- Verilator applicable dual-license terms require reviewing the pinned COPYING/ARTISTIC and generated/runtime files; GitHub root LICENSE metadata alone reports LGPL-3.0.',
  '- ELK.js is conditional, not permissive-only. It is not installed or approved.',
  '- SystemC NOTICE, all git submodules, generated artifacts, firmware toolchain/runtime, OS image, fonts, icons and model weights remain unaudited.',
  '- FastAPI/Pydantic/Uvicorn/SQLite/PostgreSQL are architecture candidates; exact Python/package/build pins and license closure remain NOT_SELECTED/NOT_AUDITED before M1.',
  '- Full installed M0 development closure: [CycloneDX](../../sbom/m0-development.cdx.json), [actual audit report](../test-evidence/M0/license-development.json), [license texts](../../THIRD_PARTY_NOTICES.md).',
  '- Project code license is UNLICENSED pending owner selection, so no 100% OSS or release-compliant claim is made.', '');
await writeFile('docs/compliance/DEPENDENCY_LICENSE_MATRIX.md', lines.join('\n'));
