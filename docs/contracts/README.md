# Contract drafts 1.0

> Cập nhật triển khai: `openapi.runtime.json` mô tả các route đã có, `openapi.json` vẫn là target draft. [ADR-006](../decisions/ADR-006-local-contracts.md) ghi refinements của SoC draft và giới hạn DTO prototype. Request types thực tế được sinh từ FastAPI vào `apps/web/src/api-contracts.ts`; các contract native chưa freeze.

Tám file JSON (bảy JSON Schema + OpenAPI draft) mô tả **subset M0**, chưa freeze và chưa là implementation public API. Source generator: `infra/scripts/generate-contracts.mjs`; đổi definitions rồi regenerate, chạy `npm.cmd run check`. Validator: Ajv draft 2020-12, strict, additionalProperties=false. Đặt schemas ở đây theo §22; không tạo bản copy thứ hai trong schemas/ gây hai nguồn sự thật.

| Contract | Bao gồm |
|---|---|
| chm | project ID, source revisions, IP definitions, SoC snapshots |
| ip-package | identity, source/hash, rights, ports/bus, clocks/reset, evidence, dependency pins |
| soc-config | instances, interfaces, connections, MMIO ranges, clocks/reset |
| cpu-profile | provider/source/ISA/XLEN, boot, capabilities/reasons, rights |
| run-manifest | snapshot/board/CPU/firmware/scenario/toolchain/adapters, seed, trace, quotas, AI OFF |
| trace-event | per-run seq, transaction identity, integer time, correlation |
| selection | camelCase theo §5.3, originId, stable IDs, exact/derived/unavailable |

Chuỗi timestamp/address không dùng Number. Semantic checks trong `infra/scripts/contracts.mjs` phải chạy **sau** schema validation: half-open ranges, overflow/alignment, endpoints/roles/protocol/width/domain, duplicate target, explicit adapter policy, evidence links và run prerequisites. Không dùng các helper này làm production service.

Known gaps: CHM chưa có đầy đủ registers/fields/interrupts/views/scenarios/migrations; chưa kiểm tra ELF hoặc boot region, bridge registry, CSR semantics, filelist/include containment. Trace từng loại event còn cần refine discriminated payload và response/timeout fields. Evidence link check chưa chứng minh artifact thật hoặc quyền review: điều đó cần trusted artifact store + execution + reviewer identity sau. Không được dùng schema fixture để công bố IP VERIFIED. SUPPORTED cần provider evidence check ở backend sau, không chỉ schema enum.

Fixtures trong `tests/contract/fixtures.mjs` ghi rõ synthetic, không phải RTL/vendor provenance. Test AI OFF hiện chỉ kiểm tra contract, không chứng minh base simulation offline (§18 E2E-14 chưa chạy).

Migration: trước freeze có thể đổi draft và fixtures cùng nhau qua ADR; sau freeze cần explicit version converter, backward compatibility test và review theo blueprint. Không tự đọc schema 2.0 như 1.0.
