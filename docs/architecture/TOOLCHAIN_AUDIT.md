# OS / toolchain audit — 2026-10-22

Nguồn máy: [environment.json](../test-evidence/M0/environment.json). Nguồn upstream: [upstream-lock.json](../compliance/upstream-lock.json), [feature evidence](../compliance/upstream-feature-evidence.json). Mỗi revision đầy đủ và URL bất biến nằm trong lock; pin nghiên cứu không chứng minh tương thích tổ hợp.

| Thành phần/profile | Status | Bằng chứng / giới hạn |
|---|---|---|
| Windows x64 / Node 24.22.0 / Git 2.56.0 | SUPPORTED cho M0 tooling | Validator + audit được thực chạy |
| npm 11.19.1 qua npm.cmd | SUPPORTED cho M0 | npm.ps1 bị ExecutionPolicy chặn; không đổi policy |
| Python Windows alias | UNSUPPORTED hiện tại | python/python3 alias không chạy được; chưa có Python sử dụng được |
| Docker CLI 29.8.2 | UNSUPPORTED cho worker hiện tại | Không có daemon; server null ngay cả kiểm tra ngoài sandbox |
| WSL Linux development | UNSUPPORTED hiện tại | Ngoài sandbox chỉ liệt kê docker-desktop; chưa có distro dev được cấu hình |
| Native Windows RTL / gem5 | UNSUPPORTED | Chưa có toolchain và không có bằng chứng integration |
| Linux x86_64 isolated worker | EXPERIMENTAL target | Chưa cấp image digest, compiler, quotas hoặc sandbox proof |
| Ibex `1b29dae8…` + Verilator v5.032 `8ff77e9d…` | EXPERIMENTAL | README Simple System xác nhận flow FuseSoC, firmware ELF, `-t`, instruction log; tổ hợp pins chưa build |
| gem5 v24.1.0.3 `b9da2bfe…` + SystemC 3.0.1 `11ad094d…` | EXPERIMENTAL, high risk | `util/tlm/README` tồn tại ở pin; không có bằng chứng ABI/build/scheduler tương thích |
| FuseSoC / Edalize / slang / Yosys | EXPERIMENTAL candidates | Exact source + root license pinned; binaries chưa cài; AST/netlist fidelity chưa test |
| Wellen `82db2a5b…` | EXPERIMENTAL integration | Cargo source pin báo version 0.25.7, rust-version 1.90.0; chưa có Cargo, parser service hoặc renderer |
| ROHD Wave / Schematic | EXPERIMENTAL | Flutter integration, messaging, assets/transitives, benchmark và stable-ID mapping chưa test |
| Chipyard / Rocket | EXPERIMENTAL | Pin root chưa gồm submodule closure; chưa chọn config/compiler hoặc generated RTL |
| OpenTitan | EXPERIMENTAL | Không suy luận full SoC support từ license hoặc Ibex Simple System |
| CVA6 qua Chipyard/Verilator | UNSUPPORTED đến khi có profile proof | Caveat từ blueprint chưa được kiểm chứng ở pin cụ thể; không blanket claim |

Linux image dự kiến cần GCC/G++, make, Python, libelf-dev, zlib, SCons, CMake, Verilator, FuseSoC/Edalize, RISC-V GCC/VMEM tools. Bridge cần SystemC build cùng C++ ABI và chính sách pthread/tcmalloc theo upstream. Chưa chọn base image và chưa có package closure/SBOM, nên không thêm Dockerfile trỏ image mutable và gọi đó là reproducible.

Các lệnh inventory thực chạy: `node --version`, `npm.cmd --version`, `git --version`, `docker version`, `wsl --list --quiet`, `node infra/scripts/doctor.mjs`. Không đổi execution policy, cài WSL, bật daemon hoặc cài compiler hệ thống.
