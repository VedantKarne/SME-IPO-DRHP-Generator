/**
 * legalMockData.js
 *
 * Authoritative mock data for the Legal Advisor dashboard and all sub-pages.
 *
 * DATA RULE: Every value here is logged in HARDCODED_DATA_LOG.md.
 * Shape mirrors what the real API/engine would return so swapping in real
 * data later only requires changing legalApi.js — not this file or the UI.
 *
 * Exports (all public):
 *   Dashboard:   LEGAL_READINESS_SCORE, LEGAL_SUMMARY_STATS, LEGAL_PRIORITY_ITEMS,
 *                LEGAL_CONTENT_AREAS, LEGAL_RECENT_ACTIVITY
 *   Sections:    LEGAL_DRAFT_SECTIONS
 *   Documents:   LEGAL_DOCUMENTS
 *   Compliance:  LEGAL_COMPLIANCE_ITEMS
 *   Queue:       LEGAL_REVIEW_QUEUE
 *   Comments:    LEGAL_COMMENTS
 *   Activity:    LEGAL_ACTIVITY_LOG
 */

// ---------------------------------------------------------------------------
// Dashboard — summary panel
// ---------------------------------------------------------------------------

/** Legal readiness score 0-100. Real: /api/session/restore → readiness.legal_readiness */
export const LEGAL_READINESS_SCORE = 67;

/** Quick-stat cards alongside the ring. Real: derived from /api/session/restore sections. */
export const LEGAL_SUMMARY_STATS = [
  { label: 'Sections Reviewed', value: '4/6' },
  { label: 'Pending Review',    value: 2 },
  { label: 'Issues Found',      value: 4 },
];

// ---------------------------------------------------------------------------
// Dashboard — priority panel
// Real: /api/legal/flags reading GeneratedSection.flagged_gaps
// ---------------------------------------------------------------------------

