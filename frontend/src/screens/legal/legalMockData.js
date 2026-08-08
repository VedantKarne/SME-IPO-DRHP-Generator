/**
 * legalMockData.js
 *
 * Mock data for the Legal Advisor dashboard.
 * Shape mirrors what a real API response would return once the legal-review
 * backend endpoints are wired up.
 *
 * NOTE: This is placeholder data only -- pending real backend integration.
 * Replace each export with a real authedFetch call when the API is ready.
 */

// --- Summary panel -----------------------------------------------------------

/** Overall legal readiness score (0-100) shown in the score ring. */
export const LEGAL_READINESS_SCORE = 67;

/** Quick-stat metrics shown alongside the ring. */
export const LEGAL_SUMMARY_STATS = [
  { label: 'Sections Reviewed', value: '12/18' },
  { label: 'Pending Review',    value: 6 },
  { label: 'Issues Found',      value: 4 },
];

// --- Priority list -----------------------------------------------------------

/**
 * High-priority legal areas displayed in the Priority panel.
 * status: 'issues' | 'pending' | 'clear'
 */
export const LEGAL_PRIORITY_ITEMS = [
  {
    id:     'risk-factors',
    label:  'Risk Factors',
    status: 'issues',
    note:   '2 disclosures need re-wording for SEBI ICDR compliance.',
  },
  {
    id:     'litigation',
    label:  'Litigation',
    status: 'issues',
    note:   'One pending High Court matter requires updated disclosure.',
  },
  {
    id:     'legal-proceedings',
    label:  'Legal Proceedings',
    status: 'pending',
    note:   'Awaiting promoter affidavit for ongoing NCLT matter.',
  },
];

// --- Content area cards ------------------------------------------------------

/**
 * Legal content areas a Legal Advisor reviews in the DRHP.
 * status: 'issues' | 'pending' | 'clear' | 'draft'
 * reviewedBy: string | null (null = not yet assigned)
 */
export const LEGAL_CONTENT_AREAS = [
  {
    id:          'risk-factors',
    title:       'Risk Factors',
    description: 'Material risks that could adversely affect the issuer business, including regulatory, financial, and operational risks.',
    status:      'issues',
    lastUpdated: '2026-08-07',
    reviewedBy:  'Adv. Priya Mehta',
    issueCount:  2,
    section:     'Section II - Risk Factors',
  },
  {
    id:          'legal-proceedings',
    title:       'Legal Proceedings',
    description: 'Pending or threatened legal, regulatory, or arbitration proceedings involving the company or its promoters.',
    status:      'pending',
    lastUpdated: '2026-08-06',
    reviewedBy:  null,
    issueCount:  0,
    section:     'Section X - Legal & Other Information',
  },
  {
    id:          'outstanding-litigation',
    title:       'Outstanding Litigation',
    description: 'Summary of all outstanding litigation, contingent liabilities, and material disputes as required under SEBI ICDR.',
    status:      'issues',
    lastUpdated: '2026-08-05',
    reviewedBy:  'Adv. Priya Mehta',
    issueCount:  1,
    section:     'Section X - Legal & Other Information',
  },
  {
    id:          'material-contracts',
    title:       'Material Contracts',
    description: 'Key agreements material to the business: customer contracts, supplier agreements, IP licences, and financing facilities.',
    status:      'clear',
    lastUpdated: '2026-08-04',
    reviewedBy:  'Adv. Rohan Singhania',
    issueCount:  0,
    section:     'Section IX - Material Contracts',
  },
  {
    id:          'govt-regulatory',
    title:       'Government & Regulatory Matters',
    description: 'Licences, permissions, approvals, and government orders that are material to operations or the IPO itself.',
    status:      'clear',
    lastUpdated: '2026-08-03',
    reviewedBy:  'Adv. Rohan Singhania',
    issueCount:  0,
    section:     'Section X - Legal & Other Information',
  },
  {
    id:          'other-disclosures',
    title:       'Other Legal Disclosures',
    description: 'Residual legal disclosures including related-party transactions with legal implications, promoter declarations, and compliance certificates.',
    status:      'draft',
    lastUpdated: '2026-08-08',
    reviewedBy:  null,
    issueCount:  0,
    section:     'Section XI - Other Regulatory Disclosures',
  },
];
