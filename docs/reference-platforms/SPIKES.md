# Feasibility A / B — executable acceptance plans

Update 2026-10-22: actual Ibex Simple System firmware/Verilator/FST/Wellen/UI workflow now passes. Initial gem5/SystemC proof uses compiled-in native TLM bridges with CPU workload and two real monitors (DERIVED pairing), not external `util/tlm`. SystemC→Verilated register also executes. [Current results](../test-evidence/runtime/REPORT.md), [ADR-008](../decisions/ADR-008-engine-runtime.md). Original NOT_EXECUTED statements below describe the M0 baseline; external library/hybrid release gates remain open.

Current execution: **NOT_EXECUTED**, preflight **BLOCKED**. See [A](../test-evidence/M0/spike-A.json), [B](../test-evidence/M0/spike-B.json). These files represent prerequisite checks, not simulator runs. Build shell harnesses are unexecuted scaffolding until a real isolated Linux worker exists.

## Worker prerequisite (both spikes)

Use a disposable unprivileged Linux x86_64 sandbox, offline at runtime, no host socket, CPU/RAM/disk/PID/wall-time limits. Stage pinned sources and dependency closure in a preparation phase with explicit hashes and license review; source-of-record readonly, a disposable build copy at `/workspace/ibex` or `/workspace/gem5`, bounded output at `/evidence`. Do not run these upstream builds on user-imported host RTL. Shell harnesses do not enforce container isolation; the execution platform must prove it independently. No image digest or complete package closure has been approved yet, so provisioning is still BLOCKED.

Target resource budget for feasibility: 2 CPUs, 8 GiB RAM, 30 GiB scratch, 256 PIDs; monitor real consumption and document any adjustment. Build timeout is not simulation time. C++ ABI/compiler/SystemC version, libraries, firmware compiler, all submodule and generator pins must enter the manifest before interpreting results as reproducible.

## A — Ibex firmware + waveform

Pinned [Simple System README](https://github.com/lowRISC/ibex/blob/1b29dae8866e6c0f0a3cd9dead53a77b4f45e357/examples/simple_system/README.md); [hello_test oracle source](https://github.com/lowRISC/ibex/blob/1b29dae8866e6c0f0a3cd9dead53a77b4f45e357/examples/sw/simple_system/hello_test/hello_test.c). Source hashes/markers: `docs/compliance/upstream-feature-evidence.json`.

Preflight on current host:

```powershell
npm.cmd run spike:a
```

In the verified worker, with repository scripts mounted at `/opensoc`:

```bash
bash /opensoc/infra/spikes/run-a.sh
```

Harness follows upstream FuseSoC small config, builds `hello_test.elf`, invokes compiled CPU with `-t --meminit=ram,...`, requires nonempty instruction/UART/FST outputs and actual hello/hex strings. It records binary/firmware/artifact hashes. Prefix is selected as `riscv32-unknown-elf-`; verify it against upstream common.mk and record any reviewed toolchain adaptation. Source pins alone do not prove Verilator compatibility.

Full A acceptance, all required:

| Check | Oracle | Current |
|---|---|---|
| CPU RTL compiled and firmware executed | real compiler logs, ELF + simulator hashes, zero exit, UART strings from pinned C source | NOT_EXECUTED |
| CPU instruction execution | nonempty PC/instruction trace, simulation cycle stats | NOT_EXECUTED |
| Actual waveform | FST parsed by audited reader, hierarchy + time range, X/Z behavior checked | NOT_EXECUTED |
| Minimal UI debug | open that run/log/FST; select stable signal ID and navigate real time; exact or unavailable source map | NOT_EXECUTED |
| Reproducibility/license | RunManifest, image/compiler/library/ELF/source/adapter hashes, artifact rights | NOT_EXECUTED |

Missing any oracle is INCONCLUSIVE/PARTIAL, not PASS. A timeout/crash is not a failing firmware assertion; preserve separate infra/test verdicts. The harness does not implement the UI acceptance or generate a complete RunManifest yet.

## B — gem5 → SystemC TLM round trip

Pinned [util/tlm README](https://github.com/gem5/gem5/blob/b9da2bfe1e21f6efa2730edd4e80e58c5d965458/util/tlm/README). `Gem5SlaveTransactor` exposes a TLM initiator socket for gem5→SystemC; `Gem5MasterTransactor` exposes a target socket for SystemC→gem5. The name is not sufficient to infer direction. Source inspection confirms build commands and documents tcmalloc/pthread issues. SystemC **3.0.1 is an untested candidate**, not a known-good pair; try another reviewed pin if incompatibility is evidenced, preserving the failed logs.

```powershell
npm.cmd run spike:b
```

Initial upstream smoke in the verified worker, SystemC built separately with recorded config and `SYSTEMC_HOME` set:

```bash
bash /opensoc/infra/spikes/run-b-demo.sh
```

The exact upstream flow builds ARM `gem5.opt`, sets USE_SYSTEMC=n for the external library path, builds libgem5 with cxx-config and without Python/tcmalloc, then `util/tlm` examples. Config generation may issue the specifically documented missing-port-handler fatal; the script only tolerates that failure with a nonempty config.ini. Use the actual `build/examples/slave_port/gem5.sc` path; one verbose-command line in the README omits `examples/`, so it must not be copied blindly.

This ARM/traffic demonstration is **B0**, not proof of RISC-V CPU firmware or MMIO. A clean process exit is INCONCLUSIVE until the following additional test is implemented and executed:

1. Pin a deterministic request producer: first upstream traffic; then a real configured CPU workload that writes `0x12345678` to an explicitly mapped target and reads it back. Record ISA/board/load/permissions. No proposed generic board API is presumed to exist.
2. Instrument both bridge ends and synthetic SystemC target with matching transaction IDs. Capture request/response/data/byte enables/status and integer times. Check the returned value and completion count, not just log presence.
3. Fix fs resolution/epoch, direction, phase ordering and timing mode; assert no negative latency, dropped/duplicated responses or deadlock. Bound simulation progress and wall time separately.
4. Test error response, bounded timeout and reset/progress behavior; save toolchain/image/source/config hashes and raw logs.

| Stage | Current | Requirement |
|---|---|---|
| B0 external SystemC upstream demo | NOT_EXECUTED | Actual build + run log; no CPU claim |
| B1 paired synthetic target oracle | NOT_EXECUTED | known read/write response and matching IDs/time |
| B2 CPU-driven MMIO | NOT_EXECUTED | actual CPU workload + paired target evidence |
| C transactor | NOT_EXECUTED | independent AW/W, strobe/backpressure/reset/timeout |
| D ROHD vs Wellen | NOT_EXECUTED | same real trace, load/RSS/window/cursor/source-map benchmark |

Initial risk outcome can justify deferring hybrid via an ADR, but never advertise full hybrid before M8. Next work remains M0 feasibility; M1 is gated.
