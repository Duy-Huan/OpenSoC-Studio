# Trạng thái triển khai liên tục

Ngày: 2026-10-22. Chỉ dẫn mới của người dùng cho phép tiếp tục qua nhiều milestone mà không dừng xin xác nhận: [ADR-005](../decisions/ADR-005-continuous-delivery.md). Các gate kiểm chứng phần cứng/license vẫn được giữ. **Đây là bản phát triển local dùng được, chưa phải V1.0 release đầy đủ.**

| Milestone | State | Đã có / còn thiếu |
|---|---|---|
| M0 Architecture | PARTIAL | Có audit/contracts/8 ADR. Ibex firmware/RTL/FST/UI, PicoRV32 và gem5/internal-SystemC roundtrip đã chạy; external util/tlm và ROHD benchmark chưa chạy |
| M1 Workbench shell | PASS (phạm vi local) | React/Dockview OSS/Monaco/React Flow, FastAPI/SQLite, workspace persistence, real analysis worker, REST/WS replay; browser E2E đạt |
| M2 RTL importer | PARTIAL | Compiler pyslang 12 thật, top/hierarchy/ports, exact diagnostics/source navigation, immutable source revisions; chưa filelist/defines/include/parameter wizard và bus inference |
| M3 IP Registry | PARTIAL | Draft/review, immutable version/content pin, reuse qua project thứ hai; publish VERIFIED bị chặn vì chưa có simulator/protocol evidence |
| M4 Standalone sim/debug | PARTIAL | UI Build & Run với Verilator/Icarus/Yosys, VCD/FST thật và Wellen window/signal/cursor; còn arbitrary RTL sandbox và full source cross-probe |
| M5 SoC Composer | PARTIAL | Graph editor trên model backend, bus/role/width/clock + MMIO validator, ETag, revision history, lỗi tại node/region, invalid commit bị từ chối; chưa verified adapters/boot validation |
| M6 RTL CPU board | PARTIAL | Ibex small và PicoRV32 chạy firmware trên CPU RTL thật qua UI/API; toolchain build tích hợp, ELF/UART/trace/FST có evidence; chưa arbitrary Composer board boot |
| M7 gem5 Architecture | PARTIAL | gem5 RISC-V TimingSimpleCPU chạy workload từ API, baseline/negative và stats/ticks đạt; chưa board/cache/workload breadth |
| M8 Hybrid engine | PARTIAL | gem5↔internal-SystemC TLM 932 giao dịch baseline ghép DERIVED; SystemC→Verilated register cũng chạy; chưa chuỗi CPU gem5→SystemC→RTL peripheral đầy đủ |
| M9 Unified Debug | PARTIAL | Source/hierarchy navigation; Wellen VCD/FST windows, signal IDs theo run/artifact và cursor values; MMIO/TLM JSONL; source-to-trace map còn unavailable |
| M10 Vendor breadth | PARTIAL | Read-only provider catalog có exact source pins và lý do unavailable; chưa Chipyard generator/OpenTitan HJSON/TL-UL integration |
| M11 Optional AI + scale | NOT_IMPLEMENTED (tùy chọn) | AI OFF là runtime đang chạy, core browser workflow không cần external requests; chưa agent/queue scale/RBAC |
| M12 Release hardening | PARTIAL | Bounded import/ZIP guards, local Host/Origin/mutation guard, cancel/restart recovery, dependency audit/SBOM/tests; chưa OS sandbox, quotas đầy đủ, release license/signing/legal gate |

Đánh giá chỉ theo các khả năng được nêu trong từng dòng. Không đồng nhất test parser/ELF với chạy RTL; không coi pin upstream là bằng chứng tương thích. Các thiết kế và schema phụ thuộc native spikes tiếp tục là provisional.

Kiểm tra thực chạy trong lần bàn giao này:

- TypeScript strict + Vite production build: PASS.
- Contract/license policy tests: 69 PASS.
- FastAPI/SQLite/pyslang + oracle/artifact/runtime/trace guards: 53 PASS, JUnit trong [current/api-tests.xml](../test-evidence/current/api-tests.xml).
- Browser với backend thật: 8 PASS, gồm Build & Run SystemC/Yosys/Ibex, mở FST và Wellen signal/cursor. [JSON report](../test-evidence/M1/browser-tests.json), [Ibex UI](../test-evidence/runtime/ibex-workbench.png).
- Engine runtime: 16/16 baseline/negative trên 8 profile đạt kỳ vọng; [report](../test-evidence/runtime/REPORT.md), [JUnit](../test-evidence/runtime/api-acceptance.xml). Cancel/timeout/process descendants và Wellen precision/XZ cũng đã kiểm tra thật.
- Native RTL regression riêng: 7/7 đạt kỳ vọng, gồm 1 firmware hỏng được phát hiện; [report](../test-evidence/real-soc/REPORT.md), [JUnit](../test-evidence/real-soc/junit.xml).
- npm audit ở bộ dependency cuối: không có vulnerability được registry báo tại thời điểm chạy; đây không phải bảo đảm security/release.
- npm license/text audit: 106 package được cài trên Windows; optional platform packages vắng mặt được liệt kê riêng. [Report](../test-evidence/current/license-development.json).
- Python: 31 wheel được ghim và có hash; license audit còn REVIEW_REQUIRED cho các mục được liệt kê. [Report](../test-evidence/current/python-licenses.json).
- Toolchain Linux riêng: 37 wheel có hash, resolve offline đạt; OS packages/binary/source pins/notices được lưu trong [runtime evidence](../test-evidence/runtime/REPORT.md); license release vẫn REVIEW_REQUIRED.

Một lần chạy browser trước đó gặp `net::ERR_NO_BUFFER_SPACE` ngay tại navigation của test thứ năm. Test riêng sau đó đạt, rồi toàn bộ 5 test chạy lại cùng nhau đạt. Có một warning của Starlette về httpx trong test client; runtime application không phụ thuộc test client. Linux GitHub Actions đã được cấu hình nhưng **chưa chạy trên remote CI**.

Các phần bị chặn cần môi trường native: [M4 platform blocker](../test-evidence/M4/PLATFORM_BLOCKER.md). Các giới hạn bảo mật local: [ADR-006](../decisions/ADR-006-local-contracts.md). Không tự công bố full hybrid hoặc 100% OSS-compliant release.
