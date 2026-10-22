import { mkdir, writeFile } from 'node:fs/promises';
const str = { type: 'string', minLength: 1 };
const integer = { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const positive = { ...integer, minimum: 1 };
const hash = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const revision = { type: 'string', pattern: '^[a-f0-9]{40}$' };
const decimal = { type: 'string', pattern: '^(0|[1-9][0-9]*)$' };
const nonzero = { type: 'string', pattern: '^[1-9][0-9]*$' };
const hex = { type: 'string', pattern: '^0x[0-9a-fA-F]+$' };
const en = (...values) => ({ enum: values });
const array = (items, minItems = 0) => ({ type: 'array', items, minItems });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', additionalProperties: false, properties, required });
const version = { const: '1.0' };
const lane = en('rtl_standalone', 'rtl_cpu_soc', 'gem5_arch', 'gem5_hybrid');
const knowledge = en('EXTRACTED', 'INFERRED', 'REVIEWED', 'VERIFIED', 'UNAVAILABLE');
const confidence = en('EXACT', 'DERIVED', 'UNAVAILABLE');
const source = obj({ repository: str, commit: revision, content_sha256: hash, fileset: array(str, 1), top: str });
const rights = obj({ license_expression: str, redistribution: en('allowed', 'forbidden', 'review_required') });
const intf = obj({ id: str, protocol: en('AXI4-Lite', 'AXI4', 'APB', 'TL-UL', 'TileLink', 'generic_tlm', 'pin'), role: en('initiator', 'target'), data_width: positive, address_width: positive, clock_domain: str, provenance: knowledge, evidence_ids: array(str), adapter_contract: str });
const evidence = obj({ id: str, level: knowledge, claim: str, contract_revision: str, toolchain_sha256: hash, artifact_sha256: hash });
const time = obj({ ticks: decimal, tick_fs: nonzero, origin: str });
const port = obj({ id: str, direction: en('input', 'output', 'inout'), width: positive, provenance: knowledge });
const clock = obj({ id: str, frequency_hz: positive });
const reset = obj({ id: str, clock_domain: str, active_low: { type: 'boolean' }, asynchronous: { type: 'boolean' } });
const ip = obj({ id: { type: 'string', pattern: '^[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+:[0-9]+\\.[0-9]+\\.[0-9]+$' }, display_name: str, source, rights, ports: array(port), interfaces: array(intf), clocks: array(clock), resets: array(reset), evidence: array(evidence), status: en('DRAFT', 'REVIEWED', 'VALIDATED', 'PUBLISHED') });
const endpoint = obj({ instance_id: str, interface_id: str });
const soc = obj({ schema_version: version, id: str, project_id: str, revision: integer, address_width: { type: 'integer', minimum: 1, maximum: 128 }, lane,
  instances: array(obj({ id: str, ip_id: str, interfaces: array(intf) })),
  address_regions: array(obj({ id: str, instance_id: str, base: hex, size: hex, alignment: hex })),
  connections: array(obj({ id: str, from: endpoint, to: endpoint, adapter_contract: str })),
  clocks: array(clock), resets: array(reset) });
const schemas = {
  chm: obj({ schema_version: version, project_id: str, source_revisions: array(source), ip_definitions: array(ip), soc_configs: array(soc) }),
  'ip-package': obj({ schema_version: version, ip, dependencies: array(obj({ ip_id: str, content_sha256: hash })), license_audit: en('REVIEW_REQUIRED', 'APPROVED', 'REJECTED') }),
  'soc-config': soc,
  'cpu-profile': obj({ schema_version: version, id: str, provider: str, supplier: str, source, isa: str, xlen: en(32, 64), privileged_ext: array(str), interfaces: array(intf),
    boot: obj({ entry: hex, load_base: hex, memory_size: hex, firmware_formats: array(en('elf', 'vmem', 'bin'), 1) }),
    lanes: array(obj({ lane, status: en('SUPPORTED', 'EXPERIMENTAL', 'UNSUPPORTED'), reason: str, evidence_ids: array(str) }), 1),
    generator_config_sha256: hash, rights }),
  'run-manifest': obj({ schema_version: version, run_id: str, project_id: str, project_snapshot_sha256: hash, lane,
    ip_lock: array(obj({ ip_id: str, content_sha256: hash })), board_config_sha256: hash,
    cpu_profile_sha256: { anyOf: [hash, { type: 'null' }] }, firmware_sha256: { anyOf: [hash, { type: 'null' }] },
    scenario_sha256: hash, adapter_sha256: array(hash), toolchain_image: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
    seed: decimal, time_resolution_fs: nonzero,
    trace: obj({ format: en('fst', 'vcd', 'ghw', 'none'), signal_ids: array(str) }),
    resources: obj({ cpus: positive, memory_mb: positive, disk_mb: positive, pids: positive, wall_time_s: positive, network: { const: 'disabled' } }),
    ai_policy: { const: 'NO_AI' }, license_status: en('APPROVED', 'REVIEW_REQUIRED', 'REJECTED') }),
  'trace-event': obj({ schema_version: version, run_id: str, event_id: str, seq: integer,
    event_kind: en('MMIO_WRITE', 'MMIO_READ', 'TRANSACTION_BEGIN', 'TRANSACTION_END', 'ASSERTION', 'RESET', 'FIRMWARE_EXIT'),
    producer: str, sim_time: time, clock_domain: str, rtl_cycle: { anyOf: [decimal, { type: 'null' }] },
    instance_id: str, address: hex, transaction_id: str, correlation: obj({ kind: en('INSTRUMENTED', 'DECODED', 'UNAVAILABLE'), confidence }),
    write_data: hex, read_data: hex, byte_enable: hex, hierarchy_path: { anyOf: [str, { type: 'null' }] }, source_ref: { anyOf: [str, { type: 'null' }] } },
    ['schema_version', 'run_id', 'event_id', 'seq', 'event_kind', 'producer', 'sim_time', 'clock_domain', 'rtl_cycle', 'instance_id', 'transaction_id', 'correlation']),
  selection: obj({ schemaVersion: version, projectId: str, runId: str, ipInstanceId: str, hierarchyPath: str, signalId: str,
    sourceLocation: obj({ fileId: str, line: positive, column: positive }, ['fileId', 'line']),
    transactionId: str, simTime: obj({ ticks: decimal, timescaleFs: nonzero, domain: str }, ['ticks', 'timescaleFs']), originId: str, evidenceLevel: confidence },
    ['schemaVersion', 'projectId', 'originId', 'evidenceLevel']),
};
await mkdir('docs/contracts', { recursive: true });
for (const [name, schema] of Object.entries(schemas)) {
  await writeFile(`docs/contracts/${name}.schema.json`, JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `https://opensoc.local/contracts/1.0/${name}.schema.json`, title: `OpenSoC ${name} 1.0 DRAFT`, ...schema }, null, 2) + '\n');
}
console.log(`Generated ${Object.keys(schemas).length} draft contracts`);
