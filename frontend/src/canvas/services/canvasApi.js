/**
 * canvasApi.js — All API service functions for the AI Authoring Canvas.
 *
 * Every function wraps its fetch call in try/catch. On any non-2xx response
 * or network error, it returns the defined mock response so the demo flow
 * works end-to-end regardless of backend availability.
 *
 * Requirements: 3.3, 4.3, 5.3, 9.2, 10.2, 11.4, 13.6, 14.1
 */

export const API_BASE = 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Internal mock data
// ---------------------------------------------------------------------------

/**
 * Section-aware copilot answer bank.
 * Keys are lowercase fragments of section names.
 * Each entry is an array — a random one is chosen per call to add variety.
 */
const COPILOT_ANSWER_BANK = {
  'risk factor': [
    "For the Risk Factors section, SEBI ICDR Reg 237 requires you to disclose all material risks in order of importance. Key items to verify: (1) customer concentration risk with actual revenue percentages, (2) key-person dependency for promoters, and (3) technology obsolescence risks backed by R&D spend data. I recommend quantifying each risk with FY24 figures wherever possible.",
    "This section should lead with the most impactful risks. Under SEBI guidance, an SME DRHP must disclose at least 3–5 internal and 3–5 external risks. Right now the draft is missing a clear regulatory-change risk specific to SEBI ICDR amendments. I can draft that paragraph for you — just ask.",
    "Strong risk disclosures improve investor confidence. For the customer concentration risk already listed, add the exact revenue contribution from the top 3 clients (FY24: 42%). Also consider adding a cybersecurity/data-privacy risk given the company is a SaaS platform.",
  ],
  'capital structure': [
    "Capital structure disclosures are governed by SEBI ICDR Reg 233. The current draft shows pre-IPO promoter holding at 67.5% and post-IPO at 50.6%, which satisfies the minimum promoter contribution requirement. However, you should also include the complete pre-IPO and post-IPO shareholding table broken down by category (promoters, public, employees).",
    "One common gap SEBI flags in SME DRHPs is the absence of a lock-in disclosure. Under Reg 236, promoter shares acquired within 18 months of filing must be locked in for 3 years. Please confirm the acquisition dates for all promoter shares.",
    "The authorised-to-paid-up capital ratio looks healthy. For the IPO fresh issue of 40 lakh shares at ₹10 face value, you'll also need to disclose the issue price basis in the 'Basis of Issue Price' section, supported by a P/E multiple comparison with listed peers.",
  ],
  'financial': [
    "For financial statements, SEBI requires 3 years of audited financials. Your FY22–FY24 data looks structured. One area to strengthen: provide a reconciliation note if EBITDA margins changed significantly year-over-year. FY22→FY24 margin expansion from 18.3% to 22.0% should be explained in the MD&A.",
    "Cross-check the revenue figures in this section against the Annual Report (Page 17 — Revenue Breakdown). The 30.3% revenue CAGR is strong and should be highlighted with peer-company benchmarks. I'd also recommend adding a working capital analysis table.",
    "Ensure the financial statements are signed off by a CA with ICAI registration number. SEBI has been specifically checking for this in recent SME filings. The restated financial summary must follow the ICDR Schedule format.",
  ],
  'management': [
    "Board composition looks strong with 2 independent directors, which satisfies the SEBI Listing Obligations requirement for SME companies. One suggestion: add the DIN (Director Identification Number) for each director — this is mandatory under Companies Act Section 164 and ICDR Reg 238.",
    "For the KMP section, disclose total remuneration paid to each KMP in FY24. SEBI has been flagging DRHPs where this is missing. Also confirm that no KMP has any pending litigation or regulatory action.",
    "The independent directors' declaration of independence should be referenced here. Ensure Ms. Kavita Iyer and Mr. Rajiv Bose have met the 6-month cooling-off period if they were previously employees or related parties.",
  ],
  'promoter': [
    "Promoter background disclosure under SEBI ICDR Reg 236 requires the last 5 years of professional history. The current draft covers qualifications but not role history. For Mr. Arjun Mehta, add prior employment at [previous company] from [year] to [year] before founding Nirmaan Technologies.",
    "Ensure the promoter group includes all entities where promoters hold >20% directly or indirectly. This is frequently questioned by SEBI during the examination of SME DRHPs. Also confirm whether any promoter has pledged shares — this must be disclosed.",
    "The promoter's PAN, address, and passport number (for NRI promoters) must be disclosed per ICDR Schedule. Cross-verify that the shareholding percentages in this section match exactly with the capital structure table.",
  ],
  'object': [
    "The objects of the offer must clearly state the end-use of IPO proceeds. For each object, provide: (1) the total estimated cost, (2) the amount to be funded from IPO proceeds, (3) the amount from internal accruals, and (4) the expected deployment timeline. SEBI typically expects this broken down quarter-by-quarter.",
    "Add a project appraisal note if any object relates to capital expenditure over ₹5 Cr. SEBI may ask for an independent appraiser's certificate. For software/technology companies, R&D spend as an object needs robust justification with product roadmap details.",
    "General corporate purposes (GCP) as an object should not exceed 25% of the total issue size per SEBI ICDR Reg 232. Currently the draft has it at 30% — this needs to be revised before filing.",
  ],
  'industry': [
    "The industry overview should be sourced from at least 2–3 third-party research reports (e.g., NASSCOM, Gartner, CRISIL). SEBI requires the source and date to be cited for every market size figure. Avoid using data older than 2 years.",
    "For a legal-tech/AI SaaS company, the relevant market is the Indian RegTech market. Consider citing the Indian RegTech market size (estimated USD 1.3 Bn by 2027, CAGR ~18%) with an authoritative source. This strengthens the investment thesis.",
    "Competitive landscape analysis is expected in this section. Add a comparison table of key competitors, their focus areas, and Nirmaan Technologies' differentiation. Ensure no competitor is named without a factual basis, as SEBI scrutinises comparative claims.",
  ],
  'related party': [
    "Related party transaction disclosures must comply with both SEBI ICDR Reg 238 and Companies Act Section 188. All RPTs exceeding 10% of annual turnover require special resolution in the last 3 years. Please confirm the outstanding loans from promoters — the current disclosure notes ₹4.2 Cr which needs the interest rate, security, and repayment terms.",
    "Ensure the RPT table categorises each transaction by type: loans, guarantees, purchases, sales, services. The aggregate value for FY22, FY23, and FY24 must be shown separately. Transactions with KMP (salary, sitting fees) should be in a separate sub-table.",
    "SEBI has issued advisories on RPT disclosures for SME IPOs specifically around promoter loans being converted to equity just before filing. If any such conversion occurred in the last 18 months, it must be explicitly disclosed here.",
  ],
  'default': [
    "This section looks well-structured. Based on SEBI ICDR Reg 237–238, the key items to verify are: completeness of disclosures, cross-referencing with financial statements, and consistency with other sections. Would you like me to run a compliance check on specific paragraphs?",
    "I've reviewed this section against the SEBI ICDR Regulations 2018 (as amended in 2026). The content appears substantively complete. Consider reviewing language for investor-friendliness — clear, jargon-free disclosure tends to perform better during SEBI examination.",
    "Good progress on this section. One best practice: add cross-references to related sections (e.g., 'See also: Financial Statements, Page XX') to improve document coherence. SEBI reviewers appreciate internally consistent DRHPs.",
    "For this section, precedent analysis from similar SME IPOs (e.g., CSM Technologies, Advit Jewels) suggests adding a dedicated sub-heading for forward-looking statements with the standard cautionary note required under SEBI guidelines.",
  ],
};

