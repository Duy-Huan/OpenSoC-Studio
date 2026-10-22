# Engine runtime toolchain — compliance scope

2026-10-22. External development tools execute real reference workloads. This document records evidence, **not whole-product release clearance**.

- Canonical Ubuntu rootfs: exact SHA256, URL and size in [download record](../test-evidence/runtime/linux-download.json). HTTPS SHA256 comparison was performed; GPG verification was not claimed.
- Installed OS package versions: [inventory](../test-evidence/runtime/linux-packages.tsv). This is not a complete mirrored offline APT image or a claim that future package repositories retain these versions.
- Verilator/Icarus/Yosys/RISC-V GCC/G++/SystemC/FuseSoC and compiled Ibex/gem5: [actual binary/version inventory](../test-evidence/runtime/toolchains.json). Scope is external build/run processes, not linkage of tool libraries into the API/frontend.
- Python tool dependencies: [37 exact wheels](../test-evidence/runtime/linux-python-wheels.json), [hash lock](../test-evidence/runtime/linux-python.requirements.lock), [external-tool Python SBOM](../../sbom/runtime-python.cdx.json), [retained notices](../../RUNTIME_THIRD_PARTY_NOTICES.md). Local wheelhouse offline dependency/hash resolution passed; this does not certify a complete offline installer.
- Native/source license texts: [inventory](../test-evidence/runtime/license-inventory.json), `license-evidence/runtime/`. GPL/conditional tools, generated firmware/libgcc exceptions, vendored sources and the whole OS still require scoped review before product redistribution.
- Project-owned code remains UNLICENSED pending owner selection. No redistribution license is inferred from successful simulation.

Source revision pins, worker hashes, exact commands and artifact hashes are retained per native run. Ibex uses the small configuration from its pinned upstream; gem5 uses its RISC-V architecture model and internal SystemC implementation for the roundtrip profile. Standalone SystemC/Verilator uses the distribution's external SystemC 2.3.4 library. These are distinct ABI/fidelity scopes.

Preparation runs root only inside the dedicated WSL distro; runtime tools run as `opensoc`. WSL is not a full filesystem/network sandbox. No arbitrary imported scripts/RTL execution or automatic VERIFIED IP publication is enabled. [Execution evidence](../test-evidence/runtime/REPORT.md), [ADR-008](../decisions/ADR-008-engine-runtime.md).
