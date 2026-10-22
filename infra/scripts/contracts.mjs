import Ajv2020 from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
const ajv = new Ajv2020({ allErrors: true, strict: true });
const cache = new Map();
export async function validate(name, value) {
  if (!cache.has(name)) {
    if (!/^[a-z-]+$/.test(name)) throw Error('INVALID_CONTRACT_NAME');
    const schema = JSON.parse(await readFile(new URL(`../../docs/contracts/${name}.schema.json`, import.meta.url), 'utf8'));
    cache.set(name, ajv.compile(schema));
  }
  const check = cache.get(name);
  const valid = check(value);
  return { valid, errors: structuredClone(check.errors ?? []) };
}
export function validateSoC(soc) {
  const errors = [];
  const add = (code, id) => errors.push({ code, id });
  const ids = new Set();
  const instances = new Map();
  for (const i of soc.instances) {
    if (ids.has(i.id)) add('DUPLICATE_INSTANCE', i.id);
    ids.add(i.id); instances.set(i.id, i);
    const ports = new Set();
    for (const p of i.interfaces) {
      if (ports.has(p.id)) add('DUPLICATE_INTERFACE', `${i.id}.${p.id}`);
      ports.add(p.id);
      if (!soc.clocks.some(c => c.id === p.clock_domain)) add('UNKNOWN_CLOCK', `${i.id}.${p.id}`);
    }
  }
  const regions = [];
  const regionIds = new Set();
  const limit = 1n << BigInt(soc.address_width);
  for (const r of soc.address_regions) {
    if (regionIds.has(r.id)) add('DUPLICATE_REGION', r.id);
    regionIds.add(r.id);
    if (!instances.has(r.instance_id)) add('UNKNOWN_INSTANCE', r.id);
    const base = BigInt(r.base), size = BigInt(r.size), alignment = BigInt(r.alignment), end = base + size;
    if (size === 0n) add('EMPTY_REGION', r.id);
    if (alignment === 0n || (alignment & (alignment - 1n)) !== 0n || base % alignment !== 0n || size % alignment !== 0n) add('ADDRESS_ALIGNMENT', r.id);
    if (base >= limit || end > limit) add('ADDRESS_OVERFLOW', r.id);
    for (const prev of regions) if (size > 0n && prev.size > 0n && base < prev.end && prev.base < end) add('ADDRESS_OVERLAP', `${prev.id}:${r.id}`);
    regions.push({ ...r, base, size, end });
  }
  const targets = new Set(), edges = new Set();
  for (const edge of soc.connections) {
    if (edges.has(edge.id)) add('DUPLICATE_CONNECTION', edge.id);
    edges.add(edge.id);
    const resolve = e => instances.get(e.instance_id)?.interfaces.find(i => i.id === e.interface_id);
    const a = resolve(edge.from), b = resolve(edge.to);
    if (!a || !b) { add('UNKNOWN_ENDPOINT', edge.id); continue; }
    if (a.role !== 'initiator' || b.role !== 'target') add('ROLE_MISMATCH', edge.id);
    if (a.protocol !== b.protocol || a.data_width !== b.data_width || a.address_width !== b.address_width) add('BUS_MISMATCH', edge.id);
    if (a.clock_domain !== b.clock_domain) add('CLOCK_DOMAIN_MISMATCH', edge.id);
    // M0 supports direct same-protocol validation only. A name is not bridge evidence.
    if (edge.adapter_contract !== 'direct_v1') add('UNVERIFIED_ADAPTER', edge.id);
    const target = `${edge.to.instance_id}.${edge.to.interface_id}`;
    if (targets.has(target)) add('DUPLICATE_TARGET', edge.id);
    targets.add(target);
  }
  return errors;
}
export function toFemtoseconds(ticks, tickFs) {
  if (!/^(0|[1-9][0-9]*)$/.test(ticks) || !/^[1-9][0-9]*$/.test(tickFs)) throw Error('INVALID_SIM_TIME');
  return (BigInt(ticks) * BigInt(tickFs)).toString();
}
export function validateEvidence(ip) {
  const errors = [];
  for (const i of ip.interfaces) {
    if (i.provenance === 'VERIFIED' && !i.evidence_ids.some(id => ip.evidence.some(e => e.id === id && e.level === 'VERIFIED'))) errors.push({ code: 'VERIFIED_WITHOUT_EVIDENCE', id: i.id });
  }
  if (['VALIDATED', 'PUBLISHED'].includes(ip.status) && !ip.evidence.some(e => e.level === 'VERIFIED')) errors.push({ code: 'PROMOTION_WITHOUT_EVIDENCE', id: ip.id });
  return errors;
}
export function validateRunManifest(run) {
  const errors = [];
  if (run.license_status !== 'APPROVED') errors.push({ code: 'LICENSE_NOT_APPROVED' });
  if (run.lane !== 'rtl_standalone' && run.cpu_profile_sha256 === null) errors.push({ code: 'CPU_PROFILE_REQUIRED' });
  if (['rtl_cpu_soc', 'gem5_hybrid'].includes(run.lane) && run.firmware_sha256 === null) errors.push({ code: 'FIRMWARE_REQUIRED' });
  return errors;
}
