/**
 * knowledgeBaseMockData.js
 *
 * MOCK DATA
 * Replace with backend API integration when the corpus is actually indexed.
 *
 * The live ChromaDB corpus (src/api/admin_router.py: GET /api/admin/collections,
 * POST /api/admin/search) is empty in this environment — 0 chunks across all
 * 3 collections, since regulatory text and precedent filings have never been
 * ingested here. KnowledgeBase.jsx falls back to this data ONLY when the real
 * collections are empty, so the page still demonstrates what browsing/searching
 * a populated corpus looks like.
 *
 * Shape mirrors the real API exactly:
 *   collections: CollectionInfo[]        — { name, count }
 *   chunksByCollection: Record<name, ChunkResult[]>  — { id, score, text, metadata }
 * so swapping this out once the corpus is indexed requires no component changes.
 *
 * Regulatory clause IDs reused here (ICDR_2018_Reg229_2_a, _1_b, _3,
 * Mar2025_Amend_KMP, _1_c) are the same 5 already cited for real by
 * src/eligibility/checker.py — not invented. Everything else (illustrative
 * clause text, precedent snippets, client document previews) is
 * representative placeholder content, not verified regulatory text.
 */

export const MOCK_COLLECTIONS = [
  { name: 'regulatory_clauses', count: 1847 },
  { name: 'precedent_chunks', count: 623 },
  { name: 'client_documents', count: 11 },
];

export const MOCK_CHUNKS = {
  regulatory_clauses: [
    {
      id: 'ICDR_2018_Reg229_2_a',
      score: 0.9124,
      text: 'An issuer whose net tangible assets are not in accordance with Regulation 228 may nonetheless make an initial public offer of specified securities on the SME Exchange, provided the aggregate consolidated EBITDA of ₹1 crore or more has been generated in any two out of the three preceding financial years.',
      metadata: { regulation: 'ICDR 2018 Reg 229(2)(a)', category: 'Eligibility', chapter: 'Chapter IX — SME Issues' },
    },
    {
      id: 'ICDR_2018_Reg229_1_b',
      score: 0.8867,
      text: 'The issuer shall have a net worth which is positive, computed in accordance with the audited financial statements for the immediately preceding financial year, as a condition precedent to making an offer under this Chapter.',
      metadata: { regulation: 'ICDR 2018 Reg 229(1)(b)', category: 'Eligibility', chapter: 'Chapter IX — SME Issues' },
    },
    {
      id: 'ICDR_2018_Reg229_3',
      score: 0.8542,
      text: 'The post-issue paid-up capital of the issuer shall not exceed twenty five crore rupees, calculated after giving effect to the fresh issue and any conversion of convertible instruments outstanding as on the date of the prospectus.',
      metadata: { regulation: 'ICDR 2018 Reg 229(3)', category: 'Capital Structure', chapter: 'Chapter IX — SME Issues' },
    },
    {
      id: 'ICDR_2018_Mar2025_Amend_KMP',
      score: 0.8320,
      text: 'No person who is a promoter, director, or key managerial personnel of the issuer shall have any pending material litigation or regulatory proceeding that has not been disclosed in the offer document, per the March 2025 amendment to the ICDR framework.',
      metadata: { regulation: 'ICDR 2018 (Mar 2025 Amendment)', category: 'Directors & KMP', chapter: 'Chapter IX — SME Issues' },
    },
    {
      id: 'ICDR_2018_Reg229_1_c',
      score: 0.8011,
      text: 'The issuer shall not have any winding-up petition admitted by a National Company Law Tribunal, nor shall a reference in respect of the issuer be pending before the erstwhile Board for Industrial and Financial Reconstruction.',
      metadata: { regulation: 'ICDR 2018 Reg 229(1)(c)', category: 'Eligibility', chapter: 'Chapter IX — SME Issues' },
    },
    {
      id: 'ICDR_2018_Sch_RiskFactors',
      score: 0.7644,
      text: 'Risk factors shall be specific to the issuer and shall not be vague or generic. Each risk factor should quantify the impact on the issuer wherever quantification is reasonably possible, and shall be prioritised in order of materiality.',
      metadata: { regulation: 'ICDR 2018 Schedule VI', category: 'Risk Factors', chapter: 'Disclosure Requirements' },
    },
    {
      id: 'ICDR_2018_RPT_Disclosure',
      score: 0.7218,
      text: 'All related party transactions entered into during the three fiscal years preceding the offer document shall be disclosed, including the name of the related party, nature of relationship, and the amount and terms of the transaction.',
      metadata: { regulation: 'ICDR 2018 Schedule VI', category: 'Related Party Transactions', chapter: 'Disclosure Requirements' },
    },
  ],
  precedent_chunks: [
    {
      id: 'precedent_manufacturing_riskfactors_014',
      score: 0.8791,
      text: '"Our business is subject to risks associated with the availability and cost of raw materials. Any significant increase in the price of steel, our primary raw material, without a corresponding increase in the prices of our products, could adversely affect our margins and results of operations."',
      metadata: { source: 'Precedent DRHP — Manufacturing SME (2024)', section: 'Risk Factors' },
    },
    {
      id: 'precedent_saas_business_027',
      score: 0.8455,
      text: '"We operate on a subscription-based revenue model, and our net revenue retention rate of 118% for the period reflects strong expansion within our existing customer base, driven primarily by upsells of our premium analytics module."',
      metadata: { source: 'Precedent DRHP — Technology SME (2023)', section: 'Our Business' },
    },
    {
      id: 'precedent_capstructure_009',
      score: 0.8102,
      text: '"Pursuant to a special resolution passed by our shareholders, our Company sub-divided the face value of each equity share from ₹10 to ₹2, resulting in a proportionate increase in the number of equity shares outstanding, without any change in the paid-up capital."',
      metadata: { source: 'Precedent DRHP — Textiles SME (2022)', section: 'Capital Structure' },
    },
    {
      id: 'precedent_mgmt_governance_041',
      score: 0.7889,
      text: '"Our Board comprises six directors, including two independent directors, in compliance with the minimum board composition requirements applicable to companies listed on the SME platform under the SEBI Listing Obligations and Disclosure Requirements Regulations."',
      metadata: { source: 'Precedent DRHP — Pharma SME (2024)', section: 'Management & Board of Directors' },
    },
  ],
  client_documents: [
    { id: 'client_doc_financials', score: 0.9302, text: 'Audited Financial Statements (FY2022–24) — revenue, EBITDA, PAT and net worth for the three most recent fiscal years, audited by the statutory auditor.', metadata: { doc_type: 'Financial Statement', status: 'Extracted' } },
    { id: 'client_doc_board_resolution', score: 0.9010, text: 'Board Resolution for IPO — resolution passed by the Board of Directors authorising the initial public offering and appointment of intermediaries.', metadata: { doc_type: 'Corporate Resolution', status: 'Extracted' } },
    { id: 'client_doc_factory_licence', score: 0.8734, text: 'Factory Licence / Registration — statutory licence issued under the Factories Act permitting operation of the manufacturing facility.', metadata: { doc_type: 'Regulatory Licence', status: 'Extracted' } },
    { id: 'client_doc_gst', score: 0.8501, text: 'GST Registration Certificate — confirms the company’s registration under the Goods and Services Tax Act with its GSTIN.', metadata: { doc_type: 'Tax Registration', status: 'Extracted' } },
    { id: 'client_doc_moa_aoa', score: 0.8288, text: 'Memorandum & Articles of Association — the company’s constitutional documents defining its objects and internal governance rules.', metadata: { doc_type: 'Constitutional Document', status: 'Extracted' } },
  ],
};
