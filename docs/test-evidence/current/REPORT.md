# Continuous milestone delivery — OpenSoC Studio

Date: **2026-10-22 / Asia-Saigon**. Build version: **0.2.0 development**, target architecture V1.0. User authorized proceeding across milestones without per-milestone approval; see ADR-005. **Overall STATE: PARTIAL.** Eight experimental runtime profiles now execute actual native workflows from UI/API; [16-case native acceptance](../runtime/REPORT.md), [ADR-008](../../decisions/ADR-008-engine-runtime.md). Full V1.0 release is not complete.

## Deliverables

The repository now has an actual local engineering application:

- `apps/web`: strict TypeScript React workbench with Dockview OSS docking/persisted layout, lazy local Monaco/SystemVerilog editor, source tree/hierarchy/port inspector, console/problems, command palette, IP registry, React Flow SoC Composer and firmware inspector. No cloud CDN/fonts/models or decorative simulation output.
- `apps/api`: FastAPI modular application, SQLite WAL documents/events, immutable content-addressed source/analysis artifacts, bounded out-of-process pyslang analysis with compiler diagnostics and exact source locations. Loopback Host/Origin and mutation-header checks, file/archive guards, cancellation and nonterminal-run restart recovery.
- Source revisions retain file hashes, exact ordered fileset, parent provenance. Analysis manifest pins snapshot, top, worker source hash, tool/Python version and limits. A repeated actual analysis produces the same manifest/artifact hashes.
- IP draft/review/reuse stores immutable content pins and explicit rights; publication remains blocked when simulator/protocol evidence is absent. Reviewed metadata is not VERIFIED behavior.
- SoC model is committed only after backend validation with ETag revision checks. Layout positions remain view state. Snapshots enter revision history; invalid MMIO overlap is shown on node/region and not committed.
- ELF32 RISC-V header/ABI/LOAD/entry checks use the pinned Ibex Simple System memory/boot contract. Images are hashed and retained, with `boot_verified=false` and `simulation_executed=false`.
- Workspace-local CPython 3.12.10, exact Python versions and Windows wheel hashes, npm lockfile, generated implemented OpenAPI + TypeScript request schemas, npm/Python SBOM and license evidence, CI definitions and reproducible local verification commands.
- Engine Runtime: project-scoped queue/history/cancel/events, real firmware/native builds, Icarus/Verilator/Yosys/SystemC/gem5 execution, independent oracles and hashed artifacts. Ibex uses FuseSoC/Edalize. Wellen reads actual VCD/FST in bounded windows with selected signal IDs and cursor values. Dedicated workspace-backed WSL toolchain, exact OS/Python/tool inventory, 37 hashed wheels and local offline Python resolution.

Two original user design documents remain unchanged. Historical M0 evidence is retained; it is not retroactively converted into runtime acceptance. All later work and remaining scope: [milestone status](../../implementation/STATUS.md). Draft contract refinements and security/license choices: [ADR-006](../../decisions/ADR-006-local-contracts.md).

## Commands and actual results

The final combined command **`npm.cmd run verify` exited 0**. Complete stdout/stderr and exit codes: [verification.json](verification.json).

| Check | Actual outcome | Scope |
|---|---|---|
| TypeScript strict + Vite 7.3.7 production build | PASS | Workbench bundle generated; Monaco lazy editor chunk remains about 2.73 MB uncompressed / 709 KB gzip |
| Node contract/license tests | **69 PASS** | Schemas, MMIO/bus/integer-time/evidence/license rules |
| FastAPI/SQLite/pyslang + runtime integration | **53 PASS** | Existing workflows, runtime input/path/hash boundaries and TLM trace corruption/order checks |
| Playwright + real backend | **8 PASS** | Existing flows plus UI native SystemC/Yosys/Ibex builds, FST/Wellen signal/time/cursor |
| Native PicoRV32 CPU RTL | **7 cases meet expectations** | 6 positive simulations and 1 deliberately corrupted firmware correctly detected; separate native JUnit |
| Eight engine runtime profiles | **16 cases meet expectations** | Actual HTTP→native baseline/negative matrix; one Ibex negative is loader rejection before CPU execution |
| npm license/text audit | PASS for **106 installed packages** | Optional absent-platform packages listed separately; this is not whole-product release approval |
| Python wheel audit | **REVIEW_REQUIRED**, 31 package pins | Runtime/test scopes and unresolved licenses/evidence recorded; not full legal/per-file audit |
| npm registry security audit | **0 reported vulnerabilities** | Checked after dependency fixes; not a general security certification |
| Legacy M0 Spike A/B preflight snapshot | Historical **BLOCKED**, exits 2 | Superseded for current native availability by dedicated WSL/runtime evidence |
| Legacy external spike shell scripts | Syntax PASS; external util/tlm NOT_EXECUTED | Actual Ibex and internal gem5/SystemC proofs use the new runtime workflows |
| Release gate | **BLOCKED**, exit 1 | Project license, native feasibility, full dependency/image/firmware closure and release signing unresolved |

