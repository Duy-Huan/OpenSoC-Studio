# ADR-005 — Continue milestones without per-milestone approval

Status: ACCEPTED for development sequencing. The user explicitly requested continuing successive milestones without stopping at each milestone on 2026-10-22. This supersedes the initial handoff's M0-only sequencing restriction. Preserve the two original input documents as historical baselines.

Implement independent local workbench, import, registry and composition capabilities while native simulator spikes remain open. Record acceptance and blockers separately for each milestone. Do not promote experimental CPU/hybrid support, VERIFIED IP, full release readiness or hardware verdicts without actual execution evidence. Architecture contracts remain provisional where spikes have not resolved risk.

Use a workspace-local portable Python interpreter and exact dependency locks; do not change Windows execution policy or install system-wide tools. Keep runtime local-first with AI OFF. Native tool execution remains disabled until an isolated worker is configured. Parser work is bounded and process-isolated; it is not a full OS sandbox and must be described accordingly.

M1 may be delivered with a real source-analysis worker and real log/artifact events. An analysis job must be labelled RTL analysis and must never be labelled hardware simulation. M2 adds actual slang AST/elaboration. M3 provides immutable reviewed packaging/reuse while VERIFIED publication remains gated on simulation evidence. M5 may proceed with canonical validators independently of M4/M6–M8; their hardware gates stay open.
