# ADR-002 — Viewer qua adapter

Status: PROVISIONAL. Origin: blueprint §2, §§5.3–5.5. Decision: SchematicAdapter và WaveformAdapter tách UI shell; Wellen là parser/index candidate, không phải renderer. ROHD là embedded candidate cần spike D.

Nguồn/pins/license: [lock](../compliance/upstream-lock.json), [feature evidence](../compliance/upstream-feature-evidence.json). Risk HIGH: Flutter bundle/message bridge, selection origin loop, X/Z preservation, huge-file memory, optimized-away/source mapping. Không coi chữ WIP từ baseline là kết quả kiểm tra maturity hiện tại; cần benchmark thực tế ở pin.

Acceptance: cùng một artifact thật, signal ID/time/cursor được cross-probe; đo load/RSS/window latency, markers, disposal và sandbox iframe. Thiếu map trả UNAVAILABLE. So sánh ROHD với Wellen service + renderer riêng trên cùng waveform. Chưa có artifact/toolchain, trạng thái NOT_EXECUTED. Không tạo waveform giả để đạt gate.

Migration: transport cửa sổ bounded, IDs do trace index sở hữu, plugin bridge version 1.0. Thay viewer không đổi RunManifest hoặc event identity. Fallback viewer ngoài ứng dụng chỉ khi audit license và ghi invocation.