/**
 * Section-aware rewrite mock responses. Keys match SECTIONS_25 name fragments.
 */
const REWRITE_BANK = {
  rewrite: [
    "The Company is engaged in the development of AI-powered regulatory document intelligence platforms, with a primary focus on the automation of SEBI-compliant DRHP preparation for SME IPO issuances. The Company's technology processes structured and unstructured financial data to generate regulatory-grade prospectus drafts with built-in compliance validation.",
    "Nirmaan Technologies Limited operates a B2B SaaS platform that enables merchant bankers, CA firms, and legal advisors to generate, review, and submit SEBI-compliant IPO documentation in significantly reduced timelines, contributing to greater efficiency in India's capital markets ecosystem.",
  ],
  expand: [
    "The Company was incorporated in 2018 with the vision of modernising India's capital markets documentation process. Since its founding, the Company has successfully processed over 47 DRHP filings across diverse sectors including manufacturing, technology, healthcare, and financial services. The Company's proprietary AI engine is trained on over 500 precedent SEBI filings, enabling it to generate contextually accurate disclosures aligned with current ICDR regulations. The Company's clients include 12 of the top 20 SEBI-registered merchant bankers by deal volume in FY24.",
    "The risk identified above has material implications for the Company's revenue visibility. In FY24, the top 3 customers contributed approximately 42% of total consolidated revenue (₹20.2 Cr out of ₹48.2 Cr). The loss of any one of these customers, without timely replacement, could result in a revenue decline of 10–20% in the subsequent financial year. The Company is actively diversifying its client base and has added 8 new enterprise clients in Q1 FY25, which is expected to reduce concentration risk progressively.",
  ],
  simplify: [
    "The Company builds AI software that helps prepare IPO documents. Its main product automates the creation of DRHP filings, making the process faster and more accurate for financial advisors.",
    "The top 3 customers make up 42% of our revenue. If we lose them, our income could drop. We are working to bring in more customers to reduce this risk.",
  ],
  investor_friendly: [
    "Nirmaan Technologies is at the forefront of India's RegTech revolution — combining deep regulatory expertise with cutting-edge AI to transform how capital market documents are created. With a 30% revenue CAGR and 18% ROE in FY24, the Company is on a strong growth trajectory, positioned to capture a significant share of India's USD 1.3 Bn RegTech market.",
    "India's SME IPO market is booming — over 200 SMEs listed in FY24 alone. Nirmaan Technologies is the picks-and-shovels play on this boom: every new SME IPO represents a direct revenue opportunity, and with AI-powered automation, margins scale as volume grows.",
  ],
  professional: [
    "The Company is incorporated under the Companies Act, 2013, bearing CIN U72900MH2018PLC312456, and is engaged in the provision of technology-enabled regulatory compliance solutions for the capital markets sector. The Company's registered office is situated at [address], Pune, Maharashtra.",
    "For the financial year ended March 31, 2024, the Company recorded total income of ₹48.24 crores (previous year: ₹37.92 crores), representing a year-on-year growth of 27.2%. Earnings Before Interest, Tax, Depreciation and Amortisation (EBITDA) for FY24 stood at ₹10.61 crores, reflecting an EBITDA margin of 22.0%.",
  ],
  cite: [
    "The Company's offer document has been prepared in accordance with the Securities and Exchange Board of India (Issue of Capital and Disclosure Requirements) Regulations, 2018, as amended from time to time, including Schedule VIII thereof [SEBI ICDR Reg 237 | SEBI ICDR Regulations 2018]. All disclosures have been made in compliance with Regulation 238 of the ICDR Regulations [Reg 238 | SEBI ICDR Regulations 2018].",
    "The promoter's minimum contribution and lock-in requirements have been computed in accordance with Chapter IV of the SEBI ICDR Regulations [Reg 236 | SEBI ICDR Regulations 2018]. The post-issue promoter holding of 50.6% satisfies the minimum promoter contribution threshold as specified under Regulation 229 [Reg 229 | SEBI ICDR Regulations 2018].",
  ],
};

