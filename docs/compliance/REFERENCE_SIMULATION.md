# Reference RTL simulation — license scope

2026-10-22. Local feasibility execution only; **not a cleared redistributable toolchain/product**. No new npm/Python library dependency. `.tools`, `.cache/upstream` and executable artifacts remain excluded from Git.

| Component | Exact source/version | Evidence and decision |
|---|---|---|
| PicoRV32 core | `ef203c2b0a3fb793280f5114941416c425c5b461` | ISC, original COPYING retained; preferred for core |
| Upstream testbench + firmware | Same pin | Per-file public-domain declarations; retain headers; don't relabel the whole repository ISC |
| Upstream assembly tests | Same pin | `tests/LICENSE` BSD-3-Clause plus per-file headers; retain license text |
| Icarus/vvp external executables | OSS CAD Suite 2026-10-21 | GPL v2 or later text in suite `license/LICENSE.iverilog`; conditional external build/run tool, not linked into API/UI |
| RISC-V GCC / binutils / libgcc | xPack 15.2.0-1 | GNU tools/runtime terms, GCC Runtime Library Exception applicability needs review. Preserve entire distribution license directory; compiled firmware is a separate generated artifact |
| Remaining portable tool distribution | Same two release archives | Mixed tool/dependency licenses; full closure not audited, must not redistribute as cleared bundle |

Archive URLs and GitHub asset SHA256 checks are in [simulator record](../test-evidence/real-soc/toolchain-download.json) and [GCC record](../test-evidence/real-soc/gcc-download.json). Used executable hashes and original source hashes are in [run manifest](../test-evidence/real-soc/regression.json). License/source evidence copies are under `license-evidence/reference-simulation/`; complete tool licenses also remain in the downloaded local distributions. Project license selection and full-product release gate remain open.

No blanket claim about licensing of generated ELF follows from the CPU's ISC license. libgcc is linked with `-lgcc`; audit runtime exceptions and source/test notices before exporting firmware or distributing a packaged application/toolchain. This experimental workflow does not grant automatic VERIFIED IP publication.
