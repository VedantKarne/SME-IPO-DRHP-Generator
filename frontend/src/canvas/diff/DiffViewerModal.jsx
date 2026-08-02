/**
 * DiffViewerModal.jsx
 *
 * Renders a modal overlay showing a unified diff between `original` and
 * `proposed` text using react-diff-view + unidiff, wrapped in a Framer
 * Motion entrance animation.
 *
 * Props:
 *   original    {string}   — The original / current text
 *   proposed    {string}   — The AI-proposed replacement text
 *   sectionName {string}   — Active section name shown in the header
 *   actionLabel {string}   — Action label shown in the header (e.g. "Rewrite")
 *   onAccept    {function} — Called when the user accepts the proposed change
 *   onReject    {function} — Called when the user rejects the proposed change
 *   isOpen      {boolean}  — Controls AnimatePresence visibility
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import { diffLines, formatLines } from 'unidiff';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a unified diff string from two text blocks.
 *
 * @param {string} original
 * @param {string} proposed
 * @returns {string} Unified diff string ready for parseDiff()
 */
function buildDiffText(original, proposed) {
  return formatLines(diffLines(original, proposed), { context: 3 });
}

/**
 * Wrap a raw diff string in git-style file headers so that parseDiff()
 * can parse it correctly.
 *
 * @param {string} diffText
 * @returns {string}
 */
function wrapDiff(diffText) {
  return `diff --git a/original b/proposed\n--- a/original\n+++ b/proposed\n${diffText}`;
}

// ---------------------------------------------------------------------------
// renderToken — applies coloured backgrounds to added/removed lines
// ---------------------------------------------------------------------------

/**
 * Custom token renderer for react-diff-view.
 * Colours removed lines with a red tint and added lines with a green tint.
 *
 * react-diff-view calls this for each token in a hunk line. We use it to
 * inject inline styles onto the wrapping <span> for each token type.
 */
function renderToken(token, defaultRender, index) {
  switch (token.type) {
    case 'delete':
      return (
        <span
          key={index}
          style={{ background: 'rgba(244,63,94,0.12)' }}
        >
          {defaultRender(token, index)}
        </span>
      );
    case 'insert':
      return (
        <span
          key={index}
          style={{ background: 'rgba(16,185,129,0.1)' }}
        >
          {defaultRender(token, index)}
        </span>
      );
    default:
      return defaultRender(token, index);
  }
}

// ---------------------------------------------------------------------------
// DiffViewerModal
// ---------------------------------------------------------------------------