/**
 * Realistic mock suggestions per section name fragment.
 */
const SUGGESTIONS_BANK = {
  'risk factor': [
    { severity: 'warning', title: 'Customer concentration risk not quantified', description: 'Disclose exact revenue % from top 3 customers (currently ~42% per FY24 data). SEBI ICDR Reg 237 requires quantification of material risks.' },
    { severity: 'warning', title: 'Cybersecurity / data-privacy risk missing', description: 'As a SaaS platform processing sensitive financial data, add a cybersecurity risk factor with reference to IT Act 2000 and data localisation regulations.' },
    { severity: 'info', title: 'Add regulatory-change risk for SEBI amendments', description: 'Include a forward-looking risk around potential SEBI ICDR regulatory changes that could affect product compliance requirements.' },
    { severity: 'success', title: 'Key-person risk disclosed', description: 'Dependence on founder and KMP is adequately disclosed with mitigation measures.' },
  ],
  'capital structure': [
    { severity: 'success', title: 'Promoter contribution meets Reg 236 minimum', description: 'Post-IPO promoter holding of 50.6% satisfies SEBI ICDR minimum promoter contribution requirement.' },
    { severity: 'warning', title: 'Lock-in disclosure incomplete', description: 'Add lock-in period details for promoter shares acquired within 18 months of filing. Required under SEBI ICDR Reg 236.' },
    { severity: 'info', title: 'Add employee stock option (ESOP) table', description: 'If ESOP scheme exists, disclose the outstanding options and potential dilution impact on post-issue EPS.' },
  ],
  'financial': [
    { severity: 'success', title: 'Three years of audited financials included', description: 'FY22, FY23, and FY24 audited data present. Satisfies SEBI ICDR Schedule VIII requirement.' },
    { severity: 'warning', title: 'EBITDA margin expansion not explained', description: 'EBITDA margin improved from 18.3% (FY22) to 22.0% (FY24). Add explanation in MD&A per SEBI guidance note.' },
    { severity: 'info', title: 'Add working capital analysis table', description: 'SEBI ICDR Reg 238 expects a working capital summary. Include debtors, creditors, and inventory days for FY22–FY24.' },
    { severity: 'success', title: 'Revenue CAGR prominently disclosed', description: '30.3% CAGR correctly computed and disclosed.' },
  ],
  'management': [
    { severity: 'warning', title: 'DIN numbers missing for all directors', description: 'Director Identification Numbers are mandatory under Companies Act Section 164 and SEBI ICDR Reg 238. Add for all 4 board members.' },
    { severity: 'warning', title: 'KMP remuneration not disclosed', description: 'Total FY24 remuneration for each KMP must be disclosed. SEBI frequently raises this observation in examination letters.' },
    { severity: 'success', title: 'Board composition meets independence requirement', description: '2 of 4 directors are independent — satisfies SEBI Listing Obligations for SME companies.' },
  ],
  'promoter': [
    { severity: 'warning', title: 'Promoter 5-year professional history incomplete', description: 'SEBI ICDR Reg 236 requires last 5 years of employment/business history. Current draft only lists qualifications.' },
    { severity: 'warning', title: 'Promoter group entities not fully identified', description: 'List all entities where promoters hold >20% stake directly or indirectly. Check for HUFs and trusts.' },
    { severity: 'info', title: 'Add pledge disclosure', description: 'Confirm whether any promoter has pledged shares and disclose accordingly. Even a nil-pledge statement is required.' },
  ],
  'related party': [
    { severity: 'warning', title: 'Promoter loan terms incomplete', description: 'Outstanding promoter loan of ₹4.2 Cr requires disclosure of interest rate, security, and repayment schedule per ICDR Reg 238.' },
    { severity: 'info', title: 'Separate KMP compensation sub-table required', description: 'Salary and sitting fees paid to KMP should appear in a dedicated sub-table, separate from other RPT categories.' },
    { severity: 'success', title: 'RPT aggregate values disclosed for 3 years', description: 'FY22–FY24 RPT summary tables are present and categorised correctly.' },
  ],
  'default': [
    { severity: 'info', title: 'Cross-references to related sections recommended', description: 'Add internal cross-references (e.g., "See Financial Statements, Page XX") to improve document coherence during SEBI review.' },
    { severity: 'info', title: 'Investor-friendly language review suggested', description: 'Run an investor-friendly tone check on this section. Clear, jargon-free disclosures perform better during SEBI examination.' },
    { severity: 'success', title: 'Section structure follows ICDR Schedule VIII', description: 'Section heading and sub-sections align with the prescribed DRHP format.' },
  ],
};

