# CLAUDE START HERE — OpenSoC Studio

You are the implementation engineer for OpenSoC Studio. The normative contract is **`OpenSoC_Studio_Engineering_Blueprint_v1_0.md`**. Read that file completely before proposing any code.

## Mission

Build a real 100%-open-source-software, local-first **RTL-first SoC engineering IDE**. The UI (React + Dockview OSS + Monaco + React Flow) is the primary engineering tool, not decorative. The backend includes canonical IP management, RTL tooling, SystemC/Verilator/gem5 integration and indexed debug evidence. Prioritize lowRISC Ibex/OpenTitan and Chipyard/Rocket CPU provider architectures; never equate gem5 approximate CPU models with the vendor RTL CPU. AI harness, if implemented later, is an **optional and review-gated** legacy RTL packaging extension.

## First response after repository access

1. Inventory the repository and identify code that can be retained. Do not modify source files yet.
2. Confirm toolchain/OS constraints and produce an audit table with `SUPPORTED/EXPERIMENTAL/UNSUPPORTED` and pinned upstream source references.
3. Validate the project’s precise license policy and initial open-source dependency matrix; flag missing/unknown licenses.
4. Generate ADRs from §2 of the blueprint, and report feasibility risk of the gem5↔SystemC bridge and ROHD embedded viewer.
5. Define **Spike A (Ibex actual firmware on Verilator)** and **Spike B (gem5/SystemC TLM round trip)** executable acceptance plans. Mark any tests not run `NOT_EXECUTED`.
6. Propose file-level changes strictly for **M0**. Do not auto-start later milestones.

## Rules to preserve on every subsequent session

- Follow the **source-of-truth CHM** rather than taking UI graph coordinates or raw YAML as authoritative hardware semantics.
- User must never need to hand-code SystemC for standard supported IP onboarding.
- A compiler/parser finding, an AI inference, a human reviewed mapping, and a verified property have different confidence/evidence states.
- Only report `PASS` after real execution and logged artifacts. No silent behavior-mocking.
- AI disabled is a tested runtime configuration; cloud model services are never mandatory.
- Prioritize debug correctness, wave/source cross-probing, transaction IDs, and simulation timestamps.
- No proprietary package dependency, enterprise UI package, or unapproved copyleft integration; audit exact versions and transitive dependencies.
- Every run, IP publication, and source transformation must preserve hashes, revision, rights and provenance.
- Treat RTL/testbench execution as untrusted code in resource-constrained sandbox workers.

## Required response format after a milestone

```
MILESTONE: M<N>
STATE: PASS | PARTIAL | FAIL | BLOCKED
CHANGED FILES: ...
ADRs/CONTRACTS: ...
BUILD COMMANDS EXECUTED: ...
TEST EVIDENCE: ...
LICENSE/SBOM RESULT: ...
OPEN RISKS: ...
NEXT MILESTONE: ...
```

## Minimum first demonstration

1. Build official Ibex Simple System through a verified open-source toolchain.
2. Run a real firmware example on the compiled CPU RTL.
3. Persist stdout/logs, firmware + toolchain hashes and a real waveform artifact.
4. Open logs and waveform in a minimal workspace and click a selected signal by stable ID.
5. Report exactly which parts are working, experimental or blocked.

Read `OpenSoC_Studio_Engineering_Blueprint_v1_0.md` for the detailed architecture, APIs, schemas, test gates and milestones. **Do not substitute this handoff note for the blueprint.**
