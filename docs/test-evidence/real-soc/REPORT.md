# Regression minimal SoC thực — 2026-10-22

**STATE: PASS cho profile PicoRV32 tham chiếu; V1.0 tổng thể vẫn PARTIAL.** Đã biên dịch firmware, elaboration và chạy CPU RTL lấy từ GitHub. Không dùng emulator CPU, mock simulator hay transcript dựng sẵn.

Source: [YosysHQ/picorv32 tại revision cố định](https://github.com/YosysHQ/picorv32/tree/ef203c2b0a3fb793280f5114941416c425c5b461). Đây là upstream AXI reference system trong `testbench.v`: CPU PicoRV32 RV32IMC, RAM 128 KiB, bộ nhớ AXI, ngắt timer/fast/slow, cổng xuất ký tự MMIO và thanh ghi kết quả. Không phải board PicoSoC SPI flash và không phải Ibex.

| Địa chỉ | Mô tả đã chạy |
|---|---|
| `0x00000000..0x0001ffff` | RAM/firmware, reset PC 0 |
| `0x10000000` | Ghi byte ký tự ra console mô phỏng; không phải UART serial có baud rate |
| `0x20000000` | Ghi `123456789` để báo firmware hoàn tất thành công |

Toolchain: OSS CAD Suite Windows x64 2026-10-21, Icarus 14.0 development (`s20260301-631-gce9868196-dirty`); xPack RISC-V GCC 15.2.0-1. Firmware BIN 94,828 bytes; ELF 128,392 bytes. Source gốc không sửa; monitor bổ sung và mọi input/tool binary chính được ghi SHA256. Chi tiết trong [regression.json](regression.json), [JUnit](junit.xml), [download simulator](toolchain-download.json), [download GCC](gcc-download.json).

## Kết quả thực thi

Final run: `artifacts/real-soc/20261022T063044Z`.

| Kịch bản | Kết quả | Chu kỳ / kiểm tra |
|---|---|---|
| baseline | PASS | 486,831 cycles |
| AXI random delays, seed 88172645463325252 | PASS | 654,797 cycles |
| AXI random delays, seed 17 | PASS | 654,078 cycles |
| Single-port register file | PASS | 538,766 cycles |
| Replay baseline | PASS | 486,831 cycles; hash CPU trace, MMIO và firmware giống baseline |
| Reset giữa lúc đang chạy counter | PASS | 23 lần ghi trước reset, 22 sau reset; cả hai dãy bắt đầu 0 và tăng liên tiếp |
| Firmware word đầu bị đổi thành `ffffffff` | EXPECTED_FAIL_DETECTED | CPU trap sau 24 cycles, vvp exit 1; không có success sentinel |

Mỗi lần chạy firmware đầy đủ đạt đúng 45 tên assembly test upstream (load/store byte/half/word, branch/jump, arithmetic/logic, mul/div/rem...). Host Python kiểm tra độc lập 31 số nguyên tố tới 127, checksum upstream `1772A48F`, 15 vector nhân/chia signed/unsigned gồm divide-by-zero và signed overflow, cùng cả ba nguồn interrupt có đếm > 0. UART tái dựng từ MMIO phải khớp stdout, timestamp phải tăng đơn điệu, success sentinel phải xuất hiện. Tổng cộng 5 lượt firmware đầy đủ = 225 nhóm assembly và 75 vector nhân/chia; đây không phải số lượng test case của JUnit.

[Baseline stdout](logs/baseline.stdout.log), [AXI seed mặc định](logs/axi_delays_seed_default.stdout.log), [AXI seed 17](logs/axi_delays_seed_17.stdout.log), [single-port](logs/singleport_register_file.stdout.log), [reset](logs/counter_reset.stdout.log), [negative control](logs/corrupt_firmware_negative_control.stdout.log). Raw VCD baseline 29,737,733 bytes, CPU trace, MMIO JSONL và ELF nằm trong thư mục artifacts kể trên; download từ workbench và xác minh SHA256 theo manifest. Files lớn được gitignore, không giả định có sẵn trên checkout mới.

## Workflow ứng dụng và regression

Thêm view **RTL Regression** vào workbench: bảng kết quả, tải log/ELF/VCD/trace/MMIO; endpoint chỉ đọc và kiểm tra hash/path. Playwright đã import source `picorv32.v` + `testbench_ez.v` từ checkout GitHub, chạy pyslang thật cho top `testbench`, kiểm tra hierarchy, mở bảng 7 kết quả, tải VCD và đối chiếu hash với bytes thật. [Ảnh workbench](workbench.png).

`npm.cmd run verify`: **69 Node + 47 API/oracle + 6 browser = 122 PASS**, exit 0. [Bản ghi lệnh](../current/verification.json), [API JUnit](../current/api-tests.xml), [browser JSON](../M1/browser-tests.json). Regression phần cứng là 7 lượt native riêng trong JUnit phía trên, không đồng nhất 122 test ứng dụng với kiểm chứng CPU. API tests gồm các trường hợp toán học biên, sửa sai output của oracle, hash mismatch và chặn artifact path escape.

## Chạy lại

```powershell
# Đã có toolchain trên workspace này. Checkout mới: tải ~1.07 GB archive,
# cần Windows x64, Node 24, Git, Windows tar và Python/app đã setup.
node infra/scripts/setup-reference-sim.mjs
npm.cmd run sim:reference
npm.cmd run verify
npm.cmd start
```

Mở http://127.0.0.1:8000 → **Open RTL Regression** ở thanh bên (hoặc Ctrl+K → Open reference). CLI chạy trực tiếp fixed profile; nút Analyze RTL vẫn chỉ phân tích source. Không cần tự viết SystemC hay firmware để chạy reference này. `--quick` chỉ chạy baseline, không phải full regression.

## Những lỗi đã phát hiện và giới hạn

- Lần đầu gọi vvp thiếu DLL PATH của suite nên không chạy. Runner hiện thêm cả `bin` và `lib`.
- Hai lần thử harness trước đó FAIL: regex đếm nhầm `...OK` thay vì `..OK`, rồi giả định 10 vector thay vì 15. Đã kiểm tra source `riscv_test.h`/`multest.c`, sửa oracle và chạy lại toàn bộ; không sửa RTL để tạo PASS. Raw run cũ vẫn giữ trong artifacts (`20261022T062125Z`, `20261022T062333Z`).
- Docker engine trả HTTP 500; chưa có Linux container workflow. Windows Job Object giới hạn tài nguyên nhưng chưa cô lập filesystem/network. Vì vậy worker này chỉ dành cho fixed reference đã xem source; API chạy RTL tùy ý vẫn 424.
- VCD thật đã tạo và download; embedded Wellen/FST, waveform cursor/cross-probe, protocol assertion coverage, random reset trong full firmware và formal sign-off chưa chạy. Fetch JSONL không được coi là trace retired PC. MMIO correlation là DERIVED.
- Ibex/Verilator spike, gem5/SystemC và V1.0 đầy đủ vẫn chưa đạt gate. Các test chứng minh đúng hành vi của cấu hình/phần mềm/kịch bản này, không chứng minh mọi SoC hay mọi cấu hình CPU.
- External toolchain/license/runtime closure còn REVIEW_REQUIRED; xem [license scope](../../compliance/REFERENCE_SIMULATION.md), [ADR-007](../../decisions/ADR-007-reference-rtl-regression.md).
