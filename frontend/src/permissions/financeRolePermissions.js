// Single centralized permission module for the Finance/CA role's review
// workflow. Every Finance/CA UI control that performs an action (upload,
// correct, verify, comment, request clarification, approve) checks `can()`
// here before rendering, rather than each component re-implementing its
// own role/section logic — so the full set of "what Finance/CA can do" is
// auditable in one place and easy to extend when Merchant Banker / Legal
// get their own frontend rules later.
//
// This is the UX layer only — it decides whether to *show* a control. The
// real gate is server-side in src/api/finance_permissions.py /
// finance_router.py; if the two ever drift, the backend wins (a hidden-but-
// reachable control would still get a 403, never a silent bypass).
//
// FINANCE_APPROVABLE_SECTIONS must be kept in sync with the identically-
// named list in src/api/finance_permissions.py.
export const FINANCE_APPROVABLE_SECTIONS = [
  'Capital Structure',
  'Objects of the Offer',
  'Statement of Tax Benefits',
  'Dividend Policy',
  'Financial Statements (3 Years)',
  'Management Discussion & Analysis',
];

const isFinancialSection = (sectionName) => FINANCE_APPROVABLE_SECTIONS.includes(sectionName);

const ROLE_PERMISSIONS = {
  finance_ca: {
    uploadDocuments: true,
    viewFinancialData: true,
    correctFinancialData: true,
    verifyFinancialData: true,
    viewEvidence: true,
    commentOnSection: (sectionName, section) => isFinancialSection(sectionName) && !section?.locked,
    requestClarification: (sectionName, section) => isFinancialSection(sectionName) && !section?.locked,
    approveSection: (sectionName, section) => isFinancialSection(sectionName) && !section?.locked,
    // Explicitly false — listed for audit completeness, not because any
    // component currently checks these (nothing in the Finance/CA UI
    // offers them, so there's no control to hide).
    finalizeDrhp: false,
    approveLegalSection: false,
    modifyComplianceRules: false,
    unlockCertifiedSection: false,
  },
};

/**
 * can(role, action, sectionName?, section?) -> boolean
 *
 * `section`, when passed, is the section object as returned by
 * GET /api/sections/{company_id} ({ name, locked, status, ... }) — used to
 * hide actions on sections already certified by the Merchant Banker.
 */
export function can(role, action, sectionName, section) {
  const rules = ROLE_PERMISSIONS[role];
  if (!rules) return false;
  const rule = rules[action];
  if (typeof rule === 'function') return rule(sectionName, section);
  return Boolean(rule);
}
