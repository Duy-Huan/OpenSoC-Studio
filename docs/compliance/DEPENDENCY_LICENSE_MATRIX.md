# Initial dependency / license matrix

Current Linux engine runtime scope: [toolchain audit](ENGINE_RUNTIME.md), [actual 16-case execution](../test-evidence/runtime/REPORT.md). This extends the earlier Windows reference workflow; neither audit grants whole-product release clearance.

Fixed PicoRV32 native simulation and external portable toolchain scope: [reference simulation audit](REFERENCE_SIMULATION.md), [actual run hashes](../test-evidence/real-soc/regression.json). External GPL tools are not automatically cleared for product redistribution.

> Historical M0 research candidates. Current installed workbench dependencies are pinned in package-lock.json and apps/api/requirements*.lock; actual npm/Python evidence is under docs/test-evidence/current/. ELK remains uninstalled. Do not use the initial Ajv-only inventory below as the current application BOM.

Generated from public metadata and pinned license evidence. Research pins are not a tested dependency lock. Only Ajv and its npm transitives are installed for M0. No row constitutes redistribution approval.

| Component | Exact pin | Root reported SPDX | Policy | Evidence |
|---|---|---|---|---|
| ibex | [1b29dae8866e6c0f0a3cd9dead53a77b4f45e357](https://github.com/lowRISC/ibex/tree/1b29dae8866e6c0f0a3cd9dead53a77b4f45e357) | Apache-2.0 | PREFERRED | [saved root license](license-evidence/ibex.txt) |
| gem5 | [b9da2bfe1e21f6efa2730edd4e80e58c5d965458](https://github.com/gem5/gem5/tree/b9da2bfe1e21f6efa2730edd4e80e58c5d965458) | NOASSERTION | BLOCKED | [saved root license](license-evidence/gem5.txt) |
| systemc | [11ad094d282fd5330b27ab57f90f9d231a763da1](https://github.com/accellera-official/systemc/tree/11ad094d282fd5330b27ab57f90f9d231a763da1) | Apache-2.0 | PREFERRED | [saved root license](license-evidence/systemc.txt) |
| verilator | [8ff77e9d47351b0a59114929880687839a51840b](https://github.com/verilator/verilator/tree/8ff77e9d47351b0a59114929880687839a51840b) | LGPL-3.0 | REVIEW_REQUIRED | [saved root license](license-evidence/verilator.txt) |
| fusesoc | [2ab5297305ef5da3d53739a7b970469da90ca44a](https://github.com/olofk/fusesoc/tree/2ab5297305ef5da3d53739a7b970469da90ca44a) | BSD-2-Clause | PREFERRED | [saved root license](license-evidence/fusesoc.txt) |
| edalize | [9a6f648c596bfe74224ae82f529075e565d4182b](https://github.com/olofk/edalize/tree/9a6f648c596bfe74224ae82f529075e565d4182b) | BSD-2-Clause | PREFERRED | [saved root license](license-evidence/edalize.txt) |
| slang | [3b351a52b15755b896d3b0144ae0432547d86618](https://github.com/MikePopoloski/slang/tree/3b351a52b15755b896d3b0144ae0432547d86618) | MIT | PREFERRED | [saved root license](license-evidence/slang.txt) |
| yosys | [485b635644b853bec391faa3e41293079726cac4](https://github.com/YosysHQ/yosys/tree/485b635644b853bec391faa3e41293079726cac4) | ISC | PREFERRED | [saved root license](license-evidence/yosys.txt) |
| wellen | [82db2a5b993c7e93a049a183ba84f93c6a65bf1f](https://github.com/ekiwi/wellen/tree/82db2a5b993c7e93a049a183ba84f93c6a65bf1f) | BSD-3-Clause | PREFERRED | [saved root license](license-evidence/wellen.txt) |
| rohd-schematic | [018851bbcbfbe463c4c370910aba5192798997eb](https://github.com/intel/rohd-schematic-viewer/tree/018851bbcbfbe463c4c370910aba5192798997eb) | BSD-3-Clause | PREFERRED | [saved root license](license-evidence/rohd-schematic.txt) |
| rohd-wave | [528178830b081c0aca2e6bbb321372d26725fc59](https://github.com/intel/rohd-wave-viewer/tree/528178830b081c0aca2e6bbb321372d26725fc59) | BSD-3-Clause | PREFERRED | [saved root license](license-evidence/rohd-wave.txt) |
| chipyard | [157dd69e49b9866be2bf8db390ee78bc38cd4438](https://github.com/ucb-bar/chipyard/tree/157dd69e49b9866be2bf8db390ee78bc38cd4438) | NOASSERTION | BLOCKED | [saved root license](license-evidence/chipyard.txt) |
| opentitan | [8fe9809738dc738f50f7011a0c671ccfe5a61020](https://github.com/lowRISC/opentitan/tree/8fe9809738dc738f50f7011a0c671ccfe5a61020) | Apache-2.0 | PREFERRED | [saved root license](license-evidence/opentitan.txt) |
| dockview | [173734ec0cb99b0af15c4f068647b771f3299249](https://github.com/dockview/dockview/tree/173734ec0cb99b0af15c4f068647b771f3299249) | NOASSERTION | BLOCKED | [saved root license](license-evidence/dockview.txt) |
| react-flow | [017a41c69998bc8f16d2a3e6c3ca0084f320a24f](https://github.com/xyflow/xyflow/tree/017a41c69998bc8f16d2a3e6c3ca0084f320a24f) | MIT | PREFERRED | [saved root license](license-evidence/react-flow.txt) |
| react | 19.3.1 | MIT | PREFERRED | Registry metadata only; package text/transitives not audited |
| dockview-react | 8.6.1 | MIT | PREFERRED | Registry metadata only; package text/transitives not audited |
| @xyflow/react | 12.12.0 | MIT | PREFERRED | Registry metadata only; package text/transitives not audited |
| monaco-editor | 0.57.0 | MIT | PREFERRED | Registry metadata only; package text/transitives not audited |
| elkjs | 0.12.0 | EPL-2.0 OR GPL-3.0-or-later | REVIEW_REQUIRED | Registry metadata only; package text/transitives not audited |
| ajv | 8.17.1 | MIT | PREFERRED | Registry metadata only; package text/transitives not audited |

Interpretation:

- gem5 root BSD-style text, Chipyard root BSD-3-Clause text and Dockview mixed monorepo text are saved; metadata NOASSERTION stays blocked until scoped manual review. Do not classify the whole Dockview repository as MIT.
- Verilator applicable dual-license terms require reviewing the pinned COPYING/ARTISTIC and generated/runtime files; GitHub root LICENSE metadata alone reports LGPL-3.0.
- ELK.js is conditional, not permissive-only. It is not installed or approved.
- SystemC NOTICE, all git submodules, generated artifacts, firmware toolchain/runtime, OS image, fonts, icons and model weights remain unaudited.
- FastAPI/Pydantic/Uvicorn/SQLite/PostgreSQL are architecture candidates; exact Python/package/build pins and license closure remain NOT_SELECTED/NOT_AUDITED before M1.
- Full installed M0 development closure: [CycloneDX](../../sbom/m0-development.cdx.json), [actual audit report](../test-evidence/M0/license-development.json), [license texts](../../THIRD_PARTY_NOTICES.md).
- Project code license is UNLICENSED pending owner selection, so no 100% OSS or release-compliant claim is made.
