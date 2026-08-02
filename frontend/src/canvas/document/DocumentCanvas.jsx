/**
 * DocumentCanvas.jsx
 *
 * Renders all 25 DRHP sections as a continuous document on a white A4 paper
 * centered on a light-gray "desk" — exactly like Microsoft Word.
 *
 * UX polish (req 1, 2, 3, 5, 8, 9):
 *  • Sections that overflow a logical page boundary are visually separated by
 *    a "page break" gap between A4 sheets with drop shadows.
 *  • Section headers show sequential numbers (§ 01 … § 25) + colored dot.
 *  • IntersectionObserver rootMargin tuned for smooth sidebar tracking.
 *  • Each editor fills naturally — Word-like flow.
 *  • SelectionPopup provides inline ChatGPT Canvas–style AI actions.
 *
 * Phase 2 polish:
 *  • Inline evidence badges next to AI-generated sections (regulatory + AI source)
 *  • Autosave toast via onAutosave callback prop
 */

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import Strike from '@tiptap/extension-strike';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import useCanvasStore from '../services/canvasStore.js';
import useVersionStore from '../versions/versionStore.js';
import { markdownToTipTap } from '../editor/markdownToTipTap.js';
import * as canvasApi from '../services/canvasApi.js';
import SelectionPopup from '../editor/SelectionPopup.jsx';

// ---------------------------------------------------------------------------
// Evidence badge data — section-specific regulatory and AI source references
// shown as small pill badges next to the section header for AI-authored content
// ---------------------------------------------------------------------------
const SECTION_EVIDENCE = {
  'cover':          [{ type: 'reg', text: 'Reg 26' }, { type: 'ai', text: 'AI Draft' }],
  'risk factor':    [{ type: 'reg', text: 'Reg 237' }, { type: 'reg', text: 'Reg 238' }, { type: 'ai', text: 'AI Draft' }],
  'capital struct': [{ type: 'reg', text: 'Reg 233' }, { type: 'reg', text: 'Reg 236' }, { type: 'ai', text: 'AI Draft' }],
  'objects':        [{ type: 'reg', text: 'Reg 232' }, { type: 'ai', text: 'AI Draft' }],
  'financial':      [{ type: 'reg', text: 'Sch VIII' }, { type: 'reg', text: 'Reg 238' }, { type: 'ai', text: 'AI Draft' }],
  'management':     [{ type: 'reg', text: 'Reg 238' }, { type: 'ai', text: 'AI Draft' }],
  'promoter':       [{ type: 'reg', text: 'Reg 236' }, { type: 'ai', text: 'AI Draft' }],
  'related party':  [{ type: 'reg', text: 'Reg 238' }, { type: 'ai', text: 'AI Draft' }],
  'industry':       [{ type: 'ai', text: 'AI Draft' }, { type: 'reg', text: 'Reg 237' }],
  'dividend':       [{ type: 'reg', text: 'Reg 234' }, { type: 'ai', text: 'AI Draft' }],
  'corporate gov':  [{ type: 'reg', text: 'LODR 2015' }, { type: 'ai', text: 'AI Draft' }],
};

function getEvidenceBadges(sectionName) {
  const key = sectionName.toLowerCase();
  const match = Object.keys(SECTION_EVIDENCE).find((k) => key.includes(k));
  return match ? SECTION_EVIDENCE[match] : null;
}

