# 🛑 Problem Statement Analysis

> **SEBI Hackathon PS04: Simplifying IPO Offer Document Preparation for SMEs** — market context, regulatory framework, technical barriers, and Nirmaan AI's solution approach.

---

## The Problem

### Market Context

India's SME sector represents over **63 million enterprises**, employing approximately **110 million people** and contributing ~30% to national GDP. The SME Exchange platforms — **BSE SME** and **NSE Emerge** — were specifically created to enable SME companies to raise growth capital from public markets.

Yet, as of 2024, **fewer than 1% of India's SMEs have accessed public equity markets**. The primary bottleneck is the IPO preparation process itself — specifically, the preparation of the **Draft Red Herring Prospectus (DRHP)**.

### What is a DRHP?

The DRHP is the primary disclosure document that an SME must file with SEBI (via a registered Merchant Banker) before listing on BSE SME or NSE Emerge. It contains:

- **25 mandatory sections** covering every aspect of the company: business, financials, risks, management, legal structure, and offer terms
- **All material information** that an investor needs to make an informed decision
- **SEBI ICDR 2018 compliance** — every disclosure must meet specific regulatory requirements
- **Three years of audited financial data** in a specific format
- **Management backgrounds and litigation disclosures** for all KMPs
- **Independent verification** and certification by a SEBI-registered Merchant Banker

### The Preparation Pain

| Pain Point | Impact |
|---|---|
| **Duration**: 4–8 months of active preparation | SME promoters can't focus on running the business |
| **Cost**: ₹25–75 Lakhs in professional fees | Often 5–10% of the capital being raised for smaller SMEs |
| **Expertise required**: Deep knowledge of SEBI ICDR 2018 | SME promoters typically have zero capital markets experience |
| **Document complexity**: 200–500 pages per DRHP | Even identifying what information is needed takes weeks |
| **Intermediary dependency**: Merchant Bankers charge from day one | No way to self-prepare before engaging expensive advisors |
| **Iteration cycles**: Multiple rounds of SEBI observations | Each observation set adds 2–4 weeks to timeline |

---

## The Regulatory Framework

### SEBI ICDR 2018 (Issue of Capital and Disclosure Requirements)

The primary regulation governing IPO offer documents. For SMEs, the key applicable sections are:

| Regulation | Topic |
|---|---|
| **Reg 229** | Eligibility conditions for SME IPO (EBITDA, net worth, capital limits) |
| **Reg 230** | Lock-in requirements for promoter shares |
| **Reg 233** | Capital structure disclosures |
| **Reg 237** | Risk factor disclosure requirements |
| **Reg 238** | General content requirements for offer documents |
| **March 2025 Amendment** | New KMP litigation disclosure requirement |

### SEBI DRHP Table of Contents (25 Mandatory Sections)

SEBI mandates a specific section order for all DRHP filings:

1. Cover Page & General Information
2. Risk Factors
3. Introduction
4. General Information
5. Capital Structure
6. Objects of the Offer
7. Basis of Issue Price
8. Statement of Tax Benefits
9. About the Company
10. Industry Overview
11. Our Business
12. Key Industry Regulations
13. History and Corporate Structure
14. Management & Board of Directors
15. Key Managerial Personnel (KMP)
16. Our Promoters & Promoter Group
17. Related Party Transactions
18. Dividend Policy
19. Financial Statements (3 Years)
20. Management Discussion & Analysis
21. Corporate Governance
22. Terms of the Issue
23. Other Regulatory & Statutory Disclosures
24. Material Contracts & Documents
25. Declaration & Undertakings

---

## Technical Barriers to Automation

Previous attempts to automate DRHP preparation have failed for three fundamental reasons:

### 1. Hallucination Risk
Standard LLMs confidently invent financial figures, regulatory citations, director names, and legal precedents. A DRHP with fabricated data is not just useless — it exposes the company and merchant banker to SEBI penalties and legal liability.

