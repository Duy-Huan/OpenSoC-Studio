# M0 — phạm vi triển khai đầu tiên

Ngày kiểm tra: 2026-10-22 (Asia/Saigon). Yêu cầu của người dùng: xây OpenSoC-Studio V1.0 theo hai tài liệu trong repository. Những câu chỉ dẫn cho Claude trong tài liệu được dùng làm quy trình thiết kế, không phải yêu cầu mới từ người dùng hoặc quyền thay đổi máy chủ.

Inventory trước khi thay đổi: chỉ có `AI_START_HERE_OpenSoC.md`, `OpenSoC_Studio_Engineering_Blueprint_v1_0.md` và `.git`; nhánh main chưa có commit. Không có module, dependency, license hay test để tái sử dụng. Giữ nguyên cả hai tài liệu.

Theo handoff và blueprint §§0, 19–22, chu kỳ này chỉ triển khai M0. Chưa khóa kiến trúc và chưa bắt đầu M1 khi các feasibility gate chưa có bằng chứng. Không cài đặt hay đổi cấu hình hệ thống, không chạy RTL người dùng trên host.

Thay đổi theo file/nhóm file:

| File | Mục đích |
|---|---|
| `docs/architecture/SYSTEM_OVERVIEW.md`, `TOOLCHAIN_AUDIT.md` | Ranh giới, fidelity, OS và khả năng hiện tại |
| `docs/decisions/ADR-001..004*.md` | Bốn quyết định từ §2, trạng thái provisional |
| `docs/contracts/*.schema.json`, `openapi.json` | Draft version 1.0, kiểm tra cấu trúc, chưa freeze |
| `docs/compliance/*`, `sbom/*` | Pin, license evidence, policy, SBOM development |
| `infra/scripts/*` | Doctor, audit, kiểm tra contracts và spike prerequisites |
| `tests/contract/*`, `tests/licensing/*` | Reject cấu hình sai, precision, license policy |
| `docs/reference-platforms/SPIKES.md` | Acceptance plan A/B, lệnh upstream và điều kiện sandbox |
| `docs/test-evidence/M0/*` | Lệnh thực chạy, output, hash input, blockers |
| `.github/workflows/m0.yml` | CI M0; không quảng cáo acceptance simulator |

License mã dự án chưa được chủ sở hữu chọn. `private: true` và `UNLICENSED` ngăn công bố nhầm; đây là release blocker, không phải tuyên bố mã đã là OSS. Node chỉ dùng cho tooling kiểm tra M0; backend sản phẩm vẫn theo FastAPI/Python, không thay ADR-004.
