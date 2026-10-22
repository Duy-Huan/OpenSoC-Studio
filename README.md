# OpenSoC Studio

Workbench RTL-first/local-first theo [Engineering Blueprint V1.0](OpenSoC_Studio_Engineering_Blueprint_v1_0.md). **Đã có ứng dụng development và 8 workflow runtime thực, gồm Ibex, PicoRV32, gem5, SystemC, Verilator, Icarus, Yosys và Wellen; chưa hoàn tất V1.0 release.** Tiếp tục qua các milestone theo yêu cầu mới của người dùng, ghi nhận trong [ADR-005](docs/decisions/ADR-005-continuous-delivery.md).

Ứng dụng hiện có React + Dockview OSS + Monaco + React Flow, FastAPI + SQLite và pyslang thật. Bạn có thể tạo project, import RTL, xem hierarchy/ports và diagnostic compiler, mở đúng source, lưu phiên bản mới, đóng gói/review/reuse IP, sửa topology/memory map có kiểm tra backend, kiểm tra cấu trúc ELF và xuất evidence. AI mặc định OFF. Giao diện không dùng cloud/CDN hoặc backend giả.

## Chạy ngay trên workspace này

Node 24.22.0, npm 11.19.1 và Python 3.12.10 portable đã được chuẩn bị. Build frontend đã có:

```powershell
npm.cmd start
```

Mở **http://127.0.0.1:8000**. Nếu server đang chạy, mở URL trực tiếp. Dữ liệu cục bộ nằm trong `.opensoc/`; test dùng `.cache/e2e-data/` riêng. Không mở service này ra LAN/Internet: mode hiện tại là local single-user, chưa có team RBAC hay OS sandbox.

Development với Vite hot reload:

```powershell
npm.cmd run dev
```

Mở http://127.0.0.1:5173. Không chạy hai backend cùng lúc trên port 8000.

## Workflow

1. Tạo workspace bằng nút `+` cạnh project selector.
2. `Import RTL`: chọn fileset `.sv/.v/.svh/.vh` tự chứa; khai báo quyền nguồn thực tế. `NOASSERTION` được phép import để review, chưa được review IP thành sẵn sàng dùng. ZIP import có API riêng với traversal/symlink/bomb guards.
3. Chọn top hoặc để tự xác định; `Analyze RTL` chạy pyslang ở tiến trình riêng. Kết quả chỉ là phân tích/elaboration, không phải mô phỏng.
4. Chọn module/port để điều hướng đến file/line do compiler cung cấp. `Ctrl+S` hoặc `Save snapshot` lưu revision mới, giữ source/hash/parent gốc.
5. `IP Registry`: tạo draft có version cố định; review metadata/quyền và pin lại trong project khác. Package vẫn simulation-unverified. Publish VERIFIED bị chặn khi thiếu evidence.
6. `SoC Composer`: thêm package instance, chọn mapping bus, nối initiator→target, đặt vùng nhớ, Validate và Commit. Backend từ chối overlap/overflow/role/width/clock/unknown-IP; lỗi hiện tại node/region. Layout/position là view data, không quyết định semantics.
7. Mở `Firmware` qua tab hoặc `Ctrl+K` → `Open firmware`: kiểm tra ELF32 RISC-V với profile Ibex Simple System. Structural checks không chứng minh boot.
8. Xuất analysis evidence từ nút download ở console. **RTL Regression** giữ báo cáo 7 kịch bản PicoRV32 trước đó; **Engine Runtime** chạy các workflow mới gồm Ibex/gem5/SystemC và mở waveform thật. Simulation của RTL tùy ý hoặc topology tùy biến vẫn unavailable.

## Mô phỏng minimal SoC từ GitHub

Workflow chính hiện tại: mở **Engine Runtime** ở thanh bên → chọn profile/scenario → **Build & Run**. UI chạy job thật qua API, hiển thị từng stage, giữ lịch sử/cancel/log/artifact. Có thể mở VCD/FST bằng Wellen, chọn signal ID, cửa sổ thời gian và cursor để đọc giá trị thật. **16/16 workflow baseline/negative đạt kỳ vọng**; [báo cáo runtime](docs/test-evidence/runtime/REPORT.md), [kiến trúc](docs/architecture/RUNTIME_PIPELINES.md), [ADR-008](docs/decisions/ADR-008-engine-runtime.md).

Toolchain Linux nằm trong distro WSL2 riêng `OpenSoC-Runtime`, filesystem lưu ở `.tools/wsl-runtime/`. Đã có trên máy này. Chuẩn bị máy Windows mới và chạy acceptance:

