/**
 * impactKeys.js — the 4 keys src/api/impact_router.py's IMPACT_MAP actually
 * recognizes (a static dependency lookup, not live regulation-change
 * monitoring — see PROJECT_CONTEXT.md). Shared by Compliance.jsx's "Data
 * Dependency Map" and DependencyGraph.jsx so both stay in sync with the
 * same 4 real backend keys.
 */
export const IMPACT_KEYS = [
  { key: 'total_issue_size_lakhs', label: 'Total Issue Size' },
  { key: 'ebitda_lakhs',           label: 'EBITDA' },
  { key: 'litigation',             label: 'Litigation' },
  { key: 'registered_office',      label: 'Registered Office' },
];
