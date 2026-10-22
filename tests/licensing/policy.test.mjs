import test from 'node:test';
import assert from 'node:assert/strict';
import { licenseDecision } from '../../infra/scripts/license-policy.mjs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
for (const license of ['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Apache-2.0']) test(`license allows ${license}`, () => assert.equal(licenseDecision('fixture', license).decision, 'PREFERRED'));
for (const license of [undefined, 'NOASSERTION', 'UNLICENSED', 'Proprietary', 'MIT OR Proprietary', 'LGPL-3.0 OR Proprietary', 'LicenseRef-Unknown', 'BUSL-1.1']) test(`license blocks ${license}`, () => assert.equal(licenseDecision('fixture', license).decision, 'BLOCKED'));
for (const license of ['LGPL-3.0-only', 'EPL-2.0 OR GPL-3.0-or-later', 'MPL-2.0']) test(`license requires review ${license}`, () => assert.equal(licenseDecision('fixture', license).decision, 'REVIEW_REQUIRED'));
test('enterprise package blocked even with claimed MIT', () => assert.equal(licenseDecision('dockview-enterprise', 'MIT').reason, 'BANNED_PACKAGE'));
test('downloaded root license evidence matches pinned SHA256', async () => {
  const lock = JSON.parse(await readFile(new URL('../../docs/compliance/upstream-lock.json', import.meta.url), 'utf8'));
  for (const c of lock.components.filter(c => c.revision)) {
    assert.match(c.revision, /^[0-9a-f]{40}$/);
    assert.ok(c.source_url.includes(c.revision));
    const body = await readFile(new URL(`../../${c.license_file}`, import.meta.url));
    assert.equal(createHash('sha256').update(body).digest('hex'), c.license_sha256, c.name);
  }
});
