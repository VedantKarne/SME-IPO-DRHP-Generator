/**
 * PrintPreview.jsx
 *
 * Renders a full-viewport print-preview overlay showing all DRHP sections as
 * individual A4 pages. No sidebar, toolbar, or copilot chrome — just the
 * document.
 *
 * Features:
 *  • Escape key closes the overlay
 *  • "Print" button triggers window.print()
 *  • Each section renders as a separate A4 page card with a page number footer
 *  • Smooth 180ms fade-in animation
 *
 * Props:
 *   sections  {Section[]}  – from canvasStore
 *   onClose   {fn}         – called when overlay should close
 */

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { markdownToTipTap } from '../editor/markdownToTipTap.js';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// ReadOnlyPage — renders one section as a read-only TipTap instance
// ---------------------------------------------------------------------------
function ReadOnlyPage({ section, pageNumber }) {
  const content = section.content
    || (section.draft_text ? markdownToTipTap(section.draft_text) : null)
    || (section.markdown   ? markdownToTipTap(section.markdown)   : null)
    || null;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content ?? { type: 'doc', content: [] },
    editable: false,
    editorProps: {
      attributes: {
        class: 'doc-editor-content',
        'aria-label': `Print preview: ${section.name}`,
        role: 'article',
      },
    },
  });

  const num = String(pageNumber).padStart(2, '0');

  return (
    <div className="print-preview-page" aria-label={`Page ${pageNumber}: ${section.name}`}>
      {/* Section header */}
      <div className="doc-section__header" style={{ marginBottom: 18 }}>
        <span className="doc-section__num" aria-hidden="true">§ {num}</span>
        <span className="doc-section__title">{section.name}</span>
      </div>

      {/* Read-only TipTap content */}
      {editor && <EditorContent editor={editor} />}

      {/* Page number footer */}
      <div className="print-preview-page-num" aria-hidden="true">
        — {pageNumber + 1} —
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PrintPreview
// ---------------------------------------------------------------------------
export default function PrintPreview({ sections, onClose }) {
  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent body scroll while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const overlay = (
    <div
      className="print-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Print Preview"
    >
      {/* Top bar */}
      <div className="print-preview-bar">
        <span className="print-preview-bar__title">
          Print Preview — Nirmaan Technologies Limited · DRHP
        </span>
        <span className="print-preview-bar__hint">
          Press <kbd style={{ padding: '1px 5px', border: '1px solid #374151', borderRadius: 3, fontSize: '0.68rem', background: '#111827' }}>Esc</kbd> to close
        </span>
        <div className="print-preview-bar__actions">
          <button
            type="button"
            className="print-preview-btn"
            onClick={() => window.print()}
            aria-label="Print document"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Print
          </button>
          <button
            type="button"
            className="print-preview-btn print-preview-btn--close"
            onClick={onClose}
            aria-label="Close print preview"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
            Close
          </button>
        </div>
      </div>

      {/* Scrollable A4 pages */}
      <div className="print-preview-scroll">
        {sections.map((section, idx) => (
          <ReadOnlyPage
            key={section.name}
            section={section}
            pageNumber={idx + 1}
          />
        ))}
      </div>
    </div>
  );

  // Render as a portal so it sits above all canvas chrome
  return createPortal(overlay, document.body);
}
