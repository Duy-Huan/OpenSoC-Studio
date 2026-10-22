# M4 / native waveform blocker

Latest update 2026-10-22: dedicated Ubuntu WSL runtime now builds/runs Verilator, Icarus, Yosys, Ibex, gem5 and SystemC. Wellen reads VCD/FST with signal/time navigation in UI. [Actual runtime report](../runtime/REPORT.md). Remaining blockers are full hostile-input containment, arbitrary composed SoC execution and complete source-to-trace mapping; the earlier host/tool observations below are historical.

Update 2026-10-22: a portable Icarus + RISC-V GCC fixed PicoRV32 profile now executes actual RTL, produces VCD and passes 7 regression scenarios. [Current report](../real-soc/REPORT.md), [ADR-007](../../decisions/ADR-007-reference-rtl-regression.md). The original observations below are historical. Verilator is now downloaded but no host C++ compiler is configured; Docker Desktop's engine returned HTTP 500. Full Ibex/Verilator/FST/Wellen/sandbox acceptance remains open.

Status: **BLOCKED for full simulation/waveform acceptance**. Local Windows host has no Verilator, C++/RISC-V toolchain, Cargo, or running Docker daemon / development Linux worker. Current checks are in `../current/environment.json` and `spike-A.json` / `spike-B.json`.

Public metadata checked on 2026-10-22: https://pypi.org/pypi/pywellen/0.25.7/json. The Wellen Python release offers CPython 3.12 macOS and manylinux wheels but no Windows wheel. Building a native Rust extension is not a workaround on this host because Rust/compiler prerequisites are absent. No Wellen integration or waveform parser benchmark has executed.

The UI waveform panel deliberately reports no artifact. Analysis ports are compiler symbols, not trace-index signal IDs. No fabricated VCD/FST, simulated CPU transcript, waveform cursor screenshot or live-debug claim is used to close this gate. A self-authored ELF test fixture is solely an ELF parser test and does not supply missing simulation evidence.

The next executable work needs a verified isolated Linux worker with audited image/toolchain/source closure. Follow `docs/reference-platforms/SPIKES.md`; A/B smoke scripts remain unexecuted. User instruction to continue milestones changes sequencing, not evidence requirements.