// ---------------------------------------------------------------------------
// EvidenceBadges — rendered inline in the section header strip
// Only shown for sections that have content (AI-authored or otherwise)
// ---------------------------------------------------------------------------
function EvidenceBadges({ sectionName, hasContent }) {
  if (!hasContent) return null;
  const badges = getEvidenceBadges(sectionName);
  if (!badges) return null;

  return (
    <span className="ai-evidence-badges" role="list" aria-label="Source references">
      {badges.map((b, i) => (
        <span
          key={i}
          className={`ai-evidence-badge ai-evidence-badge--${b.type}`}
          role="listitem"
          title={b.type === 'reg' ? `SEBI ICDR ${b.text}` : 'AI-generated content'}
        >
          <span className="ai-evidence-badge__icon" aria-hidden="true">
            {b.type === 'reg' ? '§' : '✦'}
          </span>
          {b.text}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Realistic placeholder content per section
// ---------------------------------------------------------------------------
function getPlaceholderContent(sectionName) {
  const n = sectionName.toLowerCase();

  if (n.includes('cover') || (n.includes('general') && n.includes('information'))) {
    return markdownToTipTap(`# Cover Page & General Information

**DRAFT RED HERRING PROSPECTUS**

*(Subject to completion and revision)*

**NIRMAAN TECHNOLOGIES LIMITED**

CIN: U72900MH2018PLC312456
Registered Office: 4th Floor, Baner IT Park, Baner Road, Pune – 411 045, Maharashtra, India.
Tel: +91-20-4890-XXXX | Email: ipo@nirmaan.tech | Website: www.nirmaan.tech

**Issue Details**

Fresh Issue of up to 40,00,000 Equity Shares of ₹10/- each at an Issue Price of ₹[●] per Equity Share aggregating up to ₹[●] Crores.

This DRHP is filed pursuant to SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018, as amended from time to time.

**BOOK RUNNING LEAD MANAGER**
IIFL Securities Limited | SEBI Registration: INM000010940
`);
  }

  if (n.includes('risk factor')) {
    return markdownToTipTap(`# Risk Factors

An investment in Equity Shares involves a high degree of risk. You should carefully consider all of the information in this Draft Red Herring Prospectus, including the risks and uncertainties described below, before making an investment decision.

**INTERNAL RISKS**

1. **Customer Concentration Risk** — Our top 3 customers accounted for approximately 42% of our total revenue for FY2024 (₹20.2 Cr of ₹48.2 Cr). The loss of or a significant reduction in business from any of these customers could adversely affect our revenues and profitability.

2. **Key Personnel Dependence** — Our success depends substantially on the continued services and performance of our senior management, including our Managing Director & CEO, Mr. Arjun Mehta, and our Whole-time Director & CFO, Ms. Priya Sharma.

3. **Technology Obsolescence** — The AI and SaaS industry is characterised by rapid technological change. Our ability to anticipate and respond to these changes will significantly affect our competitive position and results of operations.

**EXTERNAL AND REGULATORY RISKS**

4. **SEBI Regulatory Changes** — Our business is directly dependent on the SEBI (ICDR) Regulations framework. Any amendments to these regulations may require significant rework of our compliance engine.

5. **Market Competition** — The market for AI-enabled legal-tech and RegTech solutions is evolving rapidly. We face competition from both domestic and international players with significantly greater resources.

> *AI Note: Customer concentration risk (Item 1) should be further quantified with FY24 client-wise revenue breakdown. [Reg 237 | SEBI ICDR Regulations 2018]*
`);
  }

  if (n.includes('capital structure')) {
    return markdownToTipTap(`# Capital Structure

## Share Capital

| Particulars | No. of Shares | Face Value (₹) | Amount (₹ Crores) |
|---|---|---|---|
| Authorised Share Capital | 2,00,00,000 | 10 | 20.00 |
| Issued, Subscribed & Paid-up (Pre-IPO) | 1,20,00,000 | 10 | 12.00 |
| Fresh Issue (IPO) | 40,00,000 | 10 | 4.00 |
| Post-Issue Paid-up Capital | 1,60,00,000 | 10 | 16.00 |

## Promoter Shareholding

| Promoter | Pre-IPO Shares | Pre-IPO % | Post-IPO % |
|---|---|---|---|
| Mr. Arjun Mehta | 54,24,000 | 45.20% | 33.90% |
| Ms. Priya Sharma | 26,76,000 | 22.30% | 16.73% |
| **Total Promoter** | **81,00,000** | **67.50%** | **50.63%** |

Post-IPO promoter holding of **50.63%** satisfies the minimum promoter contribution requirement under Regulation 236 of the SEBI ICDR Regulations 2018.

[Reg 233 | SEBI ICDR Regulations 2018] [Reg 236 | SEBI ICDR Regulations 2018]
`);
  }

  if (n.includes('objects')) {
    return markdownToTipTap(`# Objects of the Offer

The Net Proceeds from the Fresh Issue are proposed to be utilised for the following objects:

| Sr. No. | Object | Amount (₹ Crores) | % of Net Proceeds |
|---|---|---|---|
| 1 | Expansion of Technology Infrastructure | 18.50 | 46.3% |
| 2 | Sales & Marketing Expansion | 8.00 | 20.0% |
| 3 | Research & Development | 6.50 | 16.3% |
| 4 | Working Capital Requirements | 4.00 | 10.0% |
| 5 | General Corporate Purposes | 3.00 | 7.5% |
| **Total** | | **40.00** | **100%** |

The above utilisation schedule is indicative and subject to market conditions. The Company reserves the right to revise the estimated amounts in consultation with the BRLM.

[Reg 232 | SEBI ICDR Regulations 2018]
`);
  }

  if (n.includes('financial') || n.includes('management discussion')) {
    return markdownToTipTap(`# Financial Statements

## Restated Summary Statement of Financial Information

| Particulars (₹ Crores) | FY2024 | FY2023 | FY2022 |
|---|---|---|---|
| Total Revenue | 48.24 | 37.92 | 28.41 |
| Revenue Growth (YoY) | 27.2% | 33.5% | — |
| EBITDA | 10.61 | 7.83 | 5.19 |
| EBITDA Margin | 22.0% | 20.6% | 18.3% |
| Profit After Tax (PAT) | 7.32 | 5.41 | 3.12 |
| PAT Margin | 15.2% | 14.3% | 11.0% |

**Revenue CAGR (FY2022–FY2024): 30.3%**

## Key Financial Ratios

| Ratio | FY2024 | FY2023 | FY2022 |
|---|---|---|---|
| Return on Equity (ROE) | 18.2% | 16.4% | 13.1% |
| Debt-to-Equity Ratio | 0.4x | 0.6x | 0.9x |
| Current Ratio | 2.1x | 1.8x | 1.5x |
| EPS (Basic) | ₹6.10 | ₹4.51 | ₹2.60 |

> *Cross-verify revenue figures with Audited Financial Statements — Annual Report FY24, Page 17.*
`);
  }

  if (n.includes('management') || n.includes('board')) {
    return markdownToTipTap(`# Management & Board of Directors

## Board Composition

| Name | Designation | Category | DIN |
|---|---|---|---|
| Mr. Arjun Mehta | Managing Director & CEO | Executive Promoter | [●] |
| Ms. Priya Sharma | Whole-time Director & CFO | Executive Promoter | [●] |
| Mr. Rajiv Bose | Independent Director | Non-Executive Independent | [●] |
| Ms. Kavita Iyer | Independent Director | Non-Executive Independent | [●] |

The Board comprises 2 independent directors out of 4 total directors, satisfying SEBI Listing Obligations requirements for SME companies.

## Key Managerial Personnel

| Name | Designation | Remuneration FY24 |
|---|---|---|
| Mr. Arjun Mehta | MD & CEO | ₹[●] per annum |
| Ms. Priya Sharma | WTD & CFO | ₹[●] per annum |
| Mr. Karan Desai | Company Secretary | ₹[●] per annum |

[Reg 238 | SEBI ICDR Regulations 2018]
`);
  }

  if (n.includes('promoter')) {
    return markdownToTipTap(`# Our Promoters & Promoter Group

## Promoter Details

**Mr. Arjun Mehta** (Founder & Managing Director)

- Date of Birth: 12th March 1982
- Educational Qualification: B.Tech (Computer Science), IIT Bombay (2004); MBA, IIM Ahmedabad (2006)
- PAN: AABPM1234F
- Address: [●], Pune, Maharashtra
- No criminal proceedings, civil disputes, or regulatory actions are pending as on the date of filing.

**Ms. Priya Sharma** (Co-Founder & Whole-time Director)

- Date of Birth: 24th July 1984
- Educational Qualification: B.Com (Hons), University of Mumbai (2005); CA (ICAI, 2008); CFA (CFA Institute, 2011)
- PAN: ACDPS5678G

> *AI Note: 5-year professional history required under SEBI ICDR Reg 236. Please add employment history for both promoters.*
`);
  }

  if (n.includes('related party')) {
    return markdownToTipTap(`# Related Party Transactions

All related party transactions have been entered into in the ordinary course of business and at arm's length basis, in compliance with the Companies Act, 2013.

## Summary of Related Party Transactions

| Nature of Transaction | Related Party | FY2024 (₹ Cr) | FY2023 (₹ Cr) | FY2022 (₹ Cr) |
|---|---|---|---|---|
| Loan from Promoter | Mr. Arjun Mehta | 4.20 | 6.80 | 9.50 |
| Rent paid | Mehta Family Trust | 0.36 | 0.36 | 0.30 |
| Director Remuneration | Mr. Arjun Mehta | [●] | [●] | [●] |
| Director Remuneration | Ms. Priya Sharma | [●] | [●] | [●] |

> *AI Note: Promoter loan of ₹4.2 Cr — disclose interest rate, security details, and repayment terms. [Reg 238 | SEBI ICDR Regulations 2018]*
`);
  }

  if (n.includes('dividend')) {
    return markdownToTipTap(`# Dividend Policy

The Company has not declared or paid any dividends on its Equity Shares in the past three financial years (FY2022, FY2023, FY2024).

The Board of Directors shall recommend dividends, if any, at its discretion, taking into account the Company's earnings, capital requirements, overall financial condition, and applicable Indian legal requirements.

The Company does not have a formal dividend policy as on the date of this DRHP. Future dividend declarations, if any, will be subject to shareholder approval at the Annual General Meeting.
`);
  }

  if (n.includes('corporate governance')) {
    return markdownToTipTap(`# Corporate Governance

The Company has constituted the following Board committees in compliance with SEBI Listing Obligations and Disclosure Requirements Regulations, 2015:

**Audit Committee**
- Ms. Kavita Iyer (Chairperson) — Independent Director
- Mr. Rajiv Bose — Independent Director
- Ms. Priya Sharma — Whole-time Director & CFO

**Nomination and Remuneration Committee**
- Mr. Rajiv Bose (Chairperson) — Independent Director
- Ms. Kavita Iyer — Independent Director
- Mr. Arjun Mehta — Managing Director

**Stakeholders Relationship Committee**
- Ms. Kavita Iyer (Chairperson) — Independent Director
- Mr. Arjun Mehta — Managing Director
`);
  }

  return markdownToTipTap(`# ${sectionName}

This section is pending content. Click here to begin editing, or open the **✦ AI** menu in the toolbar to generate a draft.

Select any text to see inline AI actions.
`);
}

// ---------------------------------------------------------------------------
// Margin comment — lightweight reviewer annotation (req 5)
// ---------------------------------------------------------------------------
const MARGIN_COMMENTS = {
  'risk factor':      { author: 'IIFL Review', text: 'Quantify customer concentration — add exact FY24 %.' },
  'capital structure':{ author: 'Legal Counsel', text: 'Confirm lock-in computation date vs. filing date.' },
  'financial':        { author: 'Auditor', text: 'Restated financials — cross-check with signed auditor report.' },
  'objects':          { author: 'SEBI Obs.', text: 'GCP object exceeds 25% — reduce or justify.' },
  'promoter':         { author: 'IIFL Review', text: 'Add 5-year professional history per Reg 236.' },
  'related party':    { author: 'Legal Counsel', text: 'RPT loan terms missing — add interest rate + security.' },
  'management':       { author: 'Company Sec.', text: 'Insert DIN numbers for all directors.' },
};

function getMarginComment(sectionName) {
  const key = sectionName.toLowerCase();
  const match = Object.keys(MARGIN_COMMENTS).find((k) => key.includes(k));
  return match ? MARGIN_COMMENTS[match] : null;
}

// ---------------------------------------------------------------------------
// Page number footer per section (req 2)
// ---------------------------------------------------------------------------
function PageNumber({ index }) {
  return (
    <div className="doc-page-number" aria-hidden="true">
      — {index + 2} —
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionEditor — one TipTap per section, all on the same paper flow
// ---------------------------------------------------------------------------
function SectionEditor({ section, index, companyId, editorRefs, onAutosave }) {
  const upsertSection = useCanvasStore((s) => s.upsertSection);
  const addVersion    = useVersionStore((s) => s.addVersion);
  const autosaveTimer = useRef(null);
  const lastSaved     = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: true }),
      Highlight.configure({ multicolor: true }),
      Strike,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'doc-editor-content',
        'aria-label': `Editor for ${section.name}`,
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      upsertSection({ name: section.name, content: json });

      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(async () => {
        const serialized = JSON.stringify(json);
        if (serialized === lastSaved.current) return;
        try {
          await canvasApi.exportSection(
            section.id ?? section.name,
            section.name,
            JSON.stringify(json),
            'json'
          );
        } catch { /* silent */ }
        addVersion(companyId, section.name, {
          id: crypto.randomUUID(),
          sectionName: section.name,
          label: 'Auto-save',
          timestamp: new Date().toISOString(),
          source: 'manual_save',
          content: json,
          authorLabel: 'User',
        });
        lastSaved.current = serialized;
        // Fire autosave toast
        onAutosave?.(section.name);
      }, 2000);
    },
  });

  // Register in editorRefs
  useEffect(() => {
    if (editor && editorRefs) {
      editorRefs.current[section.name] = editor;
    }
    return () => { if (editorRefs) delete editorRefs.current[section.name]; };
  }, [editor, section.name, editorRefs]);

  // Load initial content
  useEffect(() => {
    if (!editor) return;
    let content;
    if (section.content)          content = section.content;
    else if (section.draft_text)  content = markdownToTipTap(section.draft_text);
    else if (section.markdown)    content = markdownToTipTap(section.markdown);
    else                          content = getPlaceholderContent(section.name ?? '');
    editor.commands.setContent(content, false);
    lastSaved.current = JSON.stringify(content);
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); }, []);

  const statusDot  = getSectionStatusDot(section);
  const num        = String(index + 1).padStart(2, '0');
  const marginNote = getMarginComment(section.name);
  const isEmpty    = !section.content && !section.draft_text && !section.markdown;
  const hasContent = !isEmpty;

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await canvasApi.generateSection(companyId, section.name);
      if (res.draft_text && editorRefs?.current?.[section.name]) {
        const content = markdownToTipTap(res.draft_text);
        editorRefs.current[section.name].commands.setContent(content, false);
        upsertSection({ name: section.name, draft_text: res.draft_text, content });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="doc-section"
      id={`section-${slugify(section.name)}`}
      data-section-name={section.name}
    >
      {/* Margin comment (req 5) */}
      {marginNote && (
        <div className="doc-margin-comment" aria-label={`Reviewer comment: ${marginNote.text}`}>
          <span className="doc-margin-comment__author">{marginNote.author}</span>
          <span className="doc-margin-comment__text">{marginNote.text}</span>
        </div>
      )}

      {/* Section heading strip — includes evidence badges for AI-authored sections */}
      <div className="doc-section__header">
        <span className="doc-section__num" aria-hidden="true">§ {num}</span>
        <span
          className="doc-section__dot"
          style={{ background: statusDot.color }}
          title={statusDot.label}
          aria-label={`Status: ${statusDot.label}`}
        />
        <span className="doc-section__title" style={{ flexGrow: 1 }}>{section.name}</span>

        {/* Inline evidence badges — only when content exists */}
        <EvidenceBadges sectionName={section.name} hasContent={hasContent} />

        {/* Generate Button (Floating Right) */}
        <button
          className="btn btn-outline btn-sm"
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{
            marginLeft: 'auto',
            padding: '4px 10px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--glass-bg)',
            borderColor: 'var(--glass-border)',
            color: 'var(--text-secondary)'
          }}
        >
          {isGenerating ? <span className="spin">⟳</span> : <span>✦</span>}
          {isGenerating ? "Generating..." : "Generate Draft"}
        </button>
      </div>

      {/* Editor body — natural flow, no fixed height */}
      <div className="doc-section__body">
        <EditorContent editor={editor} />

        {/* AI-first empty state (req 8) — shown before user has added content */}
        {isEmpty && editor && (
          <div className="doc-section__empty-state" aria-hidden="true">
            <div className="doc-section__empty-icon">✦</div>
            <div className="doc-section__empty-heading">Start with AI</div>
            <div className="doc-section__empty-hint">
              Press <kbd>⌘K</kbd> to open AI, or click the <strong>✦ AI</strong> button in the toolbar to generate this section.
            </div>
          </div>
        )}
      </div>

      {/* Page number (req 2) */}
      <PageNumber index={index} />

      {/* Inline AI selection popup — ChatGPT Canvas style */}
      {editor && (
        <SelectionPopup
          editor={editor}
          companyId={companyId}
          sectionName={section.name}
          section={section}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocumentCanvas
// ---------------------------------------------------------------------------
export default function DocumentCanvas({ companyId, editorRefs, containerRef, onAutosave }) {
  const sections            = useCanvasStore((s) => s.sections);
  const setActiveSectionIdx = useCanvasStore((s) => s.setActiveSectionIdx);
  const upsertSection       = useCanvasStore((s) => s.upsertSection);

  // Listen for Chatbot edit events
  useEffect(() => {
    const handleAiEdited = (e) => {
      const { sectionName, newText } = e.detail;
      if (editorRefs?.current?.[sectionName]) {
        const content = markdownToTipTap(newText);
        editorRefs.current[sectionName].commands.setContent(content, false);
        upsertSection({ name: sectionName, draft_text: newText, content });
      }
    };
    window.addEventListener('ai-section-edited', handleAiEdited);
    return () => window.removeEventListener('ai-section-edited', handleAiEdited);
  }, [editorRefs, upsertSection]);

  // Track which section is centred in the viewport
  useEffect(() => {
    const container = containerRef?.current;
    if (!container || sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the largest intersection ratio
        let best = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!best || entry.intersectionRatio > best.intersectionRatio) {
              best = entry;
            }
          }
        }
        if (best) {
          const name = best.target.dataset.sectionName;
          const idx  = sections.findIndex((s) => s.name === name);
          if (idx !== -1) setActiveSectionIdx(idx);
        }
      },
      {
        root: container,
        rootMargin: '-20% 0px -40% 0px',
        threshold: [0, 0.1, 0.25, 0.5],
      }
    );

    const nodes = container.querySelectorAll('[data-section-name]');
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [sections, containerRef, setActiveSectionIdx]);

  return (
    <div className="doc-workspace" ref={containerRef}>
      {/* Single continuous A4 paper — all sections flow inside it */}
      <div className="doc-paper" role="main" aria-label="DRHP Document">
        {/* Draft watermark (req 2) */}
        <div className="doc-watermark" aria-hidden="true">DRAFT</div>

        {/* Cover block — top of page 1 */}
        <div className="doc-paper__titleblock">
          <div className="doc-paper__company-label">Draft Red Herring Prospectus</div>
          <div className="doc-paper__company-name">Nirmaan Technologies Limited</div>
          <div className="doc-paper__meta">
            SEBI ICDR Regulations, 2018 · SME IPO · BSE SME Platform
          </div>
          <div className="doc-paper__meta" style={{ marginTop: 6, fontSize: '8pt' }}>
            BRLM: IIFL Securities Limited &nbsp;|&nbsp; Registrar: Link Intime India Pvt. Ltd.
          </div>
        </div>

        {/* Sections — rendered sequentially with page-break visuals between them */}
        {sections.map((section, idx) => (
          <SectionEditor
            key={section.name}
            section={section}
            index={idx}
            companyId={companyId}
            editorRefs={editorRefs}
            onAutosave={onAutosave}
          />
        ))}

        {/* End of document */}
        <div className="doc-paper__end" aria-hidden="true">
          — End of Draft Red Herring Prospectus —
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getSectionStatusDot(section) {
  if (section.locked)                                           return { color: '#10b981', label: 'Complete' };
  const has = Boolean(section.content || section.draft_text || section.markdown);
  if (has && (section.score ?? 0) >= 80)                       return { color: '#a78bfa', label: 'AI Generated' };
  if (has && (section.score ?? 0) >= 50)                       return { color: '#f59e0b', label: 'Draft' };
  if (has)                                                      return { color: '#f59e0b', label: 'In Progress' };
  return { color: '#c4ccd8', label: 'Pending' };
}