/**
 * All 25 SEBI DRHP section names in canonical order.
 * Stubs use the shape: { id, name, status, draft_text, score, locked, flagged_gaps }
 */
const SECTIONS_25 = [
  'Cover Page & General Information',
  'Risk Factors',
  'Introduction',
  'General Information',
  'Capital Structure',
  'Objects of the Offer',
  'Basis of Issue Price',
  'Statement of Tax Benefits',
  'About the Company',
  'Industry Overview',
  'Our Business',
  'Key Industry Regulations',
  'History and Corporate Structure',
  'Management & Board of Directors',
  'Key Managerial Personnel (KMP)',
  'Our Promoters & Promoter Group',
  'Related Party Transactions',
  'Dividend Policy',
  'Financial Statements (3 Years)',
  'Management Discussion & Analysis',
  'Corporate Governance',
  'Terms of the Issue',
  'Other Regulatory & Statutory Disclosures',
  'Material Contracts & Documents',
  'Declaration & Undertakings',
];

/**
 * Regulatory evidence citations keyed by regulation reference.
 * Confidence values are numeric (0–100) per the design spec.
 */
const EVIDENCE_MAP = {
  'Reg 229': {
    reg: '229',
    chapter: 'IV — SME Listing Requirements',
    doc: 'SEBI ICDR Regulations 2018',
    page: 'Part II, Reg 229',
    confidence: 99,
  },
  'Reg 237': {
    reg: '237',
    chapter: 'IV — Disclosures in Offer Documents',
    doc: 'SEBI ICDR Regulations 2018',
    page: 'Part II, Reg 237',
    confidence: 97,
  },
  'Reg 238': {
    reg: '238',
    chapter: 'IV — Content of Offer Documents',
    doc: 'SEBI ICDR Regulations 2018',
    page: 'Part II, Reg 238',
    confidence: 98,
  },
  'Reg 233': {
    reg: '233',
    chapter: 'IV — Capital Structure Disclosures',
    doc: 'SEBI ICDR Regulations 2018',
    page: 'Part II, Reg 233',
    confidence: 96,
  },
};