export default function DiffViewerModal({
  original = '',
  proposed = '',
  sectionName = '',
  actionLabel = '',
  onAccept,
  onReject,
  isOpen = false,
}) {
  const [copied, setCopied] = useState(false);

  // ------------------------------------------------------------------
  // Keyboard: Enter → Accept, Escape → Reject
  // ------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        onAccept?.();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onReject?.();
      }
    },
    [isOpen, onAccept, onReject]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ------------------------------------------------------------------
  // Copy proposed text
  // ------------------------------------------------------------------
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(proposed).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [proposed]);

  // ------------------------------------------------------------------
  // Build diff — memoised per original/proposed change
  // ------------------------------------------------------------------
  let files = [];
  try {
    const diffText = buildDiffText(original, proposed);
    const wrapped = wrapDiff(diffText);
    files = parseDiff(wrapped);
  } catch {
    // Graceful degradation: render an empty diff area if parsing fails
    files = [];
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Semi-transparent backdrop */}
          <motion.div
            key="diff-backdrop"
            className="diff-modal-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(6, 13, 31, 0.72)',
              backdropFilter: 'blur(4px)',
              zIndex: 1000,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onReject}
            aria-hidden="true"
          />

          {/* Modal panel */}
          <motion.div
            key="diff-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Diff viewer — ${sectionName}: ${actionLabel}`}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 'min(860px, 92vw)',
              maxHeight: '80vh',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(79,126,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              zIndex: 1001,
            }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {/* ── Header ───────────────────────────────────────── */}
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--glass-border)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Diff icon */}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    background: 'var(--accent-dim)',
                    borderRadius: 6,
                    fontSize: '0.85rem',
                  }}
                  aria-hidden="true"
                >
                  ≠
                </span>
                <h2
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  {sectionName}
                  {actionLabel && (
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                      {' '}—{' '}{actionLabel}
                    </span>
                  )}
                </h2>
              </div>

              {/* Close / Reject button in header */}
              <button
                type="button"
                onClick={onReject}
                aria-label="Reject and close diff viewer"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                  padding: '4px 6px',
                  borderRadius: 6,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                ✕
              </button>
            </header>

            {/* ── Diff body ─────────────────────────────────────── */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0',
                /* Override react-diff-view defaults with project colours */
              }}
            >
              <style>{`
                /* Removed line backgrounds */
                .diff-viewer-root .diff-line-delete,
                .diff-viewer-root .diff-code-delete {
                  background: rgba(244,63,94,0.12) !important;
                }
                /* Added line backgrounds */
                .diff-viewer-root .diff-line-insert,
                .diff-viewer-root .diff-code-insert {
                  background: rgba(16,185,129,0.1) !important;
                }
                /* Gutter numbers */
                .diff-viewer-root .diff-gutter {
                  background: var(--bg-surface) !important;
                  border-right: 1px solid var(--glass-border) !important;
                  color: var(--text-muted) !important;
                  font-size: 0.75rem;
                  padding: 0 8px;
                  min-width: 40px;
                  user-select: none;
                }
                .diff-viewer-root .diff-gutter-delete { background: rgba(244,63,94,0.08) !important; }
                .diff-viewer-root .diff-gutter-insert { background: rgba(16,185,129,0.06) !important; }
                /* Code cells */
                .diff-viewer-root .diff-code {
                  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
                  font-size: 0.82rem;
                  line-height: 1.55;
                  color: var(--text-primary) !important;
                  padding: 0 12px;
                  white-space: pre-wrap;
                  word-break: break-word;
                }
                /* Table */
                .diff-viewer-root .diff-hunk-header { background: var(--bg-surface) !important; color: var(--text-secondary) !important; font-size: 0.75rem; }
                .diff-viewer-root table { width: 100%; border-collapse: collapse; }
                .diff-viewer-root td, .diff-viewer-root th { border: none !important; }
                /* Context lines */
                .diff-viewer-root .diff-line { border-bottom: 1px solid rgba(255,255,255,0.03); }
              `}</style>

              <div className="diff-viewer-root">
                {files.length === 0 ? (
                  <div
                    style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '0.875rem',
                    }}
                  >
                    No differences detected between original and proposed text.
                  </div>
                ) : (
                  files.map(({ oldRevision, newRevision, type, hunks }, fileIdx) => (
                    <Diff
                      key={`${oldRevision}-${newRevision}-${fileIdx}`}
                      viewType="unified"
                      diffType={type}
                      hunks={hunks}
                      renderToken={renderToken}
                    >
                      {(hunks) =>
                        hunks.map((hunk) => (
                          <Hunk key={hunk.content} hunk={hunk} />
                        ))
                      }
                    </Diff>
                  ))
                )}
              </div>
            </div>

            {/* ── Footer ────────────────────────────────────────── */}
            <footer
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
                padding: '14px 20px',
                borderTop: '1px solid var(--glass-border)',
                flexShrink: 0,
                background: 'var(--bg-surface)',
              }}
            >
              {/* Copy Proposed — with "Copied!" tooltip */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopy}
                  aria-label="Copy proposed text to clipboard"
                >
                  {copied ? '✓ Copied!' : 'Copy Proposed'}
                </button>
                <AnimatePresence>
                  {copied && (
                    <motion.span
                      key="copied-tooltip"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 6px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--success)',
                        color: '#fff',
                        padding: '3px 10px',
                        borderRadius: 6,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                      }}
                    >
                      Copied!
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Reject */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onReject}
                aria-label="Reject proposed changes"
              >
                Reject
              </button>

              {/* Accept */}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onAccept}
                aria-label="Accept proposed changes"
              >
                Accept
              </button>
            </footer>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
