import test from 'node:test';
import assert from 'node:assert/strict';
import { validate, validateSoC, validateEvidence, validateRunManifest, toFemtoseconds } from '../../infra/scripts/contracts.mjs';
import { samples, makeSoc, makeIp, makeRun, makeTrace } from './fixtures.mjs';
for (const [name, sample] of Object.entries(samples())) {
  test(`${name}: accepts version 1.0 draft fixture`, async () => assert.deepEqual(await validate(name, sample), { valid: true, errors: [] }));
  test(`${name}: rejects unknown schema version`, async () => {
    const copy = structuredClone(sample); copy[name === 'selection' ? 'schemaVersion' : 'schema_version'] = '2.0';
    assert.equal((await validate(name, copy)).valid, false);
  });
  test(`${name}: rejects undeclared fields`, async () => assert.equal((await validate(name, { ...sample, unexpected: true })).valid, false));
}
test('SoC: valid half-open adjacent ranges do not overlap', () => {
  const s = makeSoc(); s.address_regions.push({ ...s.address_regions[0], id: 'next', base: '0x2000' });
  assert.deepEqual(validateSoC(s), []);
});
const socCases = [
  ['overlap', 'ADDRESS_OVERLAP', s => s.address_regions.push({ ...s.address_regions[0], id: 'overlap' })],
  ['overflow', 'ADDRESS_OVERFLOW', s => s.address_regions[0].base = '0xfffff000' /* valid last page, enlarge below */],
  ['alignment', 'ADDRESS_ALIGNMENT', s => s.address_regions[0].base = '0x1001'],
  ['zero size', 'EMPTY_REGION', s => s.address_regions[0].size = '0x0'],
  ['zero alignment', 'ADDRESS_ALIGNMENT', s => s.address_regions[0].alignment = '0x0'],
  ['non-power-of-two alignment', 'ADDRESS_ALIGNMENT', s => s.address_regions[0].alignment = '0x3'],
  ['unknown instance', 'UNKNOWN_INSTANCE', s => s.address_regions[0].instance_id = 'missing'],
  ['duplicate instance', 'DUPLICATE_INSTANCE', s => s.instances.push(structuredClone(s.instances[0]))],
  ['unknown endpoint', 'UNKNOWN_ENDPOINT', s => s.connections[0].from.interface_id = 'missing'],
  ['role mismatch', 'ROLE_MISMATCH', s => s.instances[0].interfaces[0].role = 'target'],
  ['width mismatch', 'BUS_MISMATCH', s => s.instances[1].interfaces[0].data_width = 64],
  ['protocol mismatch', 'BUS_MISMATCH', s => s.instances[1].interfaces[0].protocol = 'APB'],
  ['clock mismatch', 'CLOCK_DOMAIN_MISMATCH', s => s.instances[1].interfaces[0].clock_domain = 'other'],
  ['unverified adapter', 'UNVERIFIED_ADAPTER', s => s.connections[0].adapter_contract = 'invented_bridge'],
  ['duplicate target', 'DUPLICATE_TARGET', s => s.connections.push({ ...s.connections[0], id: 'duplicate' })],
];
for (const [name, code, mutate] of socCases) test(`SoC rejects ${name}`, () => {
  const s = makeSoc(); mutate(s);
  if (name === 'overflow') s.address_regions[0].size = '0x2000';
  assert.ok(validateSoC(s).some(e => e.code === code));
});
test('SoC: 64-bit address comparison preserves integer precision', () => {
  const s = makeSoc(); s.address_width = 64;
  s.address_regions[0] = { id: 'r0', instance_id: 'ram', base: '0x20000000000001', size: '0x1', alignment: '0x1' };
  s.address_regions.push({ ...s.address_regions[0], id: 'r1', base: '0x20000000000002' });
  assert.deepEqual(validateSoC(s), []);
});
test('sim time: precision beyond JS Number', () => assert.equal(toFemtoseconds('9007199254740993', '1000'), '9007199254740993000'));
for (const [t, scale] of [['-1', '1'], ['1', '0'], ['1.5', '1'], ['1e3', '1']]) test(`sim time rejects ${t}/${scale}`, () => assert.throws(() => toFemtoseconds(t, scale), /INVALID_SIM_TIME/));
test('trace rejects numeric simulation timestamp', async () => { const t = makeTrace(); t.sim_time.ticks = 9007199254740992; assert.equal((await validate('trace-event', t)).valid, false); });
test('VERIFIED interface cannot use inferred/unrelated evidence', () => {
  const p = makeIp().ip; p.interfaces[0].provenance = 'VERIFIED'; p.interfaces[0].evidence_ids = ['missing'];
  assert.ok(validateEvidence(p).some(e => e.code === 'VERIFIED_WITHOUT_EVIDENCE'));
});
test('publication requires scoped verified evidence', () => { const p = makeIp().ip; p.status = 'PUBLISHED'; assert.ok(validateEvidence(p).some(e => e.code === 'PROMOTION_WITHOUT_EVIDENCE')); });
test('run: AI disabled and no network is valid contract', async () => assert.equal((await validate('run-manifest', makeRun())).valid, true));
test('run: enabled outbound network rejected', async () => { const r = makeRun(); r.resources.network = 'enabled'; assert.equal((await validate('run-manifest', r)).valid, false); });
test('run: mutable toolchain tag rejected', async () => { const r = makeRun(); r.toolchain_image = 'worker:latest'; assert.equal((await validate('run-manifest', r)).valid, false); });
test('run: missing CPU/firmware for RTL CPU lane rejected', () => { const r = makeRun(); r.lane = 'rtl_cpu_soc'; assert.equal(validateRunManifest(r).length, 2); });
test('run: unapproved license rejected', () => { const r = makeRun(); r.license_status = 'REVIEW_REQUIRED'; assert.equal(validateRunManifest(r)[0].code, 'LICENSE_NOT_APPROVED'); });
