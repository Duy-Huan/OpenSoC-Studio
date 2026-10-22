# ADR-003 — CPU RTL / architecture / hybrid

Status: PROVISIONAL. Origin: blueprint §2, §§6,10. Decision: lane riêng rtl_standalone, rtl_cpu_soc, gem5_arch, gem5_hybrid. Ibex official Simple System là reference đầu tiên; Rocket dùng Chipyard provider flow. Hybrid dùng gem5 CPU điều khiển RTL peripheral, không mặc định chạy đồng thời CPU RTL và gem5 CPU.

Pins: [upstream-lock](../compliance/upstream-lock.json). Spike A/B trong [SPIKES](../reference-platforms/SPIKES.md). gem5 util/tlm ở pin dùng **Gem5SlaveTransactor initiator socket cho gem5→TLM**, Gem5MasterTransactor target socket cho TLM→gem5; không đoán theo tên. Demo ban đầu dùng ARM/config traffic, không chứng minh RISC-V firmware MMIO.

HIGH risk: SystemC 3.0.1 chưa chứng minh tương thích gem5 v24.1.0.3; tcmalloc/pthread limitations upstream; ABI, event queue, timing quantization, backpressure/reset/timeout. Không khóa tổ hợp thành supported. Tick contract dùng fs integer với origin/domain; chưa chọn quantum/posedge ordering trước spike.

Migration: CPU profile và manifest pin toàn bộ board/generator/toolchain. Không swap lane của run đã tạo. Hybrid chỉ supported sau M8 E2E; trước đó UI phải báo experimental/blocked theo capability evidence.
