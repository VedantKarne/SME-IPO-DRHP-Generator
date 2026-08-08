/**
 * CopilotPanel.jsx
 *
 * Right-side "IPO COPILOT" panel matching the screenshot exactly:
 *
 *  ┌──────────────────────────────┐
 *  │ ✦ IPO COPILOT           «« │
 *  ├──────────────────────────────┤
 *  │ Editing                      │
 *  │ Cover Page & General Info  📝 │
 *  ├──────────────────────────────┤
 *  │ Suggestions | Evidence | Chat │
 *  ├──────────────────────────────┤
 *  │  ⚠ Suggestion card  › │
 *  │  ↗ Suggestion card  › │
 *  │  ✓ Suggestion card  › │
 *  ├──────────────────────────────┤
 *  │ Ask anything about section…  │
 *  │ [text input]            [→]  │
 *  │     Ctrl/⌘ K to open Copilot │
 *  └──────────────────────────────┘
 */

import { useState, useMemo } from 'react';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Loader2, FileText, ChevronsLeft } from 'lucide-react';
import AISideChat    from '../copilot/AISideChat.jsx';
import EvidencePanel from '../evidence/EvidencePanel.jsx';
import * as canvasApi from '../services/canvasApi.js';

// ---------------------------------------------------------------------------
// Per-section suggestion data
// ---------------------------------------------------------------------------
const SECTION_SUGGESTIONS = {
  'risk factor': [
    { id: 'rf1', severity: 'warning', title: 'Quantify customer concentration risk',   body: 'Add exact revenue % from top 3 customers (FY24: ~42%). Required under SEBI ICDR Reg 237.' },
    { id: 'rf2', severity: 'warning', title: 'Add cybersecurity / data-privacy risk',  body: 'As a SaaS platform handling financial data, add an IT Act 2000 risk paragraph.' },
    { id: 'rf3', severity: 'info',    title: 'Add regulatory-change risk paragraph',   body: 'Include forward-looking risk around SEBI ICDR amendments that could affect the product.' },
    { id: 'rf4', severity: 'success', title: 'Key-person risk disclosed',              body: 'Dependence on founders and KMP is adequately disclosed.' },
  ],
  'capital struct': [
    { id: 'cs1', severity: 'success', title: 'Promoter contribution satisfies Reg 236', body: 'Post-IPO holding of 50.6% meets minimum promoter contribution threshold.' },
    { id: 'cs2', severity: 'warning', title: 'Lock-in disclosure incomplete',           body: 'Add lock-in details for promoter shares acquired within 18 months of filing.' },
    { id: 'cs3', severity: 'info',    title: 'Add ESOP dilution table',                 body: 'If ESOP scheme exists, disclose outstanding options and post-issue EPS dilution.' },
  ],
  'financial': [
    { id: 'fi1', severity: 'success', title: '3 years of audited financials present',   body: 'FY22, FY23, FY24 data present — satisfies ICDR Schedule VIII.' },
    { id: 'fi2', severity: 'warning', title: 'EBITDA margin expansion unexplained',     body: 'Margin improved 18.3% → 22.0%. Add MD&A explanation per SEBI guidance note.' },
    { id: 'fi3', severity: 'info',    title: 'Add working capital analysis table',      body: 'Include debtors, creditors, inventory days for FY22–FY24 per Reg 238.' },
  ],
  'management': [
    { id: 'mg1', severity: 'warning', title: 'DIN numbers missing for all directors',  body: 'Mandatory under Companies Act Sec 164 and SEBI ICDR Reg 238.' },
    { id: 'mg2', severity: 'warning', title: 'KMP remuneration not disclosed',          body: 'Total FY24 remuneration for each KMP must be disclosed.' },
    { id: 'mg3', severity: 'success', title: 'Board independence requirement met',      body: '2/4 directors are independent — satisfies SEBI Listing Obligations for SMEs.' },
  ],
  'promoter': [
    { id: 'pr1', severity: 'warning', title: 'Promoter 5-year history incomplete',     body: 'Reg 236 requires 5 years of employment/business history — qualifications only are insufficient.' },
    { id: 'pr2', severity: 'warning', title: 'Promoter group entities not listed',     body: 'List all entities where promoters hold >20% directly or indirectly.' },
    { id: 'pr3', severity: 'info',    title: 'Add pledge disclosure',                  body: 'A nil-pledge statement is still required even if no shares are pledged.' },
  ],
  'related party': [
    { id: 'rp1', severity: 'warning', title: 'Promoter loan terms incomplete',         body: '₹4.2 Cr promoter loan — add interest rate, security, repayment schedule per Reg 238.' },
    { id: 'rp2', severity: 'info',    title: 'Separate KMP compensation sub-table needed', body: 'Salary / sitting fees to KMP should appear in a separate sub-table.' },
    { id: 'rp3', severity: 'success', title: '3-year RPT aggregate values present',    body: 'FY22–FY24 RPT summary tables are present and correctly categorised.' },
  ],
  'objects': [
    { id: 'ob1', severity: 'warning', title: 'GCP exceeds 25% cap',                   body: 'General Corporate Purposes cannot exceed 25% of issue size per Reg 232. Currently at 30%.' },
    { id: 'ob2', severity: 'info',    title: 'Add quarterly deployment schedule',      body: 'SEBI typically expects quarter-by-quarter fund utilisation for each object.' },
    { id: 'ob3', severity: 'success', title: 'Objects total matches fresh issue size', body: '₹40.00 Cr total matches fresh issue proceeds — verified.' },
  ],
  'default': [
    { id: 'd1', severity: 'warning', title: 'Add cross-references to related sections',    body: 'Internal cross-references (e.g. "See Financial Statements, Page XX") improve SEBI review.' },
    { id: 'd2', severity: 'info',    title: 'Investor-friendly language review suggested',  body: 'Clear, jargon-free disclosures perform better during SEBI examination.' },
    { id: 'd3', severity: 'success', title: 'Section structure follows ICDR Schedule VI',  body: 'Heading and sub-sections align with the prescribed DRHP format.' },
  ],
};

