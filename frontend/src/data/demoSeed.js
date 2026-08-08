/**
 * demoSeed.js — MOCK DATA for "one-click demo access" / "continue with sample
 * data". Not real backend state; see utils/demoMode.js for how it's wired in.
 *
 * Scenario: Nirmaan Technologies Limited, a RegTech/AI SaaS SME going public
 * on NSE Emerge. Section draft_text is drawn from the reference DRHP excerpt
 * provided for this demo (cover page, company summary, business overview,
 * financial highlights, MD&A) plus a handful of short sections synthesised
 * directly from the same source facts (promoters/board/KMP, licenses, capital
 * structure) where no excerpt was given. Sections left blank below are
 * intentionally blank — they mirror the seed's own "not_started" status.
 *
 * TODO(Backend): replace with real API data once a demo/sandbox account
 * exists server-side. App.jsx is the only consumer that seeds top-level app
 * state from these exports, so swapping the source is a one-file change.
 */

import { DEMO_COMPANY_ID, DEMO_COMPANY_NAME } from '../utils/demoMode.js';

// ---------------------------------------------------------------------------
// Company Profile answers (the 11-question survey) — pre-filled for demo mode
// ---------------------------------------------------------------------------

export const DEMO_PROFILE_ANSWERS = {
  legal_name: 'Nirmaan Technologies Private Limited',
  org_type: 'Private Limited Company',
  industry: 'Information Technology / Software',
  incorporation_date: '2019-08-22',
  cin: 'U72900PN2019PTC184627',
  business_model: 'B2B',
  employee_count: '51–100',
  annual_revenue: '₹10–25 Crore',
  purpose: 'Preparing for an SME IPO',
  ipo_timeline: 'Within 3 months',
  intermediaries: ['Merchant Banker', 'Legal Advisor', 'Auditor', 'Registrar'],
};

// ---------------------------------------------------------------------------
// DRHP sections — canonical SECTIONS_25 order (see canvas/services/canvasApi.js)
// ---------------------------------------------------------------------------

