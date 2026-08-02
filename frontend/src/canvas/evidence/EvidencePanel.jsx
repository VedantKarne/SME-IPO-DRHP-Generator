/**
 * EvidencePanel.jsx — Regulatory citation cards for the active DRHP section.
 *
 * Fetches citation data via TanStack Query; refetches automatically when
 * `sectionName` changes because it is part of the query key.
 *
 * On citation card click:
 *   1. Clears any existing TipTap highlights.
 *   2. Scans the editor document for text nodes matching "[Reg X | ICDR...]"
 *      and applies a yellow highlight at each match position.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */

import { useQuery } from '@tanstack/react-query';
import * as canvasApi from '../services/canvasApi.js';

// ---------------------------------------------------------------------------
// CitationCard
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {{ doc: string, reg: string, chapter: string, page: string, confidence: number }} props.citation
 * @param {Function} props.onClick
 */
function CitationCard({ citation, onClick }) {
  const { doc, reg, chapter, page, confidence } = citation;
  const isVerified = confidence >= 90;

  return (
    <button
      type="button"
      className="evidence-card"
      onClick={onClick}
      aria-label={`Citation: Regulation ${reg} — ${doc}. Click to highlight in editor.`}
    >
      {/* Source document */}
      <p className="evidence-card__doc">{doc}</p>

      {/* Regulation number */}
      <p className="evidence-card__reg">
        <span className="evidence-card__reg-label">Reg</span>{' '}
        <strong className="evidence-card__reg-number">{reg}</strong>
      </p>

      {/* Chapter name */}
      <p className="evidence-card__chapter">{chapter}</p>

      {/* Page reference */}
      <p className="evidence-card__page">{page}</p>

      {/* Confidence score */}
      <p className="evidence-card__confidence">
        Confidence:{' '}
        <span
          className={[
            'evidence-card__confidence-value',
            isVerified ? 'evidence-card__confidence-value--high' : '',
          ].join(' ')}
        >
          {confidence}%
        </span>
      </p>

      {/* Verified badge — shown only when confidence >= 90 */}
      {isVerified && (
        <span className="badge badge-success evidence-card__badge" role="status">
          ✅ Verified against regulatory corpus
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Highlight helper
// ---------------------------------------------------------------------------

/**
 * Find all text positions in the TipTap document that contain the pattern
 * `[Reg X | ICDR...]` for the given regulation number, then apply a yellow
 * highlight to each match.
 *
 * The function works at the ProseMirror transaction level: it iterates over
 * every text node in the document, searches for the pattern, and applies the
 * Highlight mark to each matching range.
 *
 * @param {import('@tiptap/react').Editor} editor
 * @param {string} reg  The regulation number string, e.g. "229"
 */
function highlightRegSpans(editor, reg) {
  // Step 1: clear all existing highlights
  editor.chain().focus().unsetHighlight().run();

  const { state, view } = editor;
  const { doc } = state;

  // Build a regex that matches [Reg <number> | ICDR...] — case-insensitive
  // The pattern matches e.g. "[Reg 229 | ICDR...]" or "[Reg229|ICDR Regulations]"
  const pattern = new RegExp(
    `\\[\\s*Reg\\s*${reg}\\s*\\|[^\\]]*\\]`,
    'gi'
  );

  const { tr } = state;
  const highlightMark = state.schema.marks.highlight;

  // Only proceed if the Highlight extension is registered
  if (!highlightMark) return;

  const markType = highlightMark;
  const markAttrs = { color: '#fef08a' };

  doc.descendants((node, pos) => {
    if (!node.isText) return;

    const text = node.text;
    let match;

    // Reset lastIndex for global regex on each node
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      tr.addMark(from, to, markType.create(markAttrs));
    }
  });

  if (tr.docChanged || tr.steps.length > 0) {
    view.dispatch(tr);
  }
}

// ---------------------------------------------------------------------------
// EvidencePanel
// ---------------------------------------------------------------------------

/**
 * @param {object} props
 * @param {import('@tiptap/react').Editor | null} props.editor
 * @param {string} props.companyId
 * @param {string} props.sectionName
 */
export default function EvidencePanel({ editor, companyId, sectionName }) {
  const {
    data: citations,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['evidence', companyId, sectionName],
    queryFn: () => canvasApi.getEvidence(companyId, sectionName),
    // Keep previous data while the new section's data loads to avoid flicker
    placeholderData: (previousData) => previousData,
    staleTime: 30_000, // 30 s — evidence doesn't change frequently
  });

  // ── Card click handler ──────────────────────────────────────────────────

  function handleCardClick(reg) {
    if (!editor || editor.isDestroyed) return;
    highlightRegSpans(editor, reg);
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <section className="evidence-panel" aria-label="Regulatory evidence citations">
      {/* Header */}
      <div className="evidence-panel__header">
        <h3 className="evidence-panel__title">
          <span aria-hidden="true">📋</span> Regulatory Evidence
        </h3>
        {Array.isArray(citations) && citations.length > 0 && (
          <span className="badge badge-accent evidence-panel__count" aria-label={`${citations.length} citations`}>
            {citations.length}
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="evidence-panel__loading" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <span>Loading citations…</span>
        </div>
      )}

      {/* Error state — silently falls back to empty (mock data covers this path) */}
      {isError && !isLoading && Array.isArray(citations) && citations.length === 0 && (
        <p className="evidence-panel__empty">No citations found for this section.</p>
      )}

      {/* Empty state */}
      {!isLoading && !isError && Array.isArray(citations) && citations.length === 0 && (
        <p className="evidence-panel__empty">No citations found for this section.</p>
      )}

      {/* Citation cards */}
      {!isLoading && Array.isArray(citations) && citations.length > 0 && (
        <ul className="evidence-panel__list" aria-label="Citation list">
          {citations.map((citation) => (
            <li key={`${citation.reg}-${citation.doc}`} className="evidence-panel__item">
              <CitationCard
                citation={citation}
                onClick={() => handleCardClick(citation.reg)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
