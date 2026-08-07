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
import { Loader2, Sparkles, AlertTriangle } from 'lucide-react';
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
// Evidence badges — rendered from the section's REAL supporting_clause_ids,
// which the backend populates from actual retrieval hits (see
// GET /api/sections/{company_id} -> supporting_clause_ids).
//
// These were previously drawn from a hardcoded section->regulation map, which
// displayed authoritative-looking citations ("Reg 237", "Sch VIII") next to
// content that had never been checked against any regulation. If retrieval
// produced no clauses, the honest answer is to show no badges.
// ---------------------------------------------------------------------------
function EvidenceBadges({ clauseIds }) {
  if (!clauseIds?.length) return null;

  return (
    <span className="ai-evidence-badges" role="list" aria-label="Source references">
      {clauseIds.map((id) => (
        <span
          key={id}
          className="ai-evidence-badge ai-evidence-badge--reg"
          role="listitem"
          title={`Retrieved regulatory clause: ${id}`}
        >
          <span className="ai-evidence-badge__icon" aria-hidden="true">§</span>
          {id}
        </span>
      ))}
    </span>
  );
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
function SectionEditor({ section, index, companyId, editorRefs, onAutosave, showToast }) {
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

        // Durable persistence is the version write below; POST
        // /api/export/section/json is currently a server-side no-op that
        // returns success without storing anything (see export_router.py).
        // Treat a version-write failure as a real autosave failure so the
        // user is not told their work was saved when it was not.
        try {
          await addVersion(companyId, section.name, {
            id: crypto.randomUUID(),
            sectionName: section.name,
            label: 'Auto-save',
            timestamp: new Date().toISOString(),
            source: 'manual_save',
            content: json,
            authorLabel: 'User',
          });
          lastSaved.current = serialized;
          onAutosave?.(section.name);
        } catch (e) {
          console.error('Autosave failed:', e);
          onAutosave?.(section.name, e);
        }
      }, 5000);
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
    // No content yet: leave the editor genuinely empty. The empty state below
    // invites the user to generate a draft. Pre-filling it with example prose
    // made an undrafted section look authored.
    else                          content = { type: 'doc', content: [{ type: 'paragraph' }] };
    editor.commands.setContent(content, false);
    lastSaved.current = JSON.stringify(content);
  }, [editor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); }, []);

  const statusDot  = getSectionStatusDot(section);
  const num        = String(index + 1).padStart(2, '0');
  const isEmpty    = !section.content && !section.draft_text && !section.markdown;

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await canvasApi.generateSection(companyId, section.name);
      if (res.draft_text && editorRefs?.current?.[section.name]) {
        const content = markdownToTipTap(res.draft_text);
        editorRefs.current[section.name].commands.setContent(content, false);
        upsertSection({
          name: section.name,
          draft_text: res.draft_text,
          content,
          score: res.completeness_score,
          supporting_clause_ids: res.supporting_clause_ids ?? section.supporting_clause_ids,
        });
      }
    } catch (e) {
      // Surface the failure. Previously this swallowed the error and the API
      // layer returned canned prose, so a failed generation looked successful.
      console.error('Generate failed:', e);
      setGenerateError(e?.message ?? 'Generation failed.');
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

        {/* Inline evidence badges — driven by real retrieved clause IDs */}
        <EvidenceBadges clauseIds={section.supporting_clause_ids} />

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
          {isGenerating ? <Loader2 size={13} strokeWidth={2} className="spin" /> : <Sparkles size={13} strokeWidth={1.5} />}
          {isGenerating ? "Generating..." : "Generate Draft"}
        </button>
      </div>

      {/* Generation failure — shown instead of silently substituting sample text */}
      {generateError && (
        <div className="doc-section__error" role="alert">
          <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />
          <span>{generateError}</span>
          <button
            type="button"
            className="doc-section__error-retry"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            Retry
          </button>
        </div>
      )}

      {/* Editor body — natural flow, no fixed height */}
      <div className="doc-section__body">
        <EditorContent editor={editor} />

        {/* AI-first empty state (req 8) — shown before user has added content */}
        {isEmpty && editor && (
          <div className="doc-section__empty-state" aria-hidden="true">
            <Sparkles size={22} strokeWidth={1.5} className="doc-section__empty-icon" />
            <div className="doc-section__empty-heading">Start with AI</div>
            <div className="doc-section__empty-hint">
              Press <kbd>⌘K</kbd> to open AI, or click the <strong>AI</strong> button in the toolbar to generate this section.
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
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocumentCanvas
// ---------------------------------------------------------------------------
export default function DocumentCanvas({ companyId, editorRefs, containerRef, onAutosave, showToast }) {
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
            showToast={showToast}
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
  if (section.locked)                                           return { color: 'var(--status-approved)', label: 'Complete' };
  const has = Boolean(section.content || section.draft_text || section.markdown);
  if (has)                                                      return { color: 'var(--status-draft)', label: 'Draft' };
  return { color: 'var(--status-pending)', label: 'Pending' };
}
