# License policy / release gate

Theo blueprint §3. Preferred exact SPDX: MIT, BSD-2/3-Clause, ISC, Apache-2.0 (0BSD cho installed transitives). Copyleft vẫn là OSS nhưng cần review linking, changes, distribution/hosting và notices; không tự duyệt qua metadata. Unknown, proprietary, source-available ngoài chính sách và dockview-enterprise bị chặn. Complex SPDX expression không tự accept theo substring.

M0 chỉ cài Ajv development với lockfile và bốn transitive dependencies. Script đối chiếu version/license installed với lock và lưu text/hash LICENSE, tạo CycloneDX development BOM + notices. Đây không phải ScanCode/ORT scan hoặc legal certification, không có coverage hệ điều hành, image, toolchain, firmware hay future product dependencies.

`npm.cmd run audit:licenses` kiểm tra dependency development hiện có. `npm.cmd run release:gate` cố ý trả exit 1 vì project license chưa chọn, M0 chưa đạt feasibility, product closure chưa audit và thiếu signed release manifest. Không đổi những blocker này thành PASS chỉ vì unit tests xanh. Gate hiện fail-closed cho prototype; phải thay hardcoded M0 blockers bằng trusted evidence review khi phát triển release pipeline thực.

`npm.cmd run audit:upstreams` là thao tác network **refresh nghiên cứu**, có thể cập nhật heads thành SHA mới; không chạy khi replay/offline. Build future phải dùng SHA trong lock, không requested_ref hoặc latest. Root upstream license hashes không bằng submodule/per-file audit. `audit-features.mjs` đọc exact pinned docs, chỉ kiểm tra source markers và hash, không kiểm tra runtime/API ABI.

Imported proprietary RTL là project data với quyền riêng, không là dependency được bundle. Không áp dụng allowlist redistributed dependencies để mặc nhiên từ chối mọi source riêng; không gửi source ra network bằng audit scripts. AI/model chưa được cài, không có cloud runtime dependency.