// ---------------------------------------------------------------------------
// Helper: assert a Response is ok, throw otherwise
// ---------------------------------------------------------------------------

async function assertOk(res) {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res;
}

// ---------------------------------------------------------------------------
// getSections
// ---------------------------------------------------------------------------

/**
 * Fetch the list of DRHP sections for a company.
 *
 * @param {string} companyId
 * @returns {Promise<Array>} Merged section objects or SECTIONS_25 stubs on failure.
 */
export async function getSections(companyId) {
  try {
    const res = await fetch(`${API_BASE}/api/sections/${encodeURIComponent(companyId)}`);
    await assertOk(res);
    return await res.json();
  } catch {
    // Mock: return all 25 section stubs
    return SECTIONS_25.map((name) => ({
      id: null,
      name,
      status: 'pending',
      draft_text: '',
      score: 0,
      locked: false,
      flagged_gaps: [],
    }));
  }
}

// ---------------------------------------------------------------------------
// rewrite
// ---------------------------------------------------------------------------

/**
 * Ask the AI to rewrite a selected passage with a given action.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} selectedText
 * @param {string} action  One of: rewrite | expand | simplify | investor_friendly
 * @returns {Promise<{ proposed_text: string }>}
 */
export async function rewrite(companyId, sectionName, selectedText, action) {
  try {
    const res = await fetch(`${API_BASE}/api/canvas/rewrite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        section_name: sectionName,
        selected_text: selectedText,
        action,
      }),
    });
    await assertOk(res);
    return await res.json();
  } catch {
    const pool = REWRITE_BANK[action] ?? REWRITE_BANK['rewrite'];
    const proposed_text = pool[Math.floor(Math.random() * pool.length)];
    return { proposed_text };
  }
}

// ---------------------------------------------------------------------------
// prompt
// ---------------------------------------------------------------------------

/**
 * Apply an AI instruction to the entire section text.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} promptText
 * @param {string} fullText  Current editor plain text (editor.getText())
 * @returns {Promise<{ proposed_text: string }>}
 */
export async function prompt(companyId, sectionName, promptText, fullText) {
  try {
    const res = await fetch(`${API_BASE}/api/canvas/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        section_name: sectionName,
        prompt: promptText,
        full_text: fullText,
      }),
    });
    await assertOk(res);
    return await res.json();
  } catch {
    // Return a lightly annotated version of the full text (keeps content intact)
    const proposed_text = `${fullText}\n\n---\n*AI Review Note (${promptText}): Disclosure appears substantively complete. Recommend cross-verifying figures with the latest audited financial statements and ensuring SEBI ICDR Reg 237–238 compliance. Add regulatory citations where appropriate.*`;
    return { proposed_text };
  }
}

