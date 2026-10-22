# Unresolved license and release decisions

Current supplement: the workbench installs permissive React/Dockview OSS/Monaco/React Flow dependencies; ELK is not installed. DOMPurify selects its Apache-2.0 alternative. Vite 8/Lightning CSS were removed in favor of pinned Vite 7, avoiding an unapproved MPL build integration. Build-time caniuse-lite CC-BY-4.0 attribution is retained. Matching-version npm native binaries retain the parent tool license. Python scope/evidence is in `docs/test-evidence/current/python-licenses.json`: unresolved evidence, PSF/bundled terms, permissive alternative review and test-only certifi MPL remain review items. No copyleft distribution/hosting exception is granted. The following M0 release issues remain open.

- Project-owned code: license not selected by owner. `package.json` is private/UNLICENSED; no project LICENSE has been invented. OSS release is blocked.
- `elkjs@0.12.0`: EPL-2.0 OR GPL-3.0-or-later; CONDITIONAL/REVIEW_REQUIRED, not installed. Review or choose a separately audited layout implementation before M1 integration.
- Verilator root LICENSE alone is LGPLv3; blueprint reports an Artistic alternative. Review COPYING/ARTISTIC, runtime/generated code, exact pin and distribution mode before use; no blanket exception granted.
- gem5, Chipyard, Dockview root GitHub metadata reports NOASSERTION. Saved text needs scoped manual interpretation: gem5 includes mixed third-party licenses, Chipyard submodules require closure, Dockview root explicitly excludes proprietary enterprise packages. No unknown metadata silently converted into compliance approval.
- SystemC NOTICE/third-party; Ibex/OpenTitan module exceptions and firmware/compiler runtime; Wellen/Flutter transitive crates/packages/assets; Docker base image/packages: NOT_AUDITED.
- No copyleft exception or enterprise integration is approved by this file. External release review/signing remains open per blueprint.
