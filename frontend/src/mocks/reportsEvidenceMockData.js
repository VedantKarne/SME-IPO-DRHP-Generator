/**
 * reportsEvidenceMockData.js
 *
 * MOCK DATA
 * Replace with a real per-section source-citation API if one is ever built.
 *
 * No such integration exists today: section.supporting_clause_ids are
 * regulatory clause citations (SEBI ICDR reg numbers), not source-document
 * page citations, and missing_docs/unsynced_docs are just document-name
 * flags with no page-level detail anywhere in the schema.
 */

export const mockEvidenceReport = [
  { section: 'Risk Factors', sources: ['Annual Report FY23, p.12', 'Industry Report 2024, p.8'], confidenceScore: 0.94 },
  { section: 'Capital Structure', sources: ['ROC Filing 2023'], confidenceScore: 0.88 },
  { section: 'Our Business', sources: ['Annual Report FY23, p.4', 'Board Resolution for IPO'], confidenceScore: 0.91 },
  { section: 'Financial Statements (3 Years)', sources: ['Audited Financial Statements FY2022-24'], confidenceScore: 0.97 },
];
