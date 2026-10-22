# ADR-004 — Modular monolith / isolated processes

Status: PROVISIONAL. Origin: blueprint §2, §§4,12,16. Decision: FastAPI + Pydantic + SQLite abstraction cho local MVP; PostgreSQL sau. Worker độc lập cho RTL, C++ bridge và Rust waveform. Không đưa compiler vào request thread. Không thêm Redis/microservice khi chưa có nhu cầu được đo.

Python 3.11+ là requirement, exact runtime/framework pins chưa chọn vì host hiện chưa có interpreter chạy được. Không thay backend bằng Node vì tooling M0 dùng Node. Node dependency hiện chỉ là Ajv development + transitives, [SBOM](../../sbom/m0-development.cdx.json).

Security: worker unprivileged, readonly source, bounded output, network disabled, quotas, process-group cancellation; tất cả là acceptance bắt buộc trước nhận RTL người dùng. M0 doctor không phải worker/sandbox. Chưa có runtime, API, RBAC hoặc offline simulation proof.

Migration: RunManifest immutable và versioned, content-addressed artifacts; thay SQLite/queue bằng backend team không đổi domain contract. M1 chỉ bắt đầu sau khi M0 được đánh giá với bằng chứng spikes và các blockers được giải quyết hoặc quyết định hoãn rõ ràng.
