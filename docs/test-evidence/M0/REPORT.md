# M0 delivery / acceptance report

> Historical M0 snapshot. The user's subsequent instruction authorizes continuous milestone work. See [current report](../current/REPORT.md) and [implementation status](../../implementation/STATUS.md); the M0 acceptance results below are not retroactively promoted.

MILESTONE: **M0 Architecture**  
STATE: **PARTIAL**  
Date: **2026-10-22, Asia/Saigon**

Repository before work had only the two user documents and an unborn main branch. Both documents are preserved. This is a foundation delivery, **not an implemented V1.0 IDE**. The handoff explicitly limits the first cycle to M0; blueprint §19 gates architecture freeze on real spikes.

## Deliverables / changed files

- Architecture inventory/scope, OS audit, SYSTEM_OVERVIEW, ADR-001–004, all PROVISIONAL.
- Seven versioned JSON Schema drafts, OpenAPI 3.1 target with 23 operations, typed CPUProvider and viewer adapter declarations. No API endpoint is implemented.
- Executable M0 schema/semantic validators for MMIO ranges, bus edges, exact integer time, scoped evidence references and run prerequisites; synthetic fixtures explicitly labelled.
- Public upstream research lock: 15 full git revisions and saved root license texts/hashes; six npm version/integrity metadata records. These are not a tested product lock or full source closure.
- Installed Ajv 8.17.1 and four transitive development dependencies, package-lock, five-component development CycloneDX, actual license texts/NOTICE, fail-closed license checker and release blocker.
- Doctor/preflight, pinned Linux A/B smoke scripts and detailed acceptance plans. Scripts are scaffolding; **not executed as builds/simulations**.
- GitHub Actions definition with exact action SHAs, contract checks, schema regeneration drift check, tag release gate. Remote CI has not run.

All delivered source/document file hashes: [source-hashes.json](source-hashes.json). Contract test output and input hashes: [checks.json](checks.json). Inventory/preflight/release/syntax command outputs and exit codes: [scope-commands.json](scope-commands.json).

## Decisions / upstream evidence

References to exact official revisions, root licenses, metadata and SHA256: [dependency matrix](../../compliance/DEPENDENCY_LICENSE_MATRIX.md), [source feature evidence](../../compliance/upstream-feature-evidence.json). Source marker checks establish document availability only, not compatibility.

Concrete findings: Dockview monorepo root is mixed-license; OSS package licensing must be checked separately from proprietary enterprise. ELK.js 0.12.0 declares EPL-2.0 OR GPL-3.0-or-later and remains conditional/uninstalled. Wellen pin reports Rust 1.90.0 minimum. gem5 util/tlm documents transactor directions and pthread/tcmalloc caveats; SystemC 3.0.1 + gem5 v24.1.0.3 has **not** been built together.

## Commands actually executed

| Command | Actual result |
|---|---|
| repository inventory / git status / git log | Only input documents initially; no commits |
| node / npm.cmd / git version checks | Node 24.22.0, npm 11.19.1, Git 2.56.0.windows.1 |
| npm.cmd install --ignore-scripts --no-audit --no-fund | Installed 5 development packages, exact lock retained |
| node infra/scripts/audit-upstreams.mjs | Public metadata fetched; initial branch/header mismatches corrected, completed refresh exit 0 |
| node infra/scripts/audit-features.mjs | Pinned docs read/hash recorded, exit 0 |
| node infra/scripts/generate-contracts.mjs | Generated 7 draft schemas |
| node infra/scripts/generate-openapi.mjs | Generated 23-operation draft |
| npm.cmd run check | **69/69 tests PASS**, installed development license audit PASS |
| node infra/scripts/doctor.mjs | Inventory saved; missing native simulation tools reported |
| node infra/scripts/spike-preflight.mjs A / B | Each exit **2**, BLOCKED preflight, simulation NOT_EXECUTED |
| node infra/scripts/license-audit.mjs --release | Exit **1**, expected BLOCKED release |
| Git Bash -n on run-a.sh / run-b-demo.sh | Syntax checks PASS; Linux build/runtime NOT_EXECUTED |
| wsl --list --quiet; docker version outside sandbox | Only docker-desktop distro; Docker server unavailable |

## Acceptance table

| Scenario / gate | Status | Evidence or limitation |
|---|---|---|
| Schema validation/version/unknown-field rejection | PASS | Actual Node tests in checks.json |
| Address overlap/overflow/alignment, edge protocol/role/domain | PASS | Validator-level tests; UI commit path absent |
| Tick integer precision beyond JS Number | PASS | Actual conversion/rejection tests |
| Inferred claims cannot satisfy verified evidence check | PASS | Draft validator tests; trusted artifact/reviewer verification not yet built |
| Banned/unknown/conditional license handling | PASS | Actual policy rejection tests and downloaded license hash checks |
| Installed M0 transitive development license closure | PASS | license-development.json, five packages only |
| A: actual Ibex firmware on Verilator + PC/FST/UI | NOT_EXECUTED | Native toolchain/Linux worker absent; full acceptance remains open |
| B: actual gem5/SystemC paired known response | NOT_EXECUTED | Toolchain/bridge absent; upstream demo alone would be insufficient |
| C: real RTL/TLM protocol tests | NOT_EXECUTED | No Verilator/SystemC worker |
| D: ROHD/Wellen real waveform benchmark/cross-probe | NOT_EXECUTED | No real generated trace/renderer integration |
| E2E-01…15 blueprint full product matrix | NOT_EXECUTED | No product workflow; contract-level tests do not substitute E2E |
| Runtime AI OFF / disconnected simulation | NOT_EXECUTED | NO_AI/network-disabled contract tested only |
| Release / 100% OSS claim | BLOCKED | Project license, product closure, feasibility, signing unresolved |

## License/security impact and next gate

No user RTL is imported, modified or uploaded. Network audit requests public upstream metadata/documents only. No cloud/model package, enterprise dependency or system configuration change was made. Worker sandbox, RBAC/archive guards and quotas are **not implemented**; harness scripts are not a security boundary.

OPEN RISKS: usable Python/toolchain missing; Docker daemon unavailable; only docker-desktop WSL distro; bridge version/ABI/time coupling; parser/render/correlation feasibility; ELK conditional licensing; project-owned license pending; product transitive/per-file/submodule/image/firmware audit incomplete.

NEXT MILESTONE: **finish M0 feasibility**, provision an audited isolated Linux worker, execute A + initial B/C/D, record real artifacts and review provisional ADRs. M1 Workbench remains gated. No claim of full V1.0 or hybrid support is made.
