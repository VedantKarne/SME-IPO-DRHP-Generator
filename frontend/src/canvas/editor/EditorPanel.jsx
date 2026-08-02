import { useEffect, useRef, useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import Strike from "@tiptap/extension-strike";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import useCanvasStore from "../services/canvasStore.js";
import useVersionStore from "../versions/versionStore.js";
import { markdownToTipTap } from "./markdownToTipTap.js";
import * as canvasApi from "../services/canvasApi.js";
import SelectionPopup from "./SelectionPopup.jsx";
import AIToolbar from "./AIToolbar.jsx";
import WholeDocPrompt from "../prompt/WholeDocPrompt.jsx";
import VersionHistoryPanel from "../versions/VersionHistoryPanel.jsx";
import ExportDropdown from "./ExportDropdown.jsx";

// ---------------------------------------------------------------------------
// P1 — Realistic placeholder content per section name
// ---------------------------------------------------------------------------
function getPlaceholderContent(sectionName) {
  const name = sectionName.toLowerCase();

  if (name.includes("business overview") || name.includes("about the company") || name.includes("our business")) {
    return markdownToTipTap(`# Business Overview

**Nirmaan Technologies Limited** is an AI-powered IPO automation company engaged in the development and deployment of regulatory-grade document intelligence platforms for capital markets.

| Metric | FY24 |
|---|---|
| Revenue | ₹48.2 Cr |
| Employees | 124 |
| Headquarters | Pune, Maharashtra |
| Founded | 2018 |

The Company's flagship product, DRHPGen, automates the preparation and compliance validation of Draft Red Herring Prospectus (DRHP) documents for SME IPOs under SEBI ICDR Regulations 2018.

> *Click anywhere to edit this section...*
`);
  }

  if (name.includes("risk factor")) {
    return markdownToTipTap(`# Risk Factors

**Internal Risks**

1. **Customer concentration risk** — The top 3 customers account for approximately 42% of total revenue for FY24. Loss of any key customer could materially impact revenues.

2. **Technology obsolescence** — Rapid changes in AI technology may render current products uncompetitive. Significant R&D investments are required to stay ahead.

3. **Key personnel dependence** — The Company's growth is dependent on its founding team and certain Key Managerial Personnel.

**External / Regulatory Risks**

4. **SEBI regulatory changes** — Any amendments to SEBI ICDR Regulations may require significant rework of the Company's compliance engine.

5. **Market competition** — The market for AI-powered legal-tech tools is evolving and increasingly competitive.

> *⚠ AI Note: Customer concentration risk should be quantified with FY24 revenue figures.*
`);
  }

  if (name.includes("capital structure")) {
    return markdownToTipTap(`# Capital Structure

## Equity Share Capital

| Particulars | No. of Shares | Face Value (₹) | Amount (₹) |
|---|---|---|---|
| Authorised Capital | 2,00,00,000 | 10 | 20,00,00,000 |
| Issued & Paid-up (Pre-IPO) | 1,20,00,000 | 10 | 12,00,00,000 |
| Fresh Issue (IPO) | 40,00,000 | 10 | 4,00,00,000 |
| Post-IPO Paid-up | 1,60,00,000 | 10 | 16,00,00,000 |

## Promoter Shareholding

Pre-IPO promoter holding: **67.5%**
Post-IPO promoter holding: **50.6%** (Minimum promoter contribution maintained per Reg 236)

[Reg 233 | SEBI ICDR Regulations 2018]
`);
  }

  if (name.includes("financial") || name.includes("md&a") || name.includes("management discussion")) {
    return markdownToTipTap(`# Financial Statements

## Revenue Summary

| Year | Revenue (₹ Cr) | EBITDA (₹ Cr) | PAT (₹ Cr) |
|---|---|---|---|
| FY22 | 28.4 | 5.2 | 3.1 |
| FY23 | 37.9 | 7.8 | 5.4 |
| FY24 | 48.2 | 10.6 | 7.3 |

**Revenue CAGR (FY22–FY24): 30.3%**

## Key Ratios

- Return on Equity (FY24): **18.2%**
- Debt-to-Equity (FY24): **0.4x**
- Current Ratio (FY24): **2.1x**

> *AI Suggestion: Cross-verify these figures with the Audited Financial Statements (Annual Report Page 17).*
`);
  }

  if (name.includes("management") || name.includes("board") || name.includes("director")) {
    return markdownToTipTap(`# Management & Board of Directors

## Board Composition

| Name | Designation | Category |
|---|---|---|
| Mr. Arjun Mehta | Managing Director & CEO | Executive |
| Ms. Priya Sharma | Whole-time Director & CFO | Executive |
| Mr. Rajiv Bose | Independent Director | Non-Executive Independent |
| Ms. Kavita Iyer | Independent Director | Non-Executive Independent |

## Key Qualifications

**Mr. Arjun Mehta** — B.Tech (IIT Bombay), MBA (IIM Ahmedabad). Over 18 years of experience in fintech and capital markets technology.

**Ms. Priya Sharma** — CA, CFA. Former VP Finance at HDFC Securities. 14 years in financial reporting and IPO advisory.
`);
  }

  if (name.includes("promoter")) {
    return markdownToTipTap(`# Our Promoters & Promoter Group

## Promoter Details

**Mr. Arjun Mehta** (Founder & Promoter) holds **45.2%** of the pre-IPO equity share capital.

- Date of Birth: 12th March 1982
- Educational Qualification: B.Tech (IIT Bombay), MBA (IIM Ahmedabad)
- PAN: AABPM1234F
- No criminal or civil proceedings pending as on date of filing

**Ms. Priya Sharma** (Co-Founder & Promoter) holds **22.3%** of the pre-IPO equity share capital.

> *⚠ AI Note: SEBI ICDR Reg 236 requires disclosure of promoter background for 5 years preceding the offer.*
`);
  }

  // Default: generic section placeholder
  return markdownToTipTap(`# ${sectionName}

This section is pending content. Use the AI Copilot to generate a draft, or begin typing to add content manually.

Click anywhere to start editing, or use the **✦ Generate Draft** button in the toolbar above.

> *Tip: Select any text and use the floating AI popup to rewrite, expand, or improve it.*
`);
}

// ---------------------------------------------------------------------------
// EditorPanel component
// ---------------------------------------------------------------------------

/**
 * Props:
 *   companyId {string} — passed down from CanvasRoot; forwarded to SelectionPopup
 *                        for AI rewrite API calls. Defaults to empty string so the
 *                        component renders safely in isolation / Storybook.
 */
export default function EditorPanel({ companyId = '' }) {
  const sections = useCanvasStore((s) => s.sections);
  const activeSectionIdx = useCanvasStore((s) => s.activeSectionIdx);
  const upsertSection = useCanvasStore((s) => s.upsertSection);
  const addVersion = useVersionStore((s) => s.addVersion);

  const autosaveTimer = useRef(null);
  const lastSavedContent = useRef(null);
  const isSwitchingSection = useRef(false);

  // Version history panel open/close toggle
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);

  const activeSection = sections[activeSectionIdx] ?? null;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Strike,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "editor-content",
        "aria-label": "Document editor",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (isSwitchingSection.current) return;

      const json = ed.getJSON();
      if (activeSection) {
        upsertSection({ name: activeSection.name, content: json });
      }

      // Debounce autosave
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        performSave(ed.getJSON(), activeSection);
      }, 2000);
    },
  });

  // Autosave implementation
  const performSave = useCallback(
    async (jsonContent, section) => {
      if (!section || !jsonContent) return;

      const serialized = JSON.stringify(jsonContent);
      if (serialized === lastSavedContent.current) return;

      try {
        await canvasApi.exportSection(section.id ?? section.name, section.name, JSON.stringify(jsonContent), 'json');
      } catch {
        // autosave failure is silent in offline mode
      }

      // Always snapshot a version on autosave
      addVersion(companyId, section.name, {
        id: crypto.randomUUID(),
        sectionName: section.name,
        label: 'Auto-save',
        timestamp: new Date().toISOString(),
        source: 'manual_save',
        content: jsonContent,
        authorLabel: 'User',
      });

      lastSavedContent.current = serialized;
    },
    [addVersion]
  );

  // Load section content when activeSectionIdx changes
  useEffect(() => {
    if (!editor || !activeSection) return;

    isSwitchingSection.current = true;

    if (autosaveTimer.current) {
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }

    let content;

    if (activeSection.content) {
      content = activeSection.content;
    } else if (activeSection.draft_text) {
      content = markdownToTipTap(activeSection.draft_text);
    } else if (activeSection.markdown) {
      content = markdownToTipTap(activeSection.markdown);
    } else {
      // P1 — Show realistic placeholder document instead of blank canvas
      content = getPlaceholderContent(activeSection.name ?? activeSection.title ?? "");
    }

    editor.commands.setContent(content, false);
    lastSavedContent.current = JSON.stringify(content);

    requestAnimationFrame(() => {
      isSwitchingSection.current = false;
    });
  }, [activeSectionIdx, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  if (!activeSection) {
    return (
      <div className="editor-panel editor-panel--empty" role="main">
        <div className="editor-empty-state-hero">
          <div className="editor-empty-hero__glow" aria-hidden="true" />
          <div className="editor-empty-hero__icon" aria-hidden="true">✦</div>
          <h2 className="editor-empty-hero__title">Start with AI</h2>
          <p className="editor-empty-hero__subtitle">
            Select a section from the sidebar, or choose a quick action to begin.
          </p>
          <div className="editor-empty-hero__actions">
            <button type="button" className="editor-empty-action editor-empty-action--primary">
              <span>⚡</span> Generate Draft
            </button>
            <button type="button" className="editor-empty-action">
              <span>📄</span> Upload Annual Report
            </button>
            <button type="button" className="editor-empty-action">
              <span>📊</span> Import Financial Statements
            </button>
            <button type="button" className="editor-empty-action">
              <span>↩</span> Continue Previous Draft
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-panel" role="main">
      {/* ── Section heading + action bar ─────────────────────── */}
      <div className="editor-header">
        <div className="editor-header__row">
          <h2 className="editor-section-title">
            {activeSection.title ?? activeSection.name ?? "Untitled Section"}
          </h2>

          <div className="editor-header__actions">
            {/* Version history toggle */}
            <button
              type="button"
              className={[
                "btn btn-sm btn-secondary",
                versionPanelOpen ? "btn-secondary--active" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => setVersionPanelOpen((v) => !v)}
              aria-pressed={versionPanelOpen}
              aria-label="Toggle version history"
              title="Version History"
            >
              📋 History
            </button>

            {/* P8: Export dropdown */}
            <ExportDropdown
              editor={editor}
              companyId={companyId}
              sectionName={activeSection.name}
            />
          </div>
        </div>
      </div>

      {/* ── Layout: editor + optional version panel side-by-side ── */}
      <div className="editor-body-row">
        {/* Left: toolbar + editor + whole-doc prompt */}
        <div className="editor-main-col">
          {/* Formatting toolbar */}
          <AIToolbar editor={editor} companyId={companyId} sectionName={activeSection?.name ?? ""} />

          {/* TipTap editor surface */}
          <EditorContent editor={editor} className="editor-surface" />

          {/* Whole-document AI prompt bar */}
          <WholeDocPrompt
            editor={editor}
            companyId={companyId}
            sectionName={activeSection.name}
          />
        </div>

        {/* Right: version history panel (collapsible) */}
        {versionPanelOpen && (
          <div className="editor-version-col">
            <VersionHistoryPanel
              editor={editor}
              activeSectionName={activeSection.name}
            />
          </div>
        )}
      </div>

      {/*
        SelectionPopup — floats above the editor surface when text is selected.
        Receives the live editor instance so it can:
          • Read the current selection via editor.state.selection
          • Subscribe to selectionUpdate events
          • Apply the accepted replacement via editor.chain().deleteSelection().insertContent()
          • Call addVersion after acceptance (done internally in SelectionPopup)
      */}
      <SelectionPopup
        editor={editor}
        companyId={companyId}
        sectionName={activeSection.name}
        section={activeSection}
      />
    </div>
  );
}