/**
 * Priority items for the dashboard panel.
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
    id:     'outstanding-litigation',
    label:  'Outstanding Litigation',
    status: 'issues',
    note:   'HC Bombay matter — amount in dispute not quantified.',
  },
  {
    id:     'legal-proceedings',
    label:  'Legal Proceedings',
    status: 'pending',
    note:   'Awaiting promoter affidavit for NCLT matter.',
  },
  {
    id:     'other-disclosures',
    label:  'Other Legal Disclosures',
    status: 'pending',
    note:   'Promoter declaration items incomplete.',
  },
];

// ---------------------------------------------------------------------------
// Dashboard — content area cards (existing, unchanged shape)
// ---------------------------------------------------------------------------

export const LEGAL_CONTENT_AREAS = [
  {
    id:          'risk-factors',
    title:       'Risk Factors',
    description: 'Material risks that could adversely affect the issuer business, including regulatory, financial, and operational risks.',
    status:      'issues',
    lastUpdated: '2026-08-07',
    reviewedBy:  'Adv. Priya Mehta',
    issueCount:  2,
    section:     'Section II – Risk Factors',
  },
  {
    id:          'legal-proceedings',
    title:       'Legal Proceedings',
    description: 'Pending or threatened legal, regulatory, or arbitration proceedings involving the company or its promoters.',
    status:      'pending',
    lastUpdated: '2026-08-06',
    reviewedBy:  null,
    issueCount:  1,
    section:     'Section X – Legal & Other Information',
  },
  {
    id:          'outstanding-litigation',
    title:       'Outstanding Litigation',
    description: 'Summary of all outstanding litigation, contingent liabilities, and material disputes as required under SEBI ICDR.',
    status:      'issues',
    lastUpdated: '2026-08-05',
    reviewedBy:  'Adv. Priya Mehta',
    issueCount:  1,
    section:     'Section X – Legal & Other Information',
  },
  {
    id:          'material-contracts',
    title:       'Material Contracts',
    description: 'Key agreements material to the business: customer contracts, supplier agreements, IP licences, and financing facilities.',
    status:      'clear',
    lastUpdated: '2026-08-04',
    reviewedBy:  'Adv. Rohan Singhania',
    issueCount:  0,
    section:     'Section IX – Material Contracts',
  },
  {
    id:          'govt-regulatory',
    title:       'Government & Regulatory Matters',
    description: 'Licences, permissions, approvals, and government orders that are material to operations or the IPO itself.',
    status:      'clear',
    lastUpdated: '2026-08-03',
    reviewedBy:  'Adv. Rohan Singhania',
    issueCount:  0,
    section:     'Section X – Legal & Other Information',
  },
  {
    id:          'other-disclosures',
    title:       'Other Legal Disclosures',
    description: 'Residual legal disclosures including related-party transactions with legal implications, promoter declarations, and compliance certificates.',
    status:      'draft',
    lastUpdated: '2026-08-08',
    reviewedBy:  null,
    issueCount:  1,
    section:     'Section XI – Other Regulatory Disclosures',
  },
];

// ---------------------------------------------------------------------------
// Dashboard — recent activity snippet (last 4 events)
// Real: /api/legal/activity limited to 4
// ---------------------------------------------------------------------------

export const LEGAL_RECENT_ACTIVITY = [
  {
    id:         'ra-001',
    actor:      'Adv. Priya Mehta',
    actionType: 'comment_added',
    target:     'Risk Factors',
    timestamp:  '2026-08-07T11:00:00Z',
    detail:     'Requested quantification of customer concentration risk.',
  },
  {
    id:         'ra-002',
    actor:      'Gap Detection Engine',
    actionType: 'ai_flag_raised',
    target:     'Outstanding Litigation',
    timestamp:  '2026-08-06T09:15:00Z',
    detail:     'Amount in dispute not quantified — SEBI ICDR Reg 238(2)(j).',
  },
  {
    id:         'ra-003',
    actor:      'Adv. Rohan Singhania',
    actionType: 'section_approved',
    target:     'Material Contracts',
    timestamp:  '2026-08-04T16:45:00Z',
    detail:     'Section approved after verifying all contract documents.',
  },
  {
    id:         'ra-004',
    actor:      'Adv. Priya Mehta',
    actionType: 'document_uploaded',
    target:     'Outstanding Litigation',
    timestamp:  '2026-08-05T14:22:00Z',
    detail:     'Uploaded HC Bombay commercial dispute court order.',
  },
];

// ---------------------------------------------------------------------------
// DRHP Sections — draft text and per-section metadata
// Real: /api/session/restore sections[], filtered to legal section names,
//       merged with legal-advisor-specific action state from /api/legal/sections/{id}/review
// ---------------------------------------------------------------------------

export const LEGAL_DRAFT_SECTIONS = [
  {
    id:             'risk-factors',
    title:          'Risk Factors',
    section:        'Section II – Risk Factors',
    status:         'issues',
    lockedByBanker: false,
    approvedBy:     null,
    approvedAt:     null,
    draftText:
`RISK FACTORS

An investment in our Equity Shares involves a high degree of risk. Prospective investors should carefully consider all the information in this Prospectus, including the risks and uncertainties described below, before making an investment in our Equity Shares.

I. RISKS RELATED TO OUR BUSINESS

1.1 We are dependent on a limited number of customers for a significant portion of our revenue. Our top [●] customers accounted for approximately [●]% of our total revenue in Fiscal Year 2025–26. The loss of any significant customer could materially affect our business.

1.2 We are subject to various regulatory requirements, including compliance with SEBI (ICDR) Regulations, 2018. Non-compliance may result in penalties, sanctions, or suspension of our operations.

1.3 Our operations may be adversely affected by changes in government policies and regulations applicable to our industry.

II. RISKS RELATED TO LITIGATION

2.1 We and certain of our Promoters are involved in certain legal proceedings, details of which are set out in the section "Outstanding Litigation" on page [●] of this Prospectus. Should any of these proceedings be decided against us, our results of operations and financial condition could be adversely affected.`,
    aiFlags: [
      {
        id:              'flag-rf-001',
        description:     'Customer concentration percentage and top-customer names are not disclosed — required under SEBI ICDR Reg 32(1)(a). Generic placeholder "[●]" remains in the draft.',
        severity:        'critical',
        engine:          'gap_detector',
        suggestedAction: 'Insert actual customer concentration percentage and disclose names of customers contributing >10% of revenue.',
      },
      {
        id:              'flag-rf-002',
        description:     'Risk factor 2.1 cross-references Outstanding Litigation but does not quantify the financial exposure — inconsistency flagged by Consistency Checker.',
        severity:        'warning',
        engine:          'consistency_checker',
        suggestedAction: 'Add quantified exposure amount (or "amount not ascertainable at this stage") with reference to the HC Bombay matter.',
      },
    ],
    comments:     [],
    evidenceDocs: ['doc-001'],
  },
  {
    id:             'legal-proceedings',
    title:          'Legal Proceedings',
    section:        'Section X – Legal & Other Information',
    status:         'pending',
    lockedByBanker: false,
    approvedBy:     null,
    approvedAt:     null,
    draftText:
`LEGAL PROCEEDINGS

Except as disclosed below, there are no pending or threatened legal, regulatory, or arbitration proceedings involving our Company, our Subsidiaries, our Directors, our Promoters, or our Group Companies that may have a material impact on our business, financial condition, or results of operations.

PROCEEDINGS BEFORE NATIONAL COMPANY LAW TRIBUNAL (NCLT)

1. [Matter Reference No. — pending; promoter affidavit awaited]
   Forum: NCLT, Mumbai Bench
   Parties: [Full details pending]
   Nature: [Nature of proceeding — pending]
   Current Status: Hearing scheduled; next date [Date — pending]
   Our legal counsel is of the opinion that the risk of an adverse outcome is low; however, no assurance can be given in this regard.`,
    aiFlags: [
      {
        id:              'flag-lp-001',
        description:     'NCLT matter reference number, full party names, and nature of proceeding are missing — required under SEBI ICDR Regulation 238(2)(j). Promoter affidavit not yet received.',
        severity:        'critical',
        engine:          'gap_detector',
        suggestedAction: 'Insert full NCLT case reference, case number, parties, and nature once promoter affidavit is received.',
      },
    ],
    comments:     [],
    evidenceDocs: [],
  },
  {
    id:             'outstanding-litigation',
    title:          'Outstanding Litigation',
    section:        'Section X – Legal & Other Information',
    status:         'issues',
    lockedByBanker: false,
    approvedBy:     null,
    approvedAt:     null,
    draftText:
`OUTSTANDING LITIGATION

I. LITIGATION AGAINST OUR COMPANY

Criminal Proceedings: NIL
Civil Proceedings: 1 matter

1. ABC Commercial Ventures Pvt. Ltd. vs. [Company Name]
   Forum: High Court of Bombay
   Case No.: Comm. Suit [●]/2023
   Nature: Commercial dispute regarding contract performance obligations
   Current Status: Hearing scheduled; matter listed before Hon'ble Justice [●]
   Amount in Dispute: Rs. [●] Lakhs (quantification pending — supporting court order uploaded)

II. LITIGATION BY OUR COMPANY

NIL

III. LITIGATION INVOLVING OUR PROMOTERS

Mr. [Promoter Name]:
[Details per promoter affidavit — awaited; see Legal Proceedings section]`,
    aiFlags: [
      {
        id:              'flag-ol-001',
        description:     'Amount in dispute for HC Bombay commercial matter is not quantified — SEBI requires specific financial exposure for all material litigation disclosures.',
        severity:        'critical',
        engine:          'gap_detector',
        suggestedAction: 'Insert exact amount in dispute or state "amount not ascertainable" with appropriate qualification once court records are verified.',
      },
    ],
    comments:     [],
    evidenceDocs: ['doc-001', 'doc-002'],
  },
  {
    id:             'material-contracts',
    title:          'Material Contracts',
    section:        'Section IX – Material Contracts',
    status:         'clear',
    lockedByBanker: false,
    approvedBy:     'Adv. Rohan Singhania',
    approvedAt:     '2026-08-04T16:45:00Z',
    draftText:
`MATERIAL CONTRACTS

The following contracts (not being contracts entered into in the ordinary course of business) are or may be deemed material to our Company:

1. Subscription Agreement dated [Date] between [Company Name] and [Lead Investor Name].
   Key Terms: Pre-IPO subscription of [●] Equity Shares at Rs. [●] per share. Lock-in period as per applicable SEBI regulations.

2. Agreement for Sale of Undertaking dated [Date] between [Company Name] and [Counterparty Name].
   Key Terms: Transfer of [specific undertaking] for a consideration of Rs. [●] Lakhs, subject to regulatory approvals.

The above contracts and other material documents referred to in this Prospectus may be inspected at our Registered Office during normal business hours on any working day between 10:00 a.m. and 5:00 p.m. from the date of this Prospectus until the date of Allotment of Equity Shares.`,
    aiFlags:      [],
    comments:     [
      {
        id:        'comment-mc-001',
        type:      'advisor_comment',
        author:    'Adv. Rohan Singhania',
        text:      'Subscription agreement date and investor name confirmed with client. Material contracts section is complete and accurately reflects the executed agreements.',
        createdAt: '2026-08-04T15:30:00Z',
        replies:   [],
      },
    ],
    evidenceDocs: ['doc-003'],
  },
  {
    id:             'govt-regulatory',
    title:          'Government & Regulatory Matters',
    section:        'Section X – Legal & Other Information',
    status:         'clear',
    lockedByBanker: false,
    approvedBy:     'Adv. Rohan Singhania',
    approvedAt:     '2026-08-03T11:20:00Z',
    draftText:
`GOVERNMENT AND REGULATORY MATTERS

Our Company has obtained all material licences, permissions, approvals, and registrations required to carry on our business as currently conducted. The key approvals obtained are set out below:

1. Certificate of Incorporation — Obtained (CIN: [●]).
2. GST Registration — Obtained (GSTIN: [●]).
3. Importer-Exporter Code (IEC) — Obtained.
4. Trade Licence — Obtained from [Municipal Authority], valid until [Date].
5. Factory Licence under the Factories Act, 1948 — Obtained, valid until [Date].
6. [Industry-specific approval] — Obtained from [Regulatory Body].

Our Company undertakes to obtain any additional approvals required in a timely manner. Copies of material approvals are available for inspection at our Registered Office.`,
    aiFlags:      [],
    comments:     [],
    evidenceDocs: ['doc-004', 'doc-005'],
  },
  {
    id:             'other-disclosures',
    title:          'Other Legal Disclosures',
    section:        'Section XI – Other Regulatory Disclosures',
    status:         'draft',
    lockedByBanker: false,
    approvedBy:     null,
    approvedAt:     null,
    draftText:
`OTHER REGULATORY AND LEGAL DISCLOSURES

A. RELATED PARTY TRANSACTIONS WITH LEGAL IMPLICATIONS

[Details of related-party transactions with potential legal implications to be populated from financial data extraction — see financial statements.]

B. PROMOTER DECLARATIONS

Our Promoters hereby declare that:
(i) They are not debarred from accessing capital markets by any regulatory authority including SEBI, stock exchanges, or any court of law.
(ii) There are no restraint orders, injunctions, or other court orders affecting their ability to deal in Equity Shares.
(iii) [Additional promoter declarations — pending affidavit collection from each promoter]

C. COMPLIANCE CERTIFICATES

[Compliance certificate from Practising Company Secretary — pending collection]
[Statutory Auditor certificate on financial disclosures — pending]`,
    aiFlags: [
      {
        id:              'flag-od-001',
        description:     'Promoter declaration item (iii) and related-party transaction details are incomplete placeholders — these must be populated before filing.',
        severity:        'warning',
        engine:          'gap_detector',
        suggestedAction: 'Collect promoter affidavits and populate the related-party transaction table from the financial data extraction module.',
      },
    ],
    comments:     [],
    evidenceDocs: [],
  },
];

// ---------------------------------------------------------------------------
// Legal Documents library
// Real: /api/legal/documents (UploadedDocument filtered to legal doc_types)
//       merged with evidence-mapping verification status (not yet implemented)
// ---------------------------------------------------------------------------

export const LEGAL_DOCUMENTS = [
  {
    id:                'doc-001',
    filename:          'HC_Bombay_Commercial_Dispute_CommSuit_2023.pdf',
    uploadedAt:        '2026-08-05T14:22:00Z',
    docType:           'litigation_record',
    supportedSectionId: 'outstanding-litigation',
    verificationStatus: 'matched',
    uploadedBy:        'Adv. Priya Mehta',
    fileSize:          '2.4 MB',
    notes:             'HC Bombay Comm. Suit 2023 — commercial dispute court order.',
  },
  {
    id:                'doc-002',
    filename:          'NCLT_Mumbai_Matter_Reference_Sheet.pdf',
    uploadedAt:        '2026-08-06T10:05:00Z',
    docType:           'litigation_record',
    supportedSectionId: 'legal-proceedings',
    verificationStatus: 'not_checked',
    uploadedBy:        'Adv. Priya Mehta',
    fileSize:          '0.8 MB',
    notes:             'NCLT matter reference sheet — awaiting case number confirmation.',
  },
  {
    id:                'doc-003',
    filename:          'Subscription_Agreement_PreIPO_2026.pdf',
    uploadedAt:        '2026-08-04T12:30:00Z',
    docType:           'material_contract',
    supportedSectionId: 'material-contracts',
    verificationStatus: 'matched',
    uploadedBy:        'Adv. Rohan Singhania',
    fileSize:          '1.2 MB',
    notes:             'Executed pre-IPO subscription agreement.',
  },
  {
    id:                'doc-004',
    filename:          'GST_Registration_Certificate.pdf',
    uploadedAt:        '2026-08-03T09:00:00Z',
    docType:           'regulatory_approval',
    supportedSectionId: 'govt-regulatory',
    verificationStatus: 'matched',
    uploadedBy:        'Adv. Rohan Singhania',
    fileSize:          '0.3 MB',
    notes:             'GST registration certificate from GSTN portal.',
  },
  {
    id:                'doc-005',
    filename:          'Factory_Licence_2025_Renewal.pdf',
    uploadedAt:        '2026-08-03T09:15:00Z',
    docType:           'regulatory_approval',
    supportedSectionId: 'govt-regulatory',
    verificationStatus: 'matched',
    uploadedBy:        'Adv. Rohan Singhania',
    fileSize:          '0.5 MB',
    notes:             'Renewed factory licence under Factories Act 1948.',
  },
  {
    id:                'doc-006',
    filename:          'MOA_AOA_Certified_Copy.pdf',
    uploadedAt:        '2026-08-01T11:00:00Z',
    docType:           'moa_aoa',
    supportedSectionId: null,
    verificationStatus: 'not_checked',
    uploadedBy:        'Adv. Priya Mehta',
    fileSize:          '3.1 MB',
    notes:             'Certified copy of MOA and AOA from company records.',
  },
];

// Human-readable labels for doc types
export const DOC_TYPE_LABELS = {
  litigation_record:  'Litigation Record',
  regulatory_approval:'Regulatory Approval',
  material_contract:  'Material Contract',
  moa_aoa:            'MOA / AOA',
  licence_copy:       'Licence Copy',
  legal_other:        'Legal — Other',
};

// ---------------------------------------------------------------------------
// Compliance matrix — legal-category items
// Real: Compliance Engine output filtered to legal requirements
//       Endpoint does not exist yet — swap in when engine is functional.
// ---------------------------------------------------------------------------

export const LEGAL_COMPLIANCE_ITEMS = [
  {
    id:            'comp-001',
    requirement:   'Litigation Disclosure — Civil Proceedings',
    regulation:    'SEBI ICDR 2018, Reg 238(2)(j)',
    status:        'needs_review',
    evidence:      'HC_Bombay_Commercial_Dispute_CommSuit_2023.pdf',
    drhpSectionId: 'outstanding-litigation',
    clauseRef:     'ICDR_2018_Reg_238_2_j',
    notes:         'HC Bombay matter disclosed but amount in dispute not quantified.',
  },
  {
    id:            'comp-002',
    requirement:   'Risk Factor — Customer Concentration',
    regulation:    'SEBI ICDR 2018, Reg 32(1)(a)',
    status:        'non_compliant',
    evidence:      null,
    drhpSectionId: 'risk-factors',
    clauseRef:     'ICDR_2018_Reg_32_1_a',
    notes:         'Customer concentration % not disclosed. Placeholder "[●]" remains.',
  },
  {
    id:            'comp-003',
    requirement:   'Promoter Litigation Disclosure',
    regulation:    'SEBI ICDR 2018, Reg 238(2)(k)',
    status:        'needs_review',
    evidence:      'NCLT_Mumbai_Matter_Reference_Sheet.pdf',
    drhpSectionId: 'legal-proceedings',
    clauseRef:     'ICDR_2018_Reg_238_2_k',
    notes:         'NCLT matter referenced but full details pending promoter affidavit.',
  },
  {
    id:            'comp-004',
    requirement:   'Material Contracts Listing',
    regulation:    'SEBI ICDR 2018, Reg 238(1)(ix)',
    status:        'compliant',
    evidence:      'Subscription_Agreement_PreIPO_2026.pdf',
    drhpSectionId: 'material-contracts',
    clauseRef:     'ICDR_2018_Reg_238_1_ix',
    notes:         'Subscription agreement and sale agreement listed. Contracts available for inspection.',
  },
  {
    id:            'comp-005',
    requirement:   'Regulatory Approval Disclosure',
    regulation:    'SEBI ICDR 2018, Reg 238(2)(c)',
    status:        'compliant',
    evidence:      'GST_Registration_Certificate.pdf',
    drhpSectionId: 'govt-regulatory',
    clauseRef:     'ICDR_2018_Reg_238_2_c',
    notes:         'All material regulatory approvals listed and copies available.',
  },
  {
    id:            'comp-006',
    requirement:   'Promoter Declaration — No Debarment',
    regulation:    'SEBI ICDR 2018, Reg 238(2)(l)',
    status:        'needs_review',
    evidence:      null,
    drhpSectionId: 'other-disclosures',
    clauseRef:     'ICDR_2018_Reg_238_2_l',
    notes:         'Declaration items (iii) incomplete; affidavits pending.',
  },
  {
    id:            'comp-007',
    requirement:   'Risk Factor — Litigation Impact on Business',
    regulation:    'SEBI ICDR 2018, Reg 32(1)(b)',
    status:        'needs_review',
    evidence:      null,
    drhpSectionId: 'risk-factors',
    clauseRef:     'ICDR_2018_Reg_32_1_b',
    notes:         'Litigation impact in risk factors not quantified — Consistency Checker flagged.',
  },
];

// ---------------------------------------------------------------------------
// Review Queue — aggregated pending items (sections + documents + compliance)
// Real: aggregated from /api/legal/flags + document statuses + compliance matrix
// ---------------------------------------------------------------------------

export const LEGAL_REVIEW_QUEUE = [
  {
    id:            'rq-001',
    itemType:      'compliance',
    itemId:        'comp-002',
    name:          'Risk Factor — Customer Concentration',
    flagDescription: '2 gaps flagged by Gap Detection — [●] placeholders remain.',
    lastTouchedBy: 'Gap Detection Engine',
    lastTouchedAt: '2026-08-07T09:00:00Z',
    status:        'issues',
    drhpSectionId: 'risk-factors',
    priority:      1,
  },
  {
    id:            'rq-002',
    itemType:      'section',
    itemId:        'outstanding-litigation',
    name:          'Outstanding Litigation',
    flagDescription: 'Amount in dispute for HC Bombay matter not quantified.',
    lastTouchedBy: 'Adv. Priya Mehta',
    lastTouchedAt: '2026-08-05T14:22:00Z',
    status:        'issues',
    drhpSectionId: 'outstanding-litigation',
    priority:      2,
  },
  {
    id:            'rq-003',
    itemType:      'section',
    itemId:        'legal-proceedings',
    name:          'Legal Proceedings',
    flagDescription: 'NCLT matter details missing — promoter affidavit awaited.',
    lastTouchedBy: 'Adv. Priya Mehta',
    lastTouchedAt: '2026-08-06T10:05:00Z',
    status:        'pending',
    drhpSectionId: 'legal-proceedings',
    priority:      3,
  },
  {
    id:            'rq-004',
    itemType:      'document',
    itemId:        'doc-002',
    name:          'NCLT Mumbai Matter Reference Sheet',
    flagDescription: 'Document uploaded but verification status is "not checked".',
    lastTouchedBy: 'Adv. Priya Mehta',
    lastTouchedAt: '2026-08-06T10:05:00Z',
    status:        'pending',
    drhpSectionId: 'legal-proceedings',
    priority:      4,
  },
  {
    id:            'rq-005',
    itemType:      'section',
    itemId:        'other-disclosures',
    name:          'Other Legal Disclosures',
    flagDescription: 'Promoter declaration item (iii) incomplete placeholder.',
    lastTouchedBy: 'Gap Detection Engine',
    lastTouchedAt: '2026-08-08T08:00:00Z',
    status:        'pending',
    drhpSectionId: 'other-disclosures',
    priority:      5,
  },
  {
    id:            'rq-006',
    itemType:      'document',
    itemId:        'doc-006',
    name:          'MOA / AOA Certified Copy',
    flagDescription: 'Verification against draft claims not yet performed.',
    lastTouchedBy: 'Adv. Priya Mehta',
    lastTouchedAt: '2026-08-01T11:00:00Z',
    status:        'pending',
    drhpSectionId: null,
    priority:      6,
  },
];

// ---------------------------------------------------------------------------
// Comments — threaded discussion
// Real: /api/legal/sections/{id}/review for legal_reviewer role messages
//       AI flags sourced from /api/legal/flags
// ---------------------------------------------------------------------------

export const LEGAL_COMMENTS = [
  {
    id:           'comment-001',
    sectionId:    'risk-factors',
    sectionTitle: 'Risk Factors',
    type:         'advisor_comment',
    author:       'Adv. Priya Mehta',
    text:         'Risk factor 1.1 must disclose the actual customer concentration percentage. The current disclosure is a generic placeholder that does not meet SEBI ICDR Reg 32(1)(a) requirements. Please insert the verified figure from the financial data.',
    createdAt:    '2026-08-07T11:00:00Z',
    replies: [
      {
        id:        'reply-001',
        author:    'Founder',
        text:      'Understood. We will provide the exact customer concentration data — top 3 customers account for approximately 61% of revenue in FY26. Finance team will confirm.',
        createdAt: '2026-08-07T14:30:00Z',
        status:    'answered',
      },
    ],
  },
  {
    id:           'comment-002',
    sectionId:    'outstanding-litigation',
    sectionTitle: 'Outstanding Litigation',
    type:         'ai_flag',
    author:       'Gap Detection Engine',
    text:         'Amount in dispute for HC Bombay Comm. Suit not quantified. SEBI ICDR Regulation 238(2)(j) requires disclosure of the specific financial exposure for all material litigation matters.',
    createdAt:    '2026-08-06T09:15:00Z',
    replies:      [],
  },
  {
    id:           'comment-003',
    sectionId:    'legal-proceedings',
    sectionTitle: 'Legal Proceedings',
    type:         'clarification_request',
    author:       'Adv. Priya Mehta',
    text:         'Please provide the NCLT Mumbai case number, the name of the opposing party, and the nature of the proceeding (e.g., winding-up, oppression & mismanagement). This is needed to complete the Legal Proceedings disclosure.',
    createdAt:    '2026-08-06T12:00:00Z',
    replies: [
      {
        id:        'reply-002',
        author:    'Founder',
        text:      '',
        createdAt: '',
        status:    'awaiting',
      },
    ],
  },
  {
    id:           'comment-004',
    sectionId:    'material-contracts',
    sectionTitle: 'Material Contracts',
    type:         'advisor_comment',
    author:       'Adv. Rohan Singhania',
    text:         'Subscription agreement date and investor name confirmed. Material contracts section is complete and accurately reflects the executed agreements. Approving this section.',
    createdAt:    '2026-08-04T15:30:00Z',
    replies:      [],
  },
  {
    id:           'comment-005',
    sectionId:    'risk-factors',
    sectionTitle: 'Risk Factors',
    type:         'ai_flag',
    author:       'Consistency Checker',
    text:         'Risk factor 2.1 cross-references Outstanding Litigation but does not quantify the financial exposure — inconsistency between the risk factor disclosure and the Outstanding Litigation section amounts.',
    createdAt:    '2026-08-07T09:30:00Z',
    replies:      [],
  },
];

// ---------------------------------------------------------------------------
// Activity log — chronological audit trail (legal scope only)
// Real: AuditLog table filtered to legal event_types
// ---------------------------------------------------------------------------

export const LEGAL_ACTIVITY_LOG = [
  {
    id:         'act-001',
    actor:      'Adv. Priya Mehta',
    actorRole:  'legal_advisor',
    actionType: 'comment_added',
    target:     'Risk Factors',
    targetId:   'risk-factors',
    timestamp:  '2026-08-07T11:00:00Z',
    detail:     'Added comment requesting quantification of customer concentration risk.',
  },
  {
    id:         'act-002',
    actor:      'Consistency Checker Engine',
    actorRole:  'engine',
    actionType: 'ai_flag_raised',
    target:     'Risk Factors',
    targetId:   'risk-factors',
    timestamp:  '2026-08-07T09:30:00Z',
    detail:     'Flagged inconsistency between litigation risk factor and Outstanding Litigation section.',
  },
  {
    id:         'act-003',
    actor:      'Adv. Priya Mehta',
    actorRole:  'legal_advisor',
    actionType: 'clarification_sent',
    target:     'Legal Proceedings',
    targetId:   'legal-proceedings',
    timestamp:  '2026-08-06T12:00:00Z',
    detail:     'Sent clarification request to Founder for NCLT matter details.',
  },
  {
    id:         'act-004',
    actor:      'Gap Detection Engine',
    actorRole:  'engine',
    actionType: 'ai_flag_raised',
    target:     'Outstanding Litigation',
    targetId:   'outstanding-litigation',
    timestamp:  '2026-08-06T09:15:00Z',
    detail:     'Flagged missing quantification of HC Bombay dispute — ICDR Reg 238(2)(j).',
  },
  {
    id:         'act-005',
    actor:      'Adv. Priya Mehta',
    actorRole:  'legal_advisor',
    actionType: 'document_uploaded',
    target:     'Outstanding Litigation',
    targetId:   'outstanding-litigation',
    timestamp:  '2026-08-05T14:22:00Z',
    detail:     'Uploaded HC Bombay Commercial Dispute court order (CommSuit 2023).',
  },
  {
    id:         'act-006',
    actor:      'Adv. Priya Mehta',
    actorRole:  'legal_advisor',
    actionType: 'document_uploaded',
    target:     'Legal Proceedings',
    targetId:   'legal-proceedings',
    timestamp:  '2026-08-06T10:05:00Z',
    detail:     'Uploaded NCLT Mumbai matter reference sheet (pending verification).',
  },
  {
    id:         'act-007',
    actor:      'Adv. Rohan Singhania',
    actorRole:  'legal_advisor',
    actionType: 'comment_added',
    target:     'Material Contracts',
    targetId:   'material-contracts',
    timestamp:  '2026-08-04T15:30:00Z',
    detail:     'Confirmed subscription agreement details are accurate.',
  },
  {
    id:         'act-008',
    actor:      'Adv. Rohan Singhania',
    actorRole:  'legal_advisor',
    actionType: 'section_approved',
    target:     'Material Contracts',
    targetId:   'material-contracts',
    timestamp:  '2026-08-04T16:45:00Z',
    detail:     'Approved Material Contracts section after reviewing all supporting documents.',
  },
  {
    id:         'act-009',
    actor:      'Adv. Rohan Singhania',
    actorRole:  'legal_advisor',
    actionType: 'section_approved',
    target:     'Government & Regulatory Matters',
    targetId:   'govt-regulatory',
    timestamp:  '2026-08-03T11:20:00Z',
    detail:     'Approved Government & Regulatory Matters after verifying all approval copies.',
  },
  {
    id:         'act-010',
    actor:      'Adv. Rohan Singhania',
    actorRole:  'legal_advisor',
    actionType: 'document_uploaded',
    target:     'Government & Regulatory Matters',
    targetId:   'govt-regulatory',
    timestamp:  '2026-08-03T09:00:00Z',
    detail:     'Uploaded GST registration certificate and factory licence renewal.',
  },
];
