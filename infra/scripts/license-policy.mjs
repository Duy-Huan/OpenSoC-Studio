export const preferred = new Set(['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Apache-2.0', '0BSD']);
export function licenseDecision(name, expression) {
  if (/dockview-enterprise/i.test(name)) return { decision: 'BLOCKED', reason: 'BANNED_PACKAGE' };
  if (!expression || ['NOASSERTION', 'UNKNOWN', 'UNLICENSED'].includes(expression)) return { decision: 'BLOCKED', reason: 'UNKNOWN_LICENSE' };
  if (/proprietary|LicenseRef-/i.test(expression)) return { decision: 'BLOCKED', reason: 'NON_OSS_OR_UNRESOLVED_LICENSE' };
  if (preferred.has(expression)) return { decision: 'PREFERRED', reason: 'EXACT_ALLOWLIST_MATCH' };
  // Deliberately fail closed on complex SPDX expressions; no substring acceptance.
  if (/\b(LGPL|GPL|AGPL|MPL|EPL|EUPL|Artistic)-/.test(expression)) return { decision: 'REVIEW_REQUIRED', reason: 'CONDITIONAL_EXPRESSION' };
  return { decision: 'BLOCKED', reason: 'UNREVIEWED_EXPRESSION' };
}