**Nirmaan AI's solution**: Strict anti-hallucination architecture — all financial data sourced only from the structured database, all regulatory citations sourced only from the retrieved ICDR corpus, all missing data flagged with explicit `⚠️ GAP:` markers rather than invented.

### 2. Regulatory Precision
SEBI's disclosure requirements are highly specific. "Sufficient" compliance is not acceptable — the exact regulation, the exact sub-clause, and the exact disclosure language must be correct.

**Nirmaan AI's solution**: RAPTOR-indexed ICDR corpus enables both broad thematic retrieval ("what are SME IPO eligibility requirements?") and precise clause-level retrieval ("what does Reg 229(2)(a) say?"). FlashRank cross-encoder reranking ensures the most relevant regulatory text is always at the top.

### 3. Long-Document Context
A complete DRHP is 200–500 pages. No single LLM context window can process the entire document simultaneously.

**Nirmaan AI's solution**: Section-by-section generation with a stateful LangGraph agent that maintains company context across all 25 sections via the structured database. Each section gets its own focused retrieval pass rather than trying to load everything at once.

---

## Nirmaan AI's Solution Approach

Nirmaan AI solves the DRHP preparation problem with a **5-phase pipeline**:

### Phase 0: Knowledge Base Construction
Before any specific company's DRHP is prepared, the system indexes:
- The complete SEBI ICDR 2018 regulatory text (with RAPTOR hierarchical understanding)
- Real DRHP filings from comparable companies (precedent examples)

This knowledge base is built once and reused for all companies.

### Phase 1: Guided Data Capture
Instead of requiring the promoter to understand what data is needed, Nirmaan AI interviews them conversationally and guides them through each piece of required information. Complex legal requirements are translated into plain English questions.

### Phase 2: Automated Eligibility Pre-screening
Before any drafting begins (and before engaging an expensive Merchant Banker), the system automatically checks whether the company meets SEBI's hard eligibility criteria. Companies that don't qualify are identified immediately — saving months of wasted preparation.

### Phase 3: AI-Powered Section Drafting
A LangGraph agent generates each of the 25 mandatory DRHP sections by:
1. Retrieving the specific regulatory requirements for that section
2. Retrieving real precedent examples from comparable DRHPs
3. Combining these with the company's structured data
4. Generating a compliance-ready draft with explicit gap markers for missing information

### Phase 4: Human Review & Certification
The platform preserves the mandatory role of the SEBI-registered Merchant Banker. Rather than replacing the intermediary, Nirmaan AI dramatically reduces their workload by:
- Delivering a substantially complete draft (not a blank template)
- Providing an explicit gap list (not requiring the banker to identify missing information from scratch)
- Enabling chat-based revisions (not requiring manual document editing)

### Phase 5: Final Assembly
Once all sections are certified by the Merchant Banker, the system assembles the final DRHP in SEBI's mandated TOC order and exports it as DOCX and PDF — ready for submission.

---

## Expected Impact

| Metric | Current State | With Nirmaan AI |
|---|---|---|
| DRHP preparation time | 4–8 months | 2–4 weeks |
| Initial draft cost | ₹5–15 Lakhs (professional fees) | Near zero (AI-generated) |
| Banker review time | 40–60% of preparation time | 15–25% (reviewing AI drafts vs. creating from scratch) |
| Information gap identification | Manual, error-prone | Systematic, automated |
| Regulatory compliance rate | Dependent on banker expertise | Grounded in complete ICDR corpus |
| Promoter involvement required | 100% from day 1 | Only for data provision and review |

---

## Limitations & Scope

Nirmaan AI is a **preparation assistant**, not a compliance certification tool. The following remain the responsibility of qualified professionals:

- **SEBI-registered Merchant Banker certification**: Legally mandated; cannot be automated
- **Auditor certification of financial statements**: Must be professionally audited
- **Legal due diligence**: Material contracts, litigation history, etc.
- **Final SEBI filing and correspondence**: Handled by the Merchant Banker
- **Investor-specific risk assessment**: Requires professional judgment

The platform is designed to make the promoter 80% prepared before their first meeting with a Merchant Banker — not to replace the Merchant Banker.
