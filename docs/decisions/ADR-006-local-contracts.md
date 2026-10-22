# ADR-006 — Version 1.0 draft refinements and bounded local scope

Status: ACCEPTED for the local prototype; architecture freeze remains open. ADR-005 authorizes continuous development while hardware feasibility is blocked.

The M0 schemas were explicitly DRAFT. Refine SoCConfig 1.0 draft to include project_id and allow an empty initial topology, matching the actual Pydantic model. Add a cross-language integration test that validates API-shaped SoC output against the shared JSON Schema. No released stable schema or persisted production database was migrated; M0 evidence remains a historical snapshot.

Implemented OpenAPI lives in openapi.runtime.json and generated request types in apps/web/src/api-contracts.ts. openapi.json remains a labelled target roadmap, not an assertion that every target operation exists. Some response structures remain prototype DTOs rather than the full CHM/IP package contract. This is an explicit M2/M3 limitation; full packaging/publication is not claimed.

RTL-analysis runs have a separate kind and manifest from native simulation RunManifest. The tool version, ordered source snapshot, analysis worker hash, top, Python version and limits are recorded. PASS is scoped to parsing/elaboration only. No waveform signal ID is fabricated from a port label; source cross-probing uses exact compiler file/line and source IDs, while trace mapping stays unavailable.

Local API is single-user and loopback-only with Host/Origin guards and a required custom client header on mutations. It does not implement team RBAC, cryptographic identity, an OS sandbox or full resource isolation. Native simulation remains disabled. A parser child process is not promoted to a sandbox claim.

License choices: do not install ELK. Use Vite 7.3.7 / plugin-react 5.2.0 to avoid the unreviewed MPL build dependency observed with Vite 8. DOMPurify 3.4.16 selects its offered Apache-2.0 alternative; retain license text. caniuse-lite is build-time CC-BY-4.0 data with attribution retained. Native npm binary packages retain the matching-version parent tool license, checking version and SPDX equality. Python audit separates runtime/test scopes; certifi MPL-2.0 is test-only and remains a review item, not a cleared redistributed runtime integration.
