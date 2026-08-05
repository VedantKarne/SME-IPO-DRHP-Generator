/**
 * DocumentToolbar.jsx
 *
 * Formatting toolbar that exactly matches the design screenshot:
 *   [Undo][Redo] | [B][I][U] | [H1][H2] | [•][1.][table] [⌄]
 *   | [✦ Generate DRHP ▾] [✦ AI Assistant ▾] | [Print] [Export ▾] [•••]
 *
 * All AI actions remain under the "AI Assistant" dropdown (⌘K).
 * The copilot toggle is now in the AppBar — not the toolbar.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import * as canvasApi from '../services/canvasApi.js';
import useCanvasStore from '../services/canvasStore.js';
import useVersionStore from '../versions/versionStore.js';
import { markdownToTipTap } from '../editor/markdownToTipTap.js';
import ExportDropdown from '../editor/ExportDropdown.jsx';
import PrintPreview from './PrintPreview.jsx';

// ---------------------------------------------------------------------------
// AI actions list
// ---------------------------------------------------------------------------
const AI_ACTIONS = [
  { id: 'rewrite',           icon: '↺', label: 'Rewrite'           },
  { id: 'expand',            icon: '↕', label: 'Expand'            },
  { id: 'simplify',          icon: '◎', label: 'Simplify'          },
  { id: 'investor_friendly', icon: '◈', label: 'Investor Friendly' },
  { id: 'professional',      icon: '◇', label: 'Make Professional' },
  { id: 'cite',              icon: '§', label: 'Add Citations'     },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TBtn({ onClick, active, disabled, title, children }) {
  return (
    <button
      type="button"
      className={`dtb-btn${active ? ' dtb-btn--active' : ''}${disabled ? ' dtb-btn--disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active ?? undefined}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="dtb-sep" aria-hidden="true" />;
}

function AITypingIndicator({ label }) {
  return (
    <div className="dtb-typing-indicator" role="status" aria-label={`AI is working: ${label}`}>
      <span className="dtb-typing-indicator__label">{label}…</span>
      <span className="dtb-typing-indicator__dots" aria-hidden="true">
        <span /><span /><span />
      </span>
    </div>
  );
}

function flashSection(sectionName) {
  const node = document.querySelector(`[data-section-name="${CSS.escape(sectionName)}"]`);
  if (!node) return;
  node.classList.remove('doc-section--ai-flash');
  void node.offsetWidth; // eslint-disable-line no-void
  node.classList.add('doc-section--ai-flash');
  setTimeout(() => node.classList.remove('doc-section--ai-flash'), 400);
}

// ---------------------------------------------------------------------------
// DocumentToolbar
// ---------------------------------------------------------------------------
export default function DocumentToolbar({
  activeEditor,
  companyId,
  activeSectionName,
  copilotOpen,
  onToggleCopilot,
  showToast,
}) {
  const [aiOpen,        setAiOpen]        = useState(false);
  const [genOpen,       setGenOpen]       = useState(false);
  const [aiLoading,     setAiLoading]     = useState(null);
  const [promptText,    setPromptText]    = useState('');
  const [promptBusy,    setPromptBusy]    = useState(false);
  const [printPreviewOn, setPrintPreviewOn] = useState(false);

  const [moreFmtOpen,   setMoreFmtOpen]   = useState(false);
  const [overflowOpen,  setOverflowOpen]  = useState(false);

  const aiMenuRef      = useRef(null);
  const genMenuRef     = useRef(null);
  const moreFmtMenuRef = useRef(null);
  const overflowMenuRef= useRef(null);
  const promptRef      = useRef(null);

  const addVersion          = useVersionStore((s) => s.addVersion);
  const appendPromptHistory = useCanvasStore((s) => s.appendPromptHistory);
  const sections            = useCanvasStore((s) => s.sections);
  const ed = activeEditor;

  // ── Keyboard: ⌘K opens AI dropdown, Escape closes everything ──────────
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setAiOpen((v) => !v);
        setTimeout(() => promptRef.current?.focus(), 80);
      }
      if (e.key === 'Escape') {
        setAiOpen(false);
        setGenOpen(false);
        setPrintPreviewOn(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Close AI menu on outside click
  useEffect(() => {
    if (!aiOpen) return;
    function onDown(e) {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target)) setAiOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [aiOpen]);

  // Close Generate menu on outside click
  useEffect(() => {
    if (!genOpen) return;
    function onDown(e) {
      if (genMenuRef.current && !genMenuRef.current.contains(e.target)) setGenOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [genOpen]);

  // Close More Formatting menu on outside click
  useEffect(() => {
    if (!moreFmtOpen) return;
    function onDown(e) {
      if (moreFmtMenuRef.current && !moreFmtMenuRef.current.contains(e.target)) setMoreFmtOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [moreFmtOpen]);

  // Close Overflow menu on outside click
  useEffect(() => {
    if (!overflowOpen) return;
    function onDown(e) {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target)) setOverflowOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [overflowOpen]);

  // ── AI action handler ────────────────────────────────────────────────
  const handleAIAction = useCallback(async (actionId) => {
    if (!ed || aiLoading) return;
    setAiOpen(false);
    setAiLoading(actionId);
    const actionLabel = AI_ACTIONS.find((a) => a.id === actionId)?.label ?? actionId;
    try {
      const selectedText = ed.state.selection.empty
        ? ed.getText()
        : ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to, ' ');
      const result   = await canvasApi.rewrite(companyId, activeSectionName, selectedText, actionId);
      const proposed = result?.proposed_text;
      // Falling back to the original text here would report success for a
      // rewrite that actually produced nothing.
      if (!proposed) throw new Error('the AI returned an empty rewrite');
      if (!ed.state.selection.empty) {
        ed.chain().focus().deleteSelection().insertContent(proposed).run();
      } else {
        ed.commands.setContent(markdownToTipTap(proposed));
      }
      flashSection(activeSectionName);
      await addVersion(companyId, activeSectionName, {
        id: crypto.randomUUID(),
        sectionName: activeSectionName,
        label: `AI — ${actionLabel}`,
        timestamp: new Date().toISOString(),
        source: 'ai_rewrite',
        content: ed.getJSON(),
        authorLabel: 'AI',
      });
      showToast?.(`✦ ${actionLabel} applied`, 'success', 2800);
    } catch (err) {
      console.error(`${actionLabel} failed:`, err);
      showToast?.(`${actionLabel} failed — ${err.message}`, 'error', 5000);
    } finally {
      setAiLoading(null);
    }
  }, [ed, aiLoading, companyId, activeSectionName, addVersion, showToast]);

  // ── Whole-section prompt ─────────────────────────────────────────────
  const handlePromptSubmit = useCallback(async (e) => {
    e?.preventDefault();
    const trimmed = promptText.trim();
    if (!trimmed || !ed || promptBusy) return;
    setPromptBusy(true);
    try {
      const fullText = ed.getText();
      const result   = await canvasApi.prompt(companyId, activeSectionName, trimmed, fullText);
      const proposed = result?.proposed_text;
      if (!proposed) throw new Error('the AI returned an empty result');
      ed.commands.setContent(markdownToTipTap(proposed));
      flashSection(activeSectionName);
      await addVersion(companyId, activeSectionName, {
        id: crypto.randomUUID(),
        sectionName: activeSectionName,
        label: `AI Prompt — ${trimmed.slice(0, 40)}`,
        timestamp: new Date().toISOString(),
        source: 'ai_prompt',
        content: ed.getJSON(),
        authorLabel: 'AI',
      });
      appendPromptHistory({
        id: crypto.randomUUID(),
        promptText: trimmed,
        sectionName: activeSectionName,
        actionType: 'whole-doc',
        timestamp: new Date().toISOString(),
      });
      showToast?.('✦ Instruction applied', 'success', 2800);
      setPromptText('');
    } catch (err) {
      console.error('Whole-section prompt failed:', err);
      showToast?.(`Instruction failed — ${err.message}`, 'error', 5000);
    } finally {
      setPromptBusy(false);
      promptRef.current?.focus();
    }
  }, [promptText, ed, promptBusy, companyId, activeSectionName, addVersion, appendPromptHistory, showToast]);

  const aiLoadingLabel = aiLoading
    ? (AI_ACTIONS.find((a) => a.id === aiLoading)?.label ?? 'Working')
    : (promptBusy ? 'Applying' : null);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <>
      <div className="doc-toolbar" role="toolbar" aria-label="Document formatting toolbar">

        {/* ── Undo / Redo ── */}
        <TBtn onClick={() => ed?.chain().focus().undo().run()} disabled={!ed?.can().undo()} title="Undo (⌘Z)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polyline points="1 4 1 10 7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.51 15a9 9 0 1 0 .49-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </TBtn>
        <TBtn onClick={() => ed?.chain().focus().redo().run()} disabled={!ed?.can().redo()} title="Redo (⌘⇧Z)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polyline points="23 4 23 10 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.49 15a9 9 0 1 1-.49-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </TBtn>

        <Sep />

        {/* ── Bold / Italic / Underline ── */}
        <TBtn onClick={() => ed?.chain().focus().toggleBold().run()} active={ed?.isActive('bold')} title="Bold (⌘B)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 4h8a4 4 0 0 1 0 8H6V4zm0 8h9a4 4 0 0 1 0 8H6v-8z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </TBtn>
        <TBtn onClick={() => ed?.chain().focus().toggleItalic().run()} active={ed?.isActive('italic')} title="Italic (⌘I)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line x1="19" y1="4" x2="10" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="14" y1="20" x2="5" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="15" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </TBtn>
        <TBtn onClick={() => ed?.chain().focus().toggleUnderline().run()} active={ed?.isActive('underline')} title="Underline (⌘U)">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 4v6a6 6 0 0 0 12 0V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="4" y1="20" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </TBtn>

        <Sep />

        {/* ── H1 / H2 ── */}
        <TBtn onClick={() => ed?.chain().focus().toggleHeading({ level: 1 }).run()} active={ed?.isActive('heading', { level: 1 })} title="Heading 1">
          H<sub>1</sub>
        </TBtn>
        <TBtn onClick={() => ed?.chain().focus().toggleHeading({ level: 2 }).run()} active={ed?.isActive('heading', { level: 2 })} title="Heading 2">
          H<sub>2</sub>
        </TBtn>

        <Sep />

        {/* ── Bullet / Numbered list ── */}
        <TBtn onClick={() => ed?.chain().focus().toggleBulletList().run()} active={ed?.isActive('bulletList')} title="Bullet list">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="4" cy="6"  r="1.5" fill="currentColor"/>
            <circle cx="4" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="4" cy="18" r="1.5" fill="currentColor"/>
            <line x1="8" y1="6"  x2="20" y2="6"  stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="8" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="8" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </TBtn>
        <TBtn onClick={() => ed?.chain().focus().toggleOrderedList().run()} active={ed?.isActive('orderedList')} title="Numbered list">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line x1="10" y1="6"  x2="20" y2="6"  stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="10" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="10" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <text x="2" y="7.5"  fontSize="7" fill="currentColor">1</text>
            <text x="2" y="13.5" fontSize="7" fill="currentColor">2</text>
            <text x="2" y="19.5" fontSize="7" fill="currentColor">3</text>
          </svg>
        </TBtn>

        {/* ── Table ── */}
        <TBtn onClick={() => ed?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
            <line x1="3"  y1="9"  x2="21" y2="9"  stroke="currentColor" strokeWidth="2"/>
            <line x1="3"  y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="2"/>
            <line x1="9"  y1="3"  x2="9"  y2="21" stroke="currentColor" strokeWidth="2"/>
            <line x1="15" y1="3"  x2="15" y2="21" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </TBtn>

        {/* ── More formatting ▾ ── */}
        <div className="dtb-more-fmt-wrap" ref={moreFmtMenuRef} style={{ position: 'relative' }}>
          <TBtn title="More formatting options" onClick={() => setMoreFmtOpen(v => !v)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </TBtn>
          {moreFmtOpen && (
            <ul className="dtb-ai-menu" role="menu" aria-label="More formatting options">
              <li role="none">
                <button type="button" role="menuitem" className="dtb-ai-menu__item"
                  onClick={() => { ed?.chain().focus().toggleStrike().run(); setMoreFmtOpen(false); }}>
                  <span className="dtb-ai-menu__icon" aria-hidden="true">S</span>
                  Strikethrough
                </button>
              </li>
              <li role="none">
                <button type="button" role="menuitem" className="dtb-ai-menu__item"
                  onClick={() => { ed?.chain().focus().toggleBlockquote().run(); setMoreFmtOpen(false); }}>
                  <span className="dtb-ai-menu__icon" aria-hidden="true">❝</span>
                  Blockquote
                </button>
              </li>
              <li role="separator" className="dtb-ai-menu__sep" />
              <li role="none">
                <button type="button" role="menuitem" className="dtb-ai-menu__item"
                  onClick={() => { ed?.chain().focus().setTextAlign('left').run(); setMoreFmtOpen(false); }}>
                  <span className="dtb-ai-menu__icon" aria-hidden="true">⇤</span>
                  Align Left
                </button>
              </li>
              <li role="none">
                <button type="button" role="menuitem" className="dtb-ai-menu__item"
                  onClick={() => { ed?.chain().focus().setTextAlign('center').run(); setMoreFmtOpen(false); }}>
                  <span className="dtb-ai-menu__icon" aria-hidden="true">↔</span>
                  Align Center
                </button>
              </li>
              <li role="none">
                <button type="button" role="menuitem" className="dtb-ai-menu__item"
                  onClick={() => { ed?.chain().focus().setTextAlign('right').run(); setMoreFmtOpen(false); }}>
                  <span className="dtb-ai-menu__icon" aria-hidden="true">⇥</span>
                  Align Right
                </button>
              </li>
            </ul>
          )}
        </div>

        <Sep />

        {/* ══════════════════════════════════════════════════
            ✦ Generate DRHP  (solid purple primary button)
           ══════════════════════════════════════════════════ */}
        <div className="dtb-gen-wrap" ref={genMenuRef}>
          <button
            type="button"
            className="dtb-generate-btn"
            onClick={() => setGenOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={genOpen}
            title="Generate full DRHP from AI"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Generate DRHP
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {genOpen && (
            <ul className="dtb-ai-menu" role="menu" aria-label="Generate options">
              <li role="none">
                <button type="button" role="menuitem" className="dtb-ai-menu__item"
                  onClick={() => { handleAIAction('rewrite'); setGenOpen(false); }}>
                  <span className="dtb-ai-menu__icon" aria-hidden="true">✦</span>
                  Generate full DRHP draft
                </button>
              </li>
              <li role="none">
                <button type="button" role="menuitem" className="dtb-ai-menu__item"
                  onClick={() => { handleAIAction('professional'); setGenOpen(false); }}>
                  <span className="dtb-ai-menu__icon" aria-hidden="true">◇</span>
                  Generate this section only
                </button>
              </li>
              <li role="separator" className="dtb-ai-menu__sep" />
              <li role="none">
                <button type="button" role="menuitem" className="dtb-ai-menu__item"
                  onClick={() => { handleAIAction('cite'); setGenOpen(false); }}>
                  <span className="dtb-ai-menu__icon" aria-hidden="true">§</span>
                  Add SEBI citations
                </button>
              </li>
            </ul>
          )}
        </div>

        {/* ══════════════════════════════════════════════════
            ✦ AI Assistant  (outlined purple button)
           ══════════════════════════════════════════════════ */}
        <div className="dtb-ai-wrap" ref={aiMenuRef}>
          <button
            type="button"
            className={`dtb-ai-assistant-btn${(aiLoading || promptBusy) ? ' dtb-ai-assistant-btn--loading' : ''}`}
            onClick={() => setAiOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={aiOpen}
            disabled={!!(aiLoading || promptBusy)}
            title="AI Assistant (⌘K)"
          >
            {(aiLoading || promptBusy) ? (
              <span className="dtb-spinner" aria-hidden="true" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            AI Assistant
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {aiLoadingLabel && <AITypingIndicator label={aiLoadingLabel} />}

          {aiOpen && (
            <ul className="dtb-ai-menu" role="menu" aria-label="AI actions">
              {AI_ACTIONS.map(({ id, icon, label }) => (
                <li key={id} role="none">
                  <button type="button" role="menuitem" className="dtb-ai-menu__item"
                    onClick={() => handleAIAction(id)}>
                    <span className="dtb-ai-menu__icon" aria-hidden="true">{icon}</span>
                    {label}
                  </button>
                </li>
              ))}
              <li role="separator" className="dtb-ai-menu__sep" />
              <li role="none">
                <form className="dtb-ai-menu__prompt" onSubmit={handlePromptSubmit} aria-label="Custom AI instruction">
                  <input
                    ref={promptRef}
                    type="text"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Custom instruction…"
                    disabled={promptBusy}
                    className="dtb-ai-prompt-input"
                    aria-label="Custom AI instruction"
                    autoComplete="off"
                  />
                  <button type="submit" className="dtb-ai-prompt-send"
                    disabled={promptBusy || !promptText.trim()} aria-label="Apply">
                    {promptBusy ? <span className="dtb-spinner" aria-hidden="true" /> : '→'}
                  </button>
                </form>
              </li>
            </ul>
          )}
        </div>

        {/* Spacer pushes right-side controls to the right */}
        <div className="dtb-spacer" aria-hidden="true" />

        {/* ── Print ── */}
        <button
          type="button"
          className={`dtb-outline-btn${printPreviewOn ? ' dtb-outline-btn--active' : ''}`}
          onClick={() => setPrintPreviewOn((v) => !v)}
          aria-pressed={printPreviewOn}
          title="Print Preview"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polyline points="6 9 6 2 18 2 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
          </svg>
          Print
        </button>

        {/* ── Export ── */}
        <ExportDropdown
          editor={activeEditor}
          companyId={companyId}
          sectionName={activeSectionName}
        />

        {/* ── ··· overflow ── */}
        <div className="dtb-overflow-wrap" ref={overflowMenuRef} style={{ position: 'relative' }}>
          <button type="button" className="dtb-overflow-btn" title="More options" aria-label="More options" onClick={() => setOverflowOpen(v => !v)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="5"  cy="12" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="19" cy="12" r="1.5" fill="currentColor"/>
            </svg>
          </button>
          {overflowOpen && (
            <ul className="dtb-ai-menu" style={{ right: 0, left: 'auto' }} role="menu" aria-label="Overflow options">
              <li role="none">
                <button type="button" role="menuitem" className="dtb-ai-menu__item"
                  onClick={() => { ed?.chain().focus().unsetAllMarks().clearNodes().run(); setOverflowOpen(false); }}>
                  <span className="dtb-ai-menu__icon" aria-hidden="true">✕</span>
                  Clear Formatting
                </button>
              </li>
            </ul>
          )}
        </div>

      </div>

      {/* ── Print Preview overlay ── */}
      {printPreviewOn && (
        <PrintPreview sections={sections} onClose={() => setPrintPreviewOn(false)} />
      )}
    </>
  );
}