// ---------------------------------------------------------------------------
// inlineAI
// ---------------------------------------------------------------------------

/**
 * Execute an inline AI command at the cursor position.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} instruction  The instruction typed in the palette
 * @param {string} contextText  The paragraph text surrounding the cursor
 * @returns {Promise<{ proposed_text: string }>}
 */
export async function inlineAI(companyId, sectionName, instruction, contextText) {
  try {
    const res = await fetch(`${API_BASE}/api/canvas/inline-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        section_name: sectionName,
        instruction,
        context_text: contextText,
      }),
    });
    await assertOk(res);
    return await res.json();
  } catch {
    // Return contextText with a professional AI-inline edit applied
    const pool = REWRITE_BANK['professional'];
    const proposed_text = pool[Math.floor(Math.random() * pool.length)];
    return { proposed_text };
  }
}

// ---------------------------------------------------------------------------
// copilotAsk
// ---------------------------------------------------------------------------

/**
 * Send a question to the section-scoped AI Side Chat.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} question
 * @returns {Promise<{ answer: string }>}
 */
export async function copilotAsk(companyId, sectionName, question) {
  try {
    const res = await fetch(`${API_BASE}/api/copilot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        current_section: sectionName,
        question,
      }),
    });
    await assertOk(res);
    return await res.json();
  } catch {
    // Pick a section-matched answer from the bank
    const sectionKey = sectionName?.toLowerCase() ?? '';
    const bankKey = Object.keys(COPILOT_ANSWER_BANK).find(
      (k) => k !== 'default' && sectionKey.includes(k)
    ) ?? 'default';
    const pool = COPILOT_ANSWER_BANK[bankKey];
    const answer = pool[Math.floor(Math.random() * pool.length)];
    return { answer };
  }
}

// ---------------------------------------------------------------------------
// generateSection
// ---------------------------------------------------------------------------

/**
 * Trigger the full LangGraph pipeline to generate a draft for a specific section.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @returns {Promise<{ draft_text: string, section_id: string, completeness_score: number, gap_count: number }>}
 */
export async function generateSection(companyId, sectionName) {
  try {
    const res = await fetch(`${API_BASE}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        section_name: sectionName,
      }),
    });
    await assertOk(res);
    return await res.json();
  } catch (error) {
    console.error("Agent Run Error:", error);
    // Mock fallback
    const pool = REWRITE_BANK['expand'];
    const draft_text = pool[Math.floor(Math.random() * pool.length)];
    return { draft_text, section_id: 'mock-id', completeness_score: 80, gap_count: 0 };
  }
}

// ---------------------------------------------------------------------------
// chatEditSection
// ---------------------------------------------------------------------------

/**
 * Edit a generated section via Chatbot using Groq Llama 3.3.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} prompt
 * @returns {Promise<{ new_draft_text: string }>}
 */
export async function chatEditSection(companyId, sectionName, prompt) {
  try {
    const res = await fetch(`${API_BASE}/api/canvas/chat-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        section_name: sectionName,
        prompt: prompt,
      }),
    });
    await assertOk(res);
    return await res.json();
  } catch (error) {
    console.error("Chat Edit Error:", error);
    // Mock fallback
    const pool = REWRITE_BANK['rewrite'];
    const new_draft_text = pool[Math.floor(Math.random() * pool.length)];
    return { new_draft_text };
  }
}

