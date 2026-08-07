/**
 * SelectionPopup.jsx — Floating AI action popup for selected text.
 *
 * Subscribes to TipTap's onSelectionUpdate. When the selection is non-empty
 * (from !== to), renders a popup with four AI action buttons adjacent to the
 * selected text. On click, calls canvasApi.rewrite and opens DiffViewerModal
 * with the original text and the proposed replacement.
 *
 * Props:
 *   editor      {object}  – TipTap editor instance
 *   companyId   {string}  – active company ID
 *   sectionName {string}  – active section name
 *   section     {object}  – section object; if section.locked === true, popup is hidden
 *
 * Requirements: 3.1, 3.2, 3.7, 3.8, 3.10
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as canvasApi from '../services/canvasApi.js';
import useVersionStore from '../versions/versionStore.js';

// DiffViewerModal is being built in parallel — import defensively
let DiffViewerModal = null;
try {
  // Dynamic require-style import at module evaluation time is not possible in ESM,
  // so we use a lazy-load state pattern inside the component instead.
  // The actual import is deferred to first render via useEffect.
} catch {
  // DiffViewerModal not yet available — will be null-checked before use
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Popup width in px — used for overflow repositioning. */
const POPUP_WIDTH = 200;

/** Popup height in px — used for overflow repositioning. */
const POPUP_HEIGHT = 160;

/** Viewport edge threshold in px for flip repositioning. */
const EDGE_THRESHOLD = 120;

