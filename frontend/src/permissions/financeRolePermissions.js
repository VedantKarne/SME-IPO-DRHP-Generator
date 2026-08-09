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
  founder: {
    label: 'Founder / Promoter',
    description: 'Initiates company onboarding, uploads documents, provides company data, and reviews section drafts.',
    can: [
      'Start company DRHP workspace',
      'Upload financial & statutory documents',
      'Fill guided onboarding interview',
      'View SEBI eligibility report',
      'Respond to CA clarification requests',
      'Export compiled DRHP document',
    ],
    cannot: [
      'Certify/lock DRHP sections (Merchant Banker only)',
      'Verify statutory financial figures (CA only)',
      'Modify system-wide access controls or users',
    ],
  },
  finance_ca: {
    label: 'Finance / CA',
    description: 'Audits financial disclosures, verifies extracted financial KPIs, and approves 6 financial DRHP sections.',
    can: [
      'Read & review 6 financial DRHP sections',
      'Correct extracted financial KPIs (Revenue, EBITDA, PAT, Net Worth)',
      'Verify fiscal year financial statements',
      'Add section comments & request clarifications from Founder',
      'Approve financial content figures (status: finance_verified)',
    ],
    cannot: [
      'Approve legal, corporate, or offer sections',
      'Lock or certify DRHP sections (sets is_locked=True)',
      'Unlock sections already certified by Merchant Banker',
      'Modify platform system administration settings',
    ],
  },
  legal_advisor: {
    label: 'Legal Advisor',
    description: 'Reviews legal disclosures, litigation risk factors, corporate history, and statutory compliance clauses.',
    can: [
      'Review legal & corporate DRHP sections',
      'Flag litigation disclosures & KMP risk factors',
      'Verify SEBI ICDR statutory compliance citations',
      'Add legal review notes & commentary',
    ],
    cannot: [
      'Verify statutory financial statement figures (CA only)',
      'Lock or certify DRHP sections (Merchant Banker only)',
      'Modify platform-wide user accounts or system rules',
    ],
  },
  merchant_banker: {
    label: 'Merchant Banker',
    description: 'Lead manager holding exclusive regulatory authority to certify and lock DRHP sections.',
    can: [
      'Review all 25 DRHP sections & consistency checks',
      'Request section revisions from issuer',
      'Certify and lock DRHP sections (sets is_locked=True)',
      'Sign off on final offer document before submission',
    ],
    cannot: [
      'Modify system administration settings or server rules',
      'Bypass CA verification of financial statements',
    ],
  },
  admin: {
    label: 'System Admin',
    description: 'System console administrator managing platform access, user accounts, projects, audit logs, and rules.',
    can: [
      'Create and invite platform users',
      'Assign and update user roles',
      'Remove users and deactivate accounts',
      'Assign users to IPO projects',
      'Inspect chronological audit logs & system health',
      'View SEBI ICDR regulatory intelligence rulesets',
    ],
    cannot: [
      'Edit DRHP section content or draft text',
      'Approve or certify DRHP sections',
      'Override legal decisions',
      'Change company financial or statutory data',
    ],
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

/**
 * getRolePermissionsSummary(role) -> { label, description, can: [], cannot: [] }
 *
 * Pulled by the Roles & Permissions page to display exact, authoritative
 * permission summaries directly from this centralized permissions module.
 */
export function getRolePermissionsSummary(role) {
  return ROLE_PERMISSIONS[role] || {
    label: role,
    description: 'Custom user role',
    can: [],
    cannot: [],
  };
}

export function getAllRolePermissionSummaries() {
  return Object.keys(ROLE_PERMISSIONS).map((roleKey) => ({
    key: roleKey,
    ...ROLE_PERMISSIONS[roleKey],
  }));
}
