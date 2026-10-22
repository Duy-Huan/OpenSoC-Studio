// Synthetic schema fixtures only. These are never simulation outputs or vendor provenance.
import { createHash } from 'node:crypto';
export const hash = createHash('sha256').update('OpenSoC synthetic contract fixture').digest('hex');
export const source = { repository: 'fixture://schema-test', commit: '0'.repeat(40), content_sha256: hash, fileset: ['fixture.sv'], top: 'test_top' };
export const rights = { license_expression: 'MIT', redistribution: 'allowed' };
export const bus = (id, role) => ({ id, protocol: 'AXI4-Lite', role, data_width: 32, address_width: 32, clock_domain: 'core', provenance: 'INFERRED', evidence_ids: [], adapter_contract: 'direct_v1' });
export const makeSoc = () => ({ schema_version: '1.0', id: 'schema-fixture', project_id: 'fixture-project', revision: 0, address_width: 32, lane: 'rtl_standalone',
  instances: [{ id: 'driver', ip_id: 'fixture:bus:driver:1.0.0', interfaces: [bus('out', 'initiator')] }, { id: 'ram', ip_id: 'fixture:memory:ram:1.0.0', interfaces: [bus('in', 'target')] }],
  address_regions: [{ id: 'ram-region', instance_id: 'ram', base: '0x1000', size: '0x1000', alignment: '0x1000' }],
  connections: [{ id: 'c0', from: { instance_id: 'driver', interface_id: 'out' }, to: { instance_id: 'ram', interface_id: 'in' }, adapter_contract: 'direct_v1' }], clocks: [{ id: 'core', frequency_hz: 100000000 }], resets: [] });
export const makeIp = () => ({ schema_version: '1.0', ip: { id: 'fixture:bus:register:1.0.0', display_name: 'Schema fixture', source, rights, ports: [], interfaces: [bus('in', 'target')], clocks: [{ id: 'core', frequency_hz: 100000000 }], resets: [], evidence: [], status: 'DRAFT' }, dependencies: [], license_audit: 'REVIEW_REQUIRED' });
export const makeRun = () => ({ schema_version: '1.0', run_id: 'fixture-run', project_id: 'fixture-project', project_snapshot_sha256: hash, lane: 'rtl_standalone', ip_lock: [], board_config_sha256: hash, cpu_profile_sha256: null, firmware_sha256: null, scenario_sha256: hash, adapter_sha256: [], toolchain_image: `sha256:${hash}`, seed: '0', time_resolution_fs: '1', trace: { format: 'fst', signal_ids: [] }, resources: { cpus: 1, memory_mb: 1024, disk_mb: 1024, pids: 64, wall_time_s: 300, network: 'disabled' }, ai_policy: 'NO_AI', license_status: 'APPROVED' });
export const makeTrace = () => ({ schema_version: '1.0', run_id: 'fixture-run', event_id: 'fixture-event', seq: 0, event_kind: 'MMIO_WRITE', producer: 'schema-fixture', sim_time: { ticks: '9007199254740993', tick_fs: '1000', origin: 'simulation_zero' }, clock_domain: 'core', rtl_cycle: null, instance_id: 'ram', transaction_id: 'fixture-txn', correlation: { kind: 'UNAVAILABLE', confidence: 'UNAVAILABLE' } });
export const samples = () => ({
  'soc-config': makeSoc(), 'ip-package': makeIp(), 'run-manifest': makeRun(), 'trace-event': makeTrace(),
  selection: { schemaVersion: '1.0', projectId: 'fixture-project', originId: 'test', evidenceLevel: 'UNAVAILABLE' },
  chm: { schema_version: '1.0', project_id: 'fixture-project', source_revisions: [source], ip_definitions: [makeIp().ip], soc_configs: [makeSoc()] },
  'cpu-profile': { schema_version: '1.0', id: 'fixture-cpu', provider: 'fixture', supplier: 'test', source, isa: 'RV32IMC', xlen: 32, privileged_ext: ['M'], interfaces: [], boot: { entry: '0x100080', load_base: '0x100000', memory_size: '0x100000', firmware_formats: ['elf'] }, lanes: [{ lane: 'rtl_cpu_soc', status: 'UNSUPPORTED', reason: 'Synthetic schema fixture; not a real CPU profile', evidence_ids: [] }], generator_config_sha256: hash, rights },
});