const S = (name, status, score, draft_text = '') => ({
  id: `demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  name,
  title: name,
  status,
  score,
  locked: status === 'approved',
  draft_text,
  flagged_gaps: [],
});

export const DEMO_SECTIONS = [
  S('Cover Page & General Information', 'approved', 97, `# NIRMAAN TECHNOLOGIES LIMITED

*(formerly Nirmaan Technologies Private Limited, prior to its conversion into a public limited company with effect from February 2, 2027)*

**Corporate Identity Number:** U72900PN2019PTC184627 (post-conversion CIN: U72900PN2019PLC184627)

Our Company was incorporated as "Nirmaan Technologies Private Limited" on August 22, 2019 under the Companies Act, 2013, and was converted into a public limited company, with its name changed to "Nirmaan Technologies Limited", with effect from February 2, 2027.

**Registered and Corporate Office:** 4th Floor, Cerebrum IT Park, Kalyani Nagar, Pune, Maharashtra – 411006
**Contact Person:** Priyanka Sinha, Company Secretary & Compliance Officer
**Telephone:** +91 20 6712 3400 · **E-mail:** priyanka@nirmaan.tech
**Website:** www.nirmaan.tech
**Promoters:** Aarav Sharma and Kavya Iyer

## The Offer

Initial Public Offering of 20,00,000 Equity Shares of face value ₹10 each ("Equity Shares"), aggregating up to ₹38.00 crore, comprising a Fresh Issue and an Offer for Sale by a seed investor selling shareholder.

| Type | Fresh Issue | Offer for Sale | Total Offer Size | Face Value |
|---|---|---|---|---|
| Fresh Issue and Offer for Sale | 15,79,000 Equity Shares | 4,21,000 Equity Shares | 20,00,000 Equity Shares (up to ₹38.00 crore) | ₹10 each |

Proposed to be listed on **NSE Emerge**, the SME platform of the National Stock Exchange of India Limited, pursuant to Regulation 229(2) of the SEBI ICDR Regulations, 2018 (SME segment), as the Company does not meet the profitability track-record criteria under Regulation 228 in all of the last three financial years.

## Book Running Lead Manager

Quotient Capital Advisors LLP — Contact: Neel Kapadia

## Registrar to the Offer

Meridian Registry Services Private Limited — Contact: Suresh Rane

## Bid/Offer Programme

Anchor Investor Bidding Date: March 24, 2027 · Bid/Offer Opened: March 25, 2027 · Bid/Offer Closed: March 27, 2027`),

  S('Risk Factors', 'approved', 86, `Our business is substantially dependent on the continued services of our Promoters, particularly our Whole-time Director and Chief Technology Officer, who is primarily responsible for the architecture of our proprietary AI models. The loss of key management or technical personnel could adversely affect our ability to develop and maintain our platform. Additionally, our top 5 enterprise customers collectively accounted for approximately 47% of our Annual Recurring Revenue in Fiscal 2024, and any loss of these customers could materially affect our revenues.`),

  S('Introduction', 'approved', 94, `## Summary of Our Company

We are a Pune-headquartered information technology company operating in the RegTech / AI SaaS space, offering a cloud-based platform used by SME issuers, merchant bankers and compliance teams to prepare, validate and manage SEBI-compliant initial public offering disclosure documents. Our platform performs automated drafting, evidence mapping and provides regulatory intelligence to its users.

Our Company was incorporated on August 22, 2019 and our registered office is situated at 4th Floor, Cerebrum IT Park, Kalyani Nagar, Pune, Maharashtra – 411006. As of the date of this Prospectus, our Company has no subsidiaries.

Our platform is used entirely on a business-to-business (B2B) basis. We derive our revenue under a subscription (Software-as-a-Service) model comprising tiered annual licenses together with one-time implementation and onboarding fees. Approximately 6% of our revenue is derived from exports.`),

  S('General Information', 'approved', 95, `Our Company's registered office is situated at 4th Floor, Cerebrum IT Park, Kalyani Nagar, Pune, Maharashtra – 411006. Our Company was incorporated under the Companies Act, 2013 with Corporate Identity Number U72900PN2019PTC184627, and the Equity Shares are proposed to be listed on NSE Emerge. Quotient Capital Advisors LLP has been appointed as the Book Running Lead Manager, and Meridian Registry Services Private Limited as Registrar to the Offer. B P S & Associates, Chartered Accountants, are the statutory auditors of our Company.`),

  S('Capital Structure', 'draft', 81, `Pursuant to conversion of all outstanding Series A Compulsorily Convertible Preference Shares into Equity Shares with effect from March 2026, the issued, subscribed and paid-up equity share capital of our Company stands at ₹4,12,00,000 divided into 41,20,000 Equity Shares of face value ₹10 each. Our Company has reserved 8.2% of the fully diluted share capital under the Nirmaan Employee Stock Option Scheme, 2021.`),

  S('Objects of the Offer', 'draft', 91, `## Objects of the Issue

The Net Proceeds of the Offer are proposed to be utilised as follows:

| Object | % of Net Proceeds |
|---|---|
| Product research & development and AI infrastructure | 40% |
| Sales and marketing expansion | 25% |
| Cloud infrastructure and security certification | 15% |
| General corporate purposes | 20% |

Our strategy, as reflected in this proposed utilisation, is to: (i) invest in product research and development and AI infrastructure; (ii) expand our sales and marketing efforts; (iii) invest in cloud infrastructure and security certifications; and (iv) apply funds towards general corporate purposes.`),

  S('Basis of Issue Price', 'not_started', 0),

  S('Statement of Tax Benefits', 'approved', 90, `As certified by B P S & Associates, Chartered Accountants (statutory auditors of the Company), the statement of possible tax benefits available to the Company and its shareholders under applicable tax laws is annexed to this Prospectus. Investors are advised to consult their own tax advisors regarding the tax consequences of subscribing to or holding the Equity Shares, in view of the fact that certain benefits are dependent on fulfilling conditions prescribed under the relevant tax laws.`),

  S('About the Company', 'approved', 94, `Nirmaan Technologies Limited operates a cloud-based AI SaaS platform used by SME issuers, merchant bankers, and compliance teams to prepare, validate, and manage SEBI-compliant IPO disclosure documents through automated drafting, evidence mapping, and regulatory intelligence. Our Company is founder-led and was venture-backed prior to this Offer, having raised a seed round of ₹6.5 crore in 2020 and a Series A round of ₹22 crore in 2022 from two institutional investors, with the Series A preference shares fully converted to equity ahead of this Offer.

We operate a single development and operations centre in Pune, with cloud infrastructure hosted on Amazon Web Services (AWS) in the Mumbai region (ap-south-1).`),

  S('Industry Overview', 'approved', 89, `The RegTech and compliance automation software market in India remains at a nascent stage of adoption relative to global markets, with increasing regulatory complexity across capital markets creating structural tailwinds for AI-assisted compliance platforms.`),

  S('Our Business', 'approved', 92, `## Overview

Our platform helps SME issuers, merchant bankers and compliance teams prepare, validate and manage SEBI-compliant IPO disclosure documents, through three principal capabilities: automated drafting, evidence mapping, and regulatory intelligence. As of the periods covered in our financial information, we had 34 active enterprise customers and a net revenue retention rate of 118%.

## Operations and Infrastructure

We operate a single development and operations centre located in Pune, Maharashtra. Our cloud infrastructure is hosted on Amazon Web Services (AWS) in the Mumbai region (ap-south-1). Our platform is supported by a source code escrow arrangement and is certified under ISO/IEC 27001:2022 for information security management. We process and store customer data within India and are compliant with the Digital Personal Data Protection Act, 2023 ("DPDP Act"). We conduct annual third-party penetration testing of our systems.

## Intellectual Property

We hold three registered trademarks (the "Nirmaan" wordmark and logo, "AIKG" and "EDDI") and have one patent application pending examination, in relation to an evidence-mapping method for AI-generated regulatory disclosures. This patent application has not been granted as on the date of this Prospectus and is disclosed on an "application pending" basis only. Our source code is proprietary to our Company.

## Competition

Our competitors include the Diligent Compliance Suite (a global compliance software provider), in-house solutions developed by large merchant banking firms, and traditional legal and compliance outsourcing firms.

## Customer Concentration

Our top five enterprise customers, being merchant banking firms, together accounted for approximately 47% of our Annual Recurring Revenue ("ARR"). Any loss of one or more of these customers could have a material adverse effect on our business and results of operations.

## Our Competitive Strengths

Our Company's competitive strengths include: (i) a subscription-based SaaS revenue model with a net revenue retention rate of 118%, indicating expansion within our existing customer base; (ii) proprietary, patent-pending evidence-mapping technology supporting AI-generated regulatory disclosures; (iii) information security credentials, including ISO/IEC 27001:2022 certification and compliance with the DPDP Act, 2023; and (iv) an experienced founding and management team, including an Independent Director who is a former SEBI official.`),

  S('Key Industry Regulations', 'in_review', 85, `As a provider of software used in connection with SEBI-regulated capital markets processes, our operations are indirectly affected by the SEBI ICDR Regulations, 2018 and related SME listing norms that our platform is designed to help issuers comply with. Our Company itself is subject to applicable information technology, data protection, and consumer protection laws, including the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023, together with regulations applicable to Indian companies generally, including the Companies Act, 2013.`),

  S('History and Corporate Structure', 'draft', 88, `Our Company was originally incorporated as "Nirmaan Technologies Private Limited" on August 22, 2019 under the Companies Act, 2013, and was converted into a public limited company with effect from February 2, 2027, upon which its name was changed to "Nirmaan Technologies Limited". Our Company has no subsidiaries. Pursuant to conversion of all outstanding Series A Compulsorily Convertible Preference Shares into Equity Shares with effect from March 2026, our issued, subscribed and paid-up equity share capital stands at ₹4,12,00,000 divided into 41,20,000 Equity Shares of face value ₹10 each.`),

  S('Management & Board of Directors', 'draft', 89, `Our Board comprises the following directors:

| Name | Designation |
|---|---|
| Aarav Sharma | Managing Director & CEO |
| Kavya Iyer | Whole-time Director & CTO |
| Ramesh Chandra | Independent Director (former SEBI official) |
| Nandini Kapoor | Independent Director |
| Vikram Oberoi | Nominee Director (Institutional Investor) |

Our management believes that the composition of the Board, including the presence of an Independent Director with prior regulatory experience at SEBI, strengthens our corporate governance practices ahead of this Offer.`),

  S('Key Managerial Personnel (KMP)', 'draft', 86, `Our key managerial personnel, in addition to our Promoters, are:

| Name | Role |
|---|---|
| Priyanka Sinha | Company Secretary & Compliance Officer |
| Rahul Deshmukh | Chief Financial Officer |
| Sneha Patwardhan | VP Engineering |`),

  S('Our Promoters & Promoter Group', 'not_started', 0),

  S('Related Party Transactions', 'in_review', 78, `Our Company's office premises are sub-leased from Cerebrum Business Park Private Limited, which is not related to our Promoters. Our employee stock option pool is administered through the Nirmaan Employee Welfare Trust. Save as disclosed above, our Company has not entered into any related party transactions that are material in the context of this Offer.

*Draft — disclosure language for the office sub-lease and ESOP Trust arrangement is pending final review by legal counsel.*`),

  S('Dividend Policy', 'approved', 93, `Our Company has not declared or paid any dividends on its Equity Shares in the last three fiscal years. Our Company intends to retain future earnings, if any, to finance the expansion of its business, and does not anticipate declaring dividends in the near term. Any future determination as to dividends will depend on factors considered relevant by our Board, including our results of operations, cash flows, capital requirements, and applicable legal restrictions.`),

  S('Financial Statements (3 Years)', 'needs_regeneration', 70, `## Key Financial Information

| Particulars (₹ in crore) | FY22 | FY23 | FY24 |
|---|---|---|---|
| Revenue | 4.6 | 9.8 | 17.4 |
| Net Profit / (Loss) | (2.1) | (0.6) | 1.8 |

| Net Worth (₹ Cr) | EBITDA (₹ Cr) | ARR (₹ Cr) | ARR Growth (YoY) |
|---|---|---|---|
| 14.2 | 2.9 | 19.6 | 78% |

Net revenue retention was 118% and our Company had 34 active customers, in each case as of the relevant measurement date reflected in our records. Our Company has no outstanding borrowings. Contingent liabilities amounted to ₹18 lakh, comprising a performance bank guarantee issued to one enterprise client. Our financial statements for Fiscal 2022, Fiscal 2023 and Fiscal 2024 were audited by B P S & Associates, Chartered Accountants.

*Flagged by the Consistency Engine: the ARR figure in the SaaS metrics MIS differs from the revenue recognised in the audited P&L for FY24, pending reconciliation of deferred revenue treatment.*`),

  S('Management Discussion & Analysis', 'draft', 74, `Our Company's revenue grew from ₹4.6 crore in Fiscal 2022 to ₹17.4 crore in Fiscal 2024, and our Company recorded a net profit of ₹1.8 crore in Fiscal 2024 as compared to net losses in Fiscal 2022 and Fiscal 2023. Our management attributes this trend to growth in our subscription customer base and improved net revenue retention. Our Company's business is significantly dependent on the continued association of our co-founders, particularly our Whole-time Director and Chief Technology Officer, who is primarily responsible for our AI/ML architecture; the loss of either founder could adversely affect our business.`),

  S('Corporate Governance', 'not_started', 0),
  S('Terms of the Issue', 'not_started', 0),

  S('Other Regulatory & Statutory Disclosures', 'in_review', 71, `Our Company holds a valid GST registration, Startup India (DPIIT) recognition certificate, and ISO/IEC 27001:2022 certification for information security management. Our Company has one patent application pending examination in relation to an evidence-mapping method for AI-generated regulatory disclosures; this application has not been granted as on the date of this Prospectus and is disclosed strictly on an "application pending" basis. Our Company confirms that there is no winding-up petition or reference to the erstwhile Board for Industrial and Financial Reconstruction (BIFR) pending against it.`),

  S('Material Contracts & Documents', 'not_started', 0),
  S('Declaration & Undertakings', 'not_started', 0),
];

// ---------------------------------------------------------------------------
// Dashboard readiness — see Dashboard.jsx's expected shape
// ---------------------------------------------------------------------------

const approvedCount = DEMO_SECTIONS.filter((s) => s.locked).length;
const notStartedCount = DEMO_SECTIONS.filter((s) => s.status === 'not_started').length;
const inDraftCount = DEMO_SECTIONS.length - approvedCount - notStartedCount;

export const DEMO_READINESS = {
  overall_score: 63,
  financial_score: 88,
  legal_score: 82,
  management_score: 96,
  sections_approved: approvedCount,
  sections_in_draft: inDraftCount,
  sections_pending: notStartedCount,
  total_open_gaps: 4,
};

// ---------------------------------------------------------------------------
// Eligibility — see Eligibility.jsx / Dashboard.jsx's expected shape
// ---------------------------------------------------------------------------

export const DEMO_ELIGIBILITY = {
  eligible: false,
  company_name: DEMO_COMPANY_NAME,
  company_id: DEMO_COMPANY_ID,
  checks: [
    {
      name: 'Minimum post-issue paid-up capital met',
      passed: true,
      reason: '',
      clause_id: 'SEBI ICDR Reg. 228(1)',
    },
    {
      name: 'Net worth / operating track record criteria met',
      passed: true,
      reason: '',
      clause_id: 'SEBI ICDR Reg. 228',
    },
    {
      name: 'Positive cash accruals in required years',
      passed: false,
      reason: 'FY22 and FY23 were loss-making — eligibility is being assessed under the alternate route in Regulation 229(2), not the profitability-based route in Regulation 228.',
      clause_id: 'SEBI ICDR Reg. 229(2)',
    },
    {
      name: 'No winding-up petition / BIFR reference',
      passed: true,
      reason: '',
      clause_id: 'SEBI ICDR Reg. 228(2)',
    },
  ],
  regulatory_citations: [
    'SEBI ICDR Regulations, 2018 — Regulation 228',
    'SEBI ICDR Regulations, 2018 — Regulation 229(2)',
  ],
};

// ---------------------------------------------------------------------------
// Consistency — see Dashboard.jsx's expected shape
// ---------------------------------------------------------------------------

export const DEMO_CONSISTENCY = {
  has_issues: true,
  issue_count: 1,
  checks: [
    {
      field: 'arr_vs_recognized_revenue',
      severity: 'critical',
      fix: 'ARR reported in the SaaS metrics MIS (₹19.6 Cr) does not reconcile with revenue recognised in the FY24 audited P&L after the deferred-revenue correction — reconcile the two figures before regenerating Financial Statements and MD&A.',
    },
  ],
};

export { DEMO_COMPANY_ID, DEMO_COMPANY_NAME };
