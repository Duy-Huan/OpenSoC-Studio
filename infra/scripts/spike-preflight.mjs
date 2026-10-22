import { collect } from './doctor.mjs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const spike = process.argv[2];
if (!['A', 'B'].includes(spike)) throw Error('Usage: node infra/scripts/spike-preflight.mjs A|B');
const env = collect();
const required = spike === 'A' ? ['python', 'verilator', 'fusesoc', 'g++', 'riscv32-unknown-elf-gcc'] : ['python', 'scons', 'g++', 'cmake'];
const blockers = env.probes.filter(p => required.includes(p.name ?? p.command[0]) && p.status !== 'AVAILABLE').map(p => `MISSING_TOOL:${p.name ?? p.command[0]}`);
if (env.platform !== 'linux') blockers.push('LINUX_SANDBOX_WORKER_NOT_CONFIGURED');
const lock = JSON.parse(await readFile('docs/compliance/upstream-lock.json', 'utf8'));
const report = { schema_version: '1.0', spike, checked_at: new Date().toISOString(), execution_status: 'NOT_EXECUTED', preflight_status: blockers.length ? 'BLOCKED' : 'READY_FOR_MANUAL_REVIEW',
  blockers, source_pins: lock.components.filter(c => (spike === 'A' ? ['ibex', 'verilator', 'fusesoc'] : ['gem5', 'systemc']).includes(c.name)),
  note: 'Preflight never executes imported RTL or grants PASS. Follow docs/reference-platforms/SPIKES.md in a verified isolated worker. gcc prefix can be configured in upstream common.mk; this inventory checks the selected prefix only.' };
await mkdir('docs/test-evidence/current', { recursive: true });
await writeFile(`docs/test-evidence/current/spike-${spike}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(`${spike}: ${report.preflight_status}; simulation ${report.execution_status}`);
for (const b of blockers) console.log(b);
process.exitCode = blockers.length ? 2 : 0;