Total executed automated tests in combined verification: **130 passing tests** across Node/API/browser; native runtime has **16 separate workflow cases**, plus prior 7-case PicoRV32 regression. Do not sum these into a CPU sign-off count. [Ibex stages](../runtime/ibex-workbench.png), [Ibex waveform](../runtime/ibex-waveform.png), [Yosys/Wellen UI](../runtime/workbench.png), [native JUnit](../runtime/api-acceptance.xml).

An earlier browser attempt hit `net::ERR_NO_BUFFER_SPACE` at navigation. The isolated case and final full suite subsequently passed. The current API test run has a Starlette httpx deprecation warning. Linux remote CI is configured but has not executed; neither portability nor native hardware acceptance is inferred from its YAML.

## Blueprint acceptance mapping

| ID | Current state | Evidence / gap |
|---|---|---|
| E2E-01 AES import | NOT_EXECUTED as specified | Actual self-contained sample module analysis works; no AES fileset/provider acceptance claim |
| E2E-02 invalid top | PASS for supported self-contained filesets | Actual slang diagnostics, exact location tests |
| E2E-03 invalid MMIO commit | PASS for current topology model | Browser/API preserve committed revision and show overlap errors |
| E2E-04 real Verilator + FST | PASS for fixed Ibex reference | Real executable/firmware, native verdict and actual FST; general standalone uploaded RTL remains unavailable |
| E2E-05 waveform/source cross-probe | PARTIAL | Wellen exact trace IDs/window/cursor work; trace-to-source map remains unavailable |
| E2E-06 published IP reuse | PARTIAL | Reviewed draft reuse is tested; verified publication deliberately blocked |
| E2E-07 actual Ibex firmware MMIO | PASS for fixed hello reference | UART/halt MMIO, instruction trace and FST produced by actual CPU RTL; arbitrary added peripherals not accepted |
| E2E-08…10 gem5/SystemC/RTL | PARTIAL | Internal gem5/SystemC CPU roundtrip and standalone SystemC→Verilated register passed; full gem5→RTL/AES/hybrid backpressure not executed |
| E2E-11 replay simulation | PASS for fixed PicoRV32 reference | Native replay matches CPU trace/MMIO/firmware hashes and cycles; general manifest replay remains open |
| E2E-12 reconnect mid-run | PARTIAL | Backend monotonic replay and browser restore tested; deliberate mid-simulation reconnect not run |
| E2E-13 banned dependency | PARTIAL | License policy rejects banned/unknown cases and release is fail-closed; full release-pipeline injection/audit not run |
| E2E-14 AI OFF/offline simulation | PARTIAL | Real analysis/browser flow works with external browser requests aborted; actual offline RTL simulation not run |
| E2E-15 AI proposal | NOT_EXECUTED / optional | AI harness is not installed and cannot promote IP |

## License, isolation and fidelity

Npm dependencies are pinned and license texts retained. ELK is absent. DOMPurify uses its offered Apache-2.0 alternative; Vite 7 avoids the unreviewed MPL dependency observed in Vite 8. Build-time CC-BY-4.0 data attribution and matching-version parent licenses for native npm binaries are retained. Python audit still flags unresolved items including test-only certifi MPL, interpreter/bundled terms and missing/scoped license evidence. Project-owned source remains private/UNLICENSED pending owner choice. No “100% OSS-compliant” release is asserted.

The API is a **local single-user prototype**, not team authentication/RBAC or an OS sandbox. Parser execution is a bounded child process. Original reference CLI uses Windows Job Objects; new fixed workflow runtime uses unprivileged Linux process groups and limits, with real cancellation/timeout descendant tests. WSL retains host filesystem/network access. Generic imported RTL simulation still returns 424. Read-only reference endpoints remain separate; `/runtime/*` explicitly launches only enumerated reviewed profiles. A `COMPLETED_PASS` analysis means parsing/elaboration passed, not hardware verification.

## Remaining work

M1 local shell is delivered. M2…M10/M12 have documented partial capabilities. Actual Ibex/PicoRV32 RTL firmware, gem5 RISC-V, internal SystemC TLM roundtrip, SystemC→Verilated register, Yosys post-synthesis comparison and Wellen VCD/FST navigation now execute. Full gem5→SystemC→RTL peripheral chain, arbitrary Composer execution, exact source-to-wave mapping and hostile-input sandbox remain open. [Runtime scope](../runtime/REPORT.md), [architecture](../../architecture/RUNTIME_PIPELINES.md).

No milestone approval was requested. Sequencing remains continuous; unsupported hardware and release gates remain explicit.