/** AI action button definitions. */
const ACTIONS = [
  { id: 'rewrite', label: 'Rewrite' },
  { id: 'expand', label: 'Expand' },
  { id: 'simplify', label: 'Simplify' },
  { id: 'investor_friendly', label: 'Investor Friendly' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate popup position from the editor's coordsAtPos result.
 * Applies viewport overflow repositioning:
 *   - if popupLeft + POPUP_WIDTH > window.innerWidth → flip left
 *   - if popupTop + POPUP_HEIGHT > window.innerHeight → flip above
 *
 * @param {{ top: number, bottom: number, left: number }} coords
 * @returns {{ top: number, left: number }}
 */
function calculatePopupPosition(coords) {
  const scrollY = window.scrollY || 0;
  const scrollX = window.scrollX || 0;

  let left = coords.left + scrollX;
  let top = coords.bottom + scrollY + 8; // 8px gap below selection

  // Horizontal overflow — flip to left of anchor
  if (left + POPUP_WIDTH > window.innerWidth - EDGE_THRESHOLD) {
    left = Math.max(8, coords.right + scrollX - POPUP_WIDTH);
  }

  // Vertical overflow — flip above selection
  if (top + POPUP_HEIGHT > window.innerHeight + scrollY - EDGE_THRESHOLD) {
    top = coords.top + scrollY - POPUP_HEIGHT - 8;
  }

  return { top, left };
}

// ---------------------------------------------------------------------------
// SelectionPopup
// ---------------------------------------------------------------------------

export default function SelectionPopup({ editor, companyId, sectionName, section, showToast }) {
  const addVersion = useVersionStore((s) => s.addVersion);

  // Lazily loaded DiffViewerModal
  const [DiffModal, setDiffModal] = useState(null);

  // Popup visibility + position
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Currently selected text (snapshot at the time the popup appeared)
  const selectedTextRef = useRef('');

  // In-flight action state
  const [loadingAction, setLoadingAction] = useState(null);

  // Diff viewer state
  const [diffState, setDiffState] = useState(null); // { original, proposed, actionLabel } | null
  const [actionError, setActionError] = useState(null); // string | null

  const popupRef = useRef(null);

  // ── Lazy-load DiffViewerModal ──────────────────────────────────────────
  useEffect(() => {
    import('../diff/DiffViewerModal.jsx')
      .then((mod) => setDiffModal(() => mod.default))
      .catch(() => {
        // DiffViewerModal not yet available — will remain null
      });
  }, []);

  // ── TipTap selection subscription ─────────────────────────────────────
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { from, to } = editor.state.selection;

      if (from === to) {
        // Collapsed / no selection — hide popup
        setVisible(false);
        return;
      }

      // section.locked check — do not render when locked
      if (section?.locked) {
        setVisible(false);
        return;
      }

      // Snapshot the selected text
      selectedTextRef.current = editor.state.doc.textBetween(from, to, ' ');

      // Calculate popup position
      try {
        const coords = editor.view.coordsAtPos(from);
        setPosition(calculatePopupPosition(coords));
        setVisible(true);
      } catch {
        // coordsAtPos can throw if the editor is in an unexpected state
        setVisible(false);
      }
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, section?.locked]);

  // ── Dismiss helpers ────────────────────────────────────────────────────
  const dismiss = useCallback(() => {
    setVisible(false);
    setLoadingAction(null);
    setActionError(null);
  }, []);

  // Escape key and outside-click dismissal
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        dismiss();
      }
    };

    const handlePointerDown = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        // Only dismiss if user isn't clicking inside the editor itself
        // (clicking inside editor triggers a new selectionUpdate anyway)
        dismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    };
  }, [visible, dismiss]);

  // ── Action button click ────────────────────────────────────────────────
  const handleAction = useCallback(
    async (actionId, actionLabel) => {
      if (loadingAction !== null) return; // already in-flight

      const selectedText = selectedTextRef.current;
      if (!selectedText) return;

      setLoadingAction(actionId);
      setActionError(null);

      try {
        const result = await canvasApi.rewrite(companyId, sectionName, selectedText, actionId);
        const proposedText = result?.proposed_text;

        // An empty proposal is a failed rewrite, not a valid one. Opening the
        // diff viewer with the original text on both sides would present a
        // no-op as a successful AI suggestion.
        if (!proposedText) {
          setActionError('The AI returned an empty rewrite. Please try again.');
          return;
        }

        setDiffState({
          original: selectedText,
          proposed: proposedText,
          actionLabel,
        });
      } catch (e) {
        // canvasApi.rewrite throws ApiError on any failure. Show it — the
        // previous behaviour substituted canned text from a mock bank.
        console.error('Rewrite failed:', e);
        setActionError(e?.message ?? 'Rewrite failed.');
      } finally {
        setLoadingAction(null);
      }
    },
    [loadingAction, companyId, sectionName]
  );

  // ── Diff viewer Accept ─────────────────────────────────────────────────
  const handleAccept = useCallback(() => {
    if (!diffState || !editor) return;

    const { proposed, actionLabel } = diffState;

    // Replace the selected text range with the proposed replacement
    editor.chain().focus().deleteSelection().insertContent(proposed).run();

    // Capture a version snapshot. addVersion rolls back its optimistic insert
    // and rejects if the write fails, so surface that instead of leaving an
    // unhandled rejection.
    addVersion(companyId, sectionName, {
      id: crypto.randomUUID(),
      sectionName,
      label: `AI Rewrite — ${actionLabel}`,
      timestamp: new Date().toISOString(),
      source: 'ai_rewrite',
      content: editor.getJSON(),
      authorLabel: 'AI',
    }).catch((e) => {
      console.error('Version save failed:', e);
      showToast?.(
        'Edit applied, but the version snapshot could not be saved.',
        'error',
        5000
      );
    });

    setDiffState(null);
    dismiss();
  }, [diffState, editor, companyId, sectionName, addVersion, dismiss, showToast]);

  // ── Diff viewer Reject ─────────────────────────────────────────────────
  const handleReject = useCallback(() => {
    setDiffState(null);
    // Do not dismiss the popup — the selection is still active
  }, []);

  // ── Early-exit render guards ───────────────────────────────────────────

  // If section is locked, never render
  if (section?.locked) return null;

  // If no editor instance yet, nothing to render
  if (!editor) return null;

  return (
    <>
      {/* ── Floating action popup ──────────────────────────────────────── */}
      {visible && !diffState && (
        <div
          ref={popupRef}
          className="selection-popup"
          role="toolbar"
          aria-label="AI rewrite actions"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 1000,
            display: 'flex',
            gap: '4px',
            padding: '6px 8px',
            background: 'var(--paper-raised)',
            border: '1px solid var(--rule)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {ACTIONS.map(({ id, label }) => {
            const isActive = loadingAction === id;
            const isDisabled = loadingAction !== null && !isActive;

            return (
              <button
                key={id}
                type="button"
                className={`selection-popup__btn${isActive ? ' selection-popup__btn--active' : ''}`}
                aria-label={`${label} — AI rewrite`}
                aria-busy={isActive}
                disabled={isDisabled}
                onClick={() => handleAction(id, label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid transparent',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.45 : 1,
                  background: isActive ? 'var(--signal)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--ink)',
                  transition: 'background 0.15s, color 0.15s, opacity 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled && !isActive) {
                    e.currentTarget.style.background = 'var(--signal)';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.border = '1px solid var(--signal)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled && !isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--ink)';
                    e.currentTarget.style.border = '1px solid transparent';
                  }
                }}
              >
                {/* Spinner when this button's action is in-flight */}
                {isActive && (
                  <span
                    className="selection-popup__spinner"
                    aria-hidden="true"
                    style={{
                      width: '10px',
                      height: '10px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.7s linear infinite',
                    }}
                  />
                )}
                {label}
              </button>
            );
          })}

          {/* Keyframe animation injected once via a style tag */}
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            .selection-popup__btn:focus-visible {
              outline: 2px solid var(--signal);
              outline-offset: 2px;
            }
          `}</style>
        </div>
      )}

      {/* ── Action failure notice ──────────────────────────────────────── */}
      {visible && !diffState && actionError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            top: position.top + 44,
            left: position.left,
            zIndex: 1000,
            maxWidth: '320px',
            padding: '6px 10px',
            fontSize: '12px',
            lineHeight: 1.4,
            borderRadius: 'var(--radius-md)',
            background: 'var(--status-gap-soft)',
            border: '1px solid var(--status-gap)',
            color: 'var(--ink)',
          }}
        >
          {actionError}
        </div>
      )}

      {/* ── Diff Viewer Modal ─────────────────────────────────────────── */}
      {DiffModal && (
        <DiffModal
          isOpen={!!diffState}
          original={diffState?.original ?? ''}
          proposed={diffState?.proposed ?? ''}
          sectionName={sectionName}
          actionLabel={diffState?.actionLabel ?? ''}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      {/*
        Fallback when DiffViewerModal hasn't loaded yet but a response arrived:
        show a minimal inline accept/reject UI so the user is never blocked.
      */}
      {diffState && !DiffModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI Rewrite Result"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 2000,
            padding: '24px',
            minWidth: '360px',
            maxWidth: '520px',
            background: 'var(--paper-raised)',
            border: '1px solid var(--rule)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--ink)',
          }}
        >
          <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>
            {sectionName} — {diffState.actionLabel}
          </h3>

          <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--ink-faint)' }}>
            Original
          </div>
          <pre
            style={{
              background: 'var(--status-gap-soft)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: '12px',
            }}
          >
            {diffState.original}
          </pre>

          <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--ink-faint)' }}>
            Proposed
          </div>
          <pre
            style={{
              background: 'var(--status-approved-soft)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 12px',
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: '16px',
            }}
          >
            {diffState.proposed}
          </pre>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleReject}
              style={{
                padding: '7px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--rule)',
                background: 'transparent',
                color: 'var(--ink-soft)',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={handleAccept}
              style={{
                padding: '7px 16px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'var(--signal)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}