```powershell
npm.cmd run runtime:setup
npm.cmd start
# Ở terminal khác, khi backend đã sẵn sàng:
npm.cmd run runtime:verify
```

Setup lấy rootfs đã pin hash, cài compiler/runtime, build Ibex qua FuseSoC/Edalize và build gem5 từ source pin. Inventory gồm package versions, binary hashes và 37 wheel Python có hash. Resolve Python offline đã kiểm tra; chưa phải installer toàn bộ OS/toolchain được chứng nhận offline. Các profile là reference đã review; chưa thực thi RTL tùy ý hoặc SoC tùy biến từ Composer.

Workspace hiện đã có portable Icarus và RISC-V GCC. Chạy lại toàn bộ regression:

```powershell
npm.cmd run sim:reference
```

Checkout mới chạy `node infra/scripts/setup-reference-sim.mjs` sau setup ứng dụng; tải hai archive khoảng 1.07 GB có SHA256 và source pin cố định. Full regression biên dịch firmware và chạy 7 kịch bản gồm AXI delay, reset, replay và firmware hỏng. Mở **RTL Regression** tại http://127.0.0.1:8000 để xem/tải bằng chứng. [Kết quả, lệnh, memory map và giới hạn](docs/test-evidence/real-soc/REPORT.md), [ADR-007](docs/decisions/ADR-007-reference-rtl-regression.md). Đây là upstream PicoRV32 AXI reference CPU + RAM + MMIO; chưa phải profile Ibex của blueprint hay sandbox cho RTL tùy ý.

## Thiết lập trên Windows mới

Chạy từ repository bằng PowerShell đã có quyền chạy script, hoặc thực hiện các lệnh trong [setup.ps1](infra/scripts/setup.ps1) thủ công nếu chính sách máy chặn script. Không cần thay ExecutionPolicy hệ thống:

```powershell
./infra/scripts/setup.ps1
```

Setup dùng Python portable trong `.tools/`, xác minh hash bootstrap đã ghi, cài wheel bằng `requirements.windows.lock --require-hashes`, npm lockfile và build UI. Không cài system Python, Docker hoặc WSL.

Linux/macOS cho workbench: dùng Python 3.12 trong `.venv`, cài `apps/api/requirements.lock`, rồi `npm ci --ignore-scripts` và `npm run build:web`. Native flows đã kiểm chứng trên Ubuntu trong WSL2 của máy Windows này; standalone Linux/macOS installation và remote CI chưa được chứng nhận. Lock wheel API ban đầu dành riêng Windows; toolchain Linux có lock/inventory riêng trong `docs/test-evidence/runtime/`.

## Kiểm tra

```powershell
npm.cmd run check
npm.cmd run test:api
npm.cmd run build:web
npm.cmd run test:e2e
```

Browser test cần `PLAYWRIGHT_BROWSERS_PATH=.cache/playwright` và `node node_modules/playwright/cli.js install chromium`; browser đã được tải trong workspace này. Suite dùng backend thật, không mock RTL/tool output. `npm.cmd run doctor`, `spike:a`, `spike:b` ghi prerequisites; preflight chưa đủ điều kiện trả exit 2. `npm.cmd run release:gate` vẫn trả exit 1.

## Phạm vi và bằng chứng

- [Trạng thái tất cả milestone](docs/implementation/STATUS.md), [báo cáo bàn giao hiện tại](docs/test-evidence/current/REPORT.md).
- [Workbench screenshot](docs/test-evidence/M1/workbench.png), [Composer rejection](docs/test-evidence/M5/composer-errors.png), [ELF validation](docs/test-evidence/M6/firmware-validation.png).
- [Contract drafts](docs/contracts/README.md), [OpenAPI thực triển khai](docs/contracts/openapi.runtime.json), TypeScript request types được sinh trong `apps/web/src/api-contracts.ts`.
- [Npm audit/license evidence](docs/test-evidence/current/license-development.json), [Python license review](docs/test-evidence/current/python-licenses.json), [license exceptions](LICENSE_EXCEPTIONS.md).
- [Native platform blocker](docs/test-evidence/M4/PLATFORM_BLOCKER.md), [spike plans](docs/reference-platforms/SPIKES.md).

License code dự án chưa được chủ sở hữu chọn. Chưa công bố “100% OSS-compliant”, full hybrid hoặc đầy đủ V1.0 khi các gate còn mở. Các báo cáo M0 là hồ sơ lịch sử; xem `current/` cho trạng thái mới nhất.