function getSuggestionsForSection(sectionName) {
  const key = (sectionName ?? '').toLowerCase();
  const match = Object.keys(SECTION_SUGGESTIONS).find(
    (k) => k !== 'default' && key.includes(k)
  );
  return SECTION_SUGGESTIONS[match ?? 'default'];
}

// Severity → icon + colors
const SEVERITY_META = {
  warning: { icon: AlertTriangle, color: 'var(--status-draft)',    bg: 'var(--status-draft-soft)',    border: 'rgba(148,111,46,0.3)' },
  info:    { icon: ArrowUpRight,  color: 'var(--ink-soft)',        bg: 'var(--paper-sunken)',          border: 'var(--rule)' },
  success: { icon: CheckCircle2,  color: 'var(--status-approved)', border: 'rgba(61,107,79,0.28)', bg: 'var(--status-approved-soft)' },
};

// ---------------------------------------------------------------------------
// SuggestionCard — matches screenshot layout with right-arrow chevron
// ---------------------------------------------------------------------------
function SuggestionCard({ item, onApply }) {
  const meta = SEVERITY_META[item.severity] ?? SEVERITY_META.info;
  const [isApplying, setIsApplying] = useState(false);

  const handleClick = async () => {
    if (isApplying || !onApply) return;
    setIsApplying(true);
    try {
      await onApply(item);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <button
      type="button"
      className="cp-suggestion-card"
      style={{ '--sug-color': meta.color, '--sug-bg': meta.bg, '--sug-border': meta.border }}
      aria-label={item.title}
      onClick={handleClick}
      disabled={isApplying}
    >
      <span className="cp-sug-icon" aria-hidden="true">
        <meta.icon size={14} strokeWidth={2} />
      </span>
      <div className="cp-sug-body">
        <div className="cp-sug-title">{item.title}</div>
        <div className="cp-sug-desc">{item.body}</div>
      </div>
      <span className="cp-sug-arrow" aria-hidden="true">
        {isApplying ? (
          <Loader2 size={14} strokeWidth={2} className="spin" color="var(--ink-soft)" />
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CopilotPanel
// ---------------------------------------------------------------------------
export default function CopilotPanel({
  isOpen,
  onClose,
  companyId,
  activeSectionName,
  activeEditor,
}) {
  const [tab, setTab] = useState('suggestions');
  const [applyError, setApplyError] = useState(null);
  const [chatInput, setChatInput] = useState('');

  const suggestions = useMemo(
    () => getSuggestionsForSection(activeSectionName),
    [activeSectionName]
  );

  const handleApplySuggestion = async (item) => {
    if (!activeSectionName) return;
    setApplyError(null);
    try {
      const prompt = `Apply this suggestion: ${item.title} - ${item.body}`;
      const response = await canvasApi.chatEditSection(companyId, activeSectionName, prompt);
      const event = new CustomEvent('ai-section-edited', {
        detail: { sectionName: activeSectionName, newText: response.new_draft_text }
      });
      window.dispatchEvent(event);
      // Optional: switch to chat tab to show confirmation, or just rely on canvas update
      setTab('chat');
    } catch (e) {
      // Do not fail silently — the user clicked Apply and nothing would happen.
      console.error('Apply suggestion failed:', e);
      setApplyError(e?.message ?? 'Could not apply that suggestion.');
    }
  };

  if (!isOpen) return null;

  // Short display name for the context box
  const displaySection = activeSectionName || 'Cover Page & General Information';

  return (
    <aside className="cp-panel" aria-label="IPO Copilot">

      {/* ── Header ── */}
      <div className="cp-header">
        <div className="cp-header__left">
          <img src="/nirmaan-mark.svg" alt="" className="cp-avatar" />
          <span className="cp-title">IPO COPILOT</span>
        </div>
        <button
          type="button"
          className="cp-close"
          onClick={onClose}
          aria-label="Collapse IPO Copilot"
          title="Collapse"
        >
          <ChevronsLeft size={14} strokeWidth={2} />
        </button>
      </div>

      {/* ── Editing context box ── */}
      <div className="cp-context-box" key={activeSectionName}>
        <div className="cp-context-box__label">Editing</div>
        <div className="cp-context-box__row">
          <span className="cp-context-box__name">{displaySection}</span>
          <span className="cp-context-box__icon" aria-hidden="true">
            <FileText size={22} strokeWidth={1.5} color="var(--ink-soft)" />
          </span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="cp-tabs" role="tablist">
        {[
          { id: 'suggestions', label: 'Suggestions' },
          { id: 'evidence',    label: 'Evidence'    },
          { id: 'chat',        label: 'Chat'        },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={`cp-tab${tab === id ? ' cp-tab--active' : ''}`}
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab body ── */}
      <div className="cp-body" role="tabpanel">

        {tab === 'suggestions' && (
          <div className="cp-suggestions-list" key={activeSectionName}>
            {applyError && (
              <div className="cp-error" role="alert">
                <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" /> {applyError}
              </div>
            )}
            {suggestions.map((item) => (
              <SuggestionCard key={item.id} item={item} onApply={handleApplySuggestion} />
            ))}
          </div>
        )}

        {tab === 'evidence' && (
          <div className="cp-evidence-wrap">
            <EvidencePanel
              editor={activeEditor}
              companyId={companyId}
              sectionName={activeSectionName}
            />
          </div>
        )}

        {tab === 'chat' && (
          <div className="cp-chat-wrap">
            <AISideChat companyId={companyId} sectionName={activeSectionName} />
          </div>
        )}

      </div>

      {/* ── Chat input footer (always visible, matches screenshot) ── */}
      {tab === 'suggestions' && (
        <div className="cp-chat-footer">
          <div className="cp-chat-footer__label">Ask anything about this section…</div>
          <div className="cp-chat-footer__row">
            <input
              type="text"
              className="cp-chat-footer__input"
              placeholder="Ask IPO Copilot…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setTab('chat'); setChatInput(''); } }}
              aria-label="Ask IPO Copilot"
            />
            <button
              type="button"
              className="cp-chat-footer__send"
              onClick={() => { setTab('chat'); setChatInput(''); }}
              aria-label="Send"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="cp-chat-footer__hint">
            <kbd>Ctrl</kbd> / <kbd>⌘</kbd> <kbd>K</kbd> to open Copilot
          </div>
        </div>
      )}

    </aside>
  );
}
