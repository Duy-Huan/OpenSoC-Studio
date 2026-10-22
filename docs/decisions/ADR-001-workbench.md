# ADR-001 — Workbench React

Status: PROVISIONAL. Origin: blueprint §2, §5. Decision: React + TypeScript strict, Dockview **OSS**, Monaco, React Flow. CHM/API sở hữu semantics; graph là editor/controller. Không dùng dockview-enterprise. Theia/GLSP hoãn.

Exact registry candidates và source revisions: [upstream lock](../compliance/upstream-lock.json). Dockview root LICENCE ở pin là monorepo mixed-license; chỉ package OSS có MIT, không được duyệt cả monorepo. `elkjs@0.12.0` khai báo EPL-2.0 OR GPL-3.0-or-later: **REVIEW_REQUIRED**, chưa cài. Auto-layout có adapter, chưa khóa dependency ELK trước license gate. Không thay đổi lựa chọn license một cách ngầm định.

Consequence: kiểm soát UX/source/wave/composer nhưng phải tự thực hiện keyboard/accessibility, workspace persistence và typed selection. Acceptance M1: persisted layout/project với backend thật. Hiện chưa thực hiện. Migration: giữ stable IDs và versioned layout riêng CHM; thay layout engine không được sửa semantics.