// ---------------------------------------------------------------------------
// getEvidence
// ---------------------------------------------------------------------------

/**
 * Fetch regulatory citation cards for the active section.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @returns {Promise<Array>} Array of CitationCard objects
 */
export async function getEvidence(companyId, sectionName) {
  try {
    const res = await fetch(
      `${API_BASE}/api/canvas/evidence/${encodeURIComponent(companyId)}/${encodeURIComponent(sectionName)}`
    );
    await assertOk(res);
    return await res.json();
  } catch {
    // Mock: return all EVIDENCE_MAP values as an array
    return Object.values(EVIDENCE_MAP);
  }
}

// ---------------------------------------------------------------------------
// getSuggestions
// ---------------------------------------------------------------------------

/**
 * Fetch smart suggestions / gap analysis for the active section.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {Array}  flaggedGaps  Section's current flagged_gaps array (used for mock fallback)
 * @returns {Promise<Array>} Array of SuggestionCard objects
 */
export async function getSuggestions(companyId, sectionName, flaggedGaps = []) {
  try {
    const res = await fetch(
      `${API_BASE}/api/canvas/suggestions/${encodeURIComponent(companyId)}/${encodeURIComponent(sectionName)}`
    );
    await assertOk(res);
    return await res.json();
  } catch {
    // Return section-matched suggestions from the bank
    const key = sectionName?.toLowerCase() ?? '';
    const bankKey = Object.keys(SUGGESTIONS_BANK).find(
      (k) => k !== 'default' && key.includes(k)
    ) ?? 'default';
    return SUGGESTIONS_BANK[bankKey];
  }
}

// ---------------------------------------------------------------------------
// uploadImage
// ---------------------------------------------------------------------------

/**
 * Upload an image file to the backend and receive a hosted URL.
 *
 * @param {FormData} formData  Must contain a field named "file" with the image blob
 * @param {File}     file      The original File object (used for mock fallback)
 * @returns {Promise<{ url: string }>}
 */
export async function uploadImage(formData, file) {
  try {
    const res = await fetch(`${API_BASE}/api/canvas/upload-image`, {
      method: 'POST',
      body: formData,
      // No Content-Type header — let the browser set the multipart boundary
    });
    await assertOk(res);
    return await res.json();
  } catch {
    // Mock: create a local object URL from the original file
    const url = file ? URL.createObjectURL(file) : '';
    return { url };
  }
}

// ---------------------------------------------------------------------------
// exportSection
// ---------------------------------------------------------------------------

/**
 * Export a single section as DOCX or PDF.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} content     Editor HTML (editor.getHTML())
 * @param {string} fmt         'docx' | 'pdf'
 * @returns {Promise<Blob>}
 */
export async function exportSection(companyId, sectionName, content, fmt) {
  try {
    const res = await fetch(`${API_BASE}/api/export/section/${encodeURIComponent(fmt)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId,
        section_name: sectionName,
        content,
      }),
    });
    await assertOk(res);
    return await res.blob();
  } catch {
    // Mock: return a plain-text blob with the section content
    return new Blob([content], { type: 'text/plain' });
  }
}

// ---------------------------------------------------------------------------
// exportFull
// ---------------------------------------------------------------------------

/**
 * Export the full DRHP document as DOCX or PDF.
 *
 * @param {string} companyId
 * @param {string} fmt  'docx' | 'pdf'
 * @returns {Promise<Blob>}
 */
export async function exportFull(companyId, fmt) {
  try {
    const res = await fetch(`${API_BASE}/api/export/full/${encodeURIComponent(fmt)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId }),
    });
    await assertOk(res);
    return await res.blob();
  } catch {
    // Mock: return a plain-text blob indicating offline export
    return new Blob(
      [`Full DRHP export for company: ${companyId}\n\n[Generated in offline / demo mode]`],
      { type: 'text/plain' }
    );
  }
}

// ---------------------------------------------------------------------------
// Re-export mock data for use in other modules (e.g., CanvasRoot, EvidencePanel)
// ---------------------------------------------------------------------------
export { SECTIONS_25, EVIDENCE_MAP };
