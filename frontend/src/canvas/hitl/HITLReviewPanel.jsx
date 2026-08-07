/**
 * HITLReviewPanel.jsx — surfaces a paused human-in-the-loop review.
 *
 * The backend has paused LangGraph runs at `hitl_review_interrupt` since Phase 9
 * (GET /api/hitl/pending/{section_id}, POST /api/hitl/submit/{section_id}), but
 * no frontend code ever called those endpoints — a search for "hitl" across
 * frontend/src returned nothing. A draft that scored below threshold therefore
 * sat waiting for a human decision that the UI never asked for.
 *
 * This panel only renders when there is genuinely something to review; it stays
 * out of the way otherwise rather than showing a permanent empty box.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import * as canvasApi from '../services/canvasApi.js';

const ACTIONS = [
  { id: 'approve', label: 'Approve', hint: 'Accept the draft and continue.' },
  { id: 'revise', label: 'Request revision', hint: 'Send feedback and regenerate.', needsFeedback: true },
  { id: 'reject', label: 'Reject', hint: 'Discard this draft.' },
];

export default function HITLReviewPanel({ sectionId, sectionName, onResolved }) {
  const [state, setState] = useState({ status: 'idle', payload: null });
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!sectionId) {
      setState({ status: 'idle', payload: null });
      return;
    }
    setError(null);
    try {
      const res = await canvasApi.getHitlPending(sectionId);
      setState({ status: res.status, payload: res.payload ?? null });
    } catch (e) {
      // 404 means "no active thread for this section", which is the normal
      // case for a section that was never generated — not worth alarming about.
      if (e?.status === 404) {
        setState({ status: 'none', payload: null });
        return;
      }
      console.error('HITL status check failed:', e);
      setError(e?.message ?? 'Could not check review status.');
    }
  }, [sectionId]);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async (action) => {
    if (action === 'revise' && !feedback.trim()) {
      setError('Describe what needs changing before requesting a revision.');
      return;
    }
    setBusy(action);
    setError(null);
    try {
      await canvasApi.submitHitlFeedback(sectionId, action, feedback.trim() || undefined);
      setFeedback('');
      await load();
      onResolved?.(action);
    } catch (e) {
      console.error('HITL submission failed:', e);
      setError(e?.message ?? 'Could not submit your decision.');
    } finally {
      setBusy(null);
    }
  }, [sectionId, feedback, load, onResolved]);

  // Nothing awaiting review — render nothing rather than an empty panel.
  if (state.status !== 'pending_review' && !error) return null;

  if (error && state.status !== 'pending_review') {
    return (
      <section className="hitl-panel hitl-panel--error" role="alert">
        <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" /> {error}
        <button type="button" onClick={load}>Retry</button>
      </section>
    );
  }

  const payload = state.payload || {};

  return (
    <section className="hitl-panel" aria-label={`Review required for ${sectionName}`}>
      <header className="hitl-panel__header">
        <span className="hitl-panel__badge">Review required</span>
        <h4 className="hitl-panel__title">{sectionName}</h4>
      </header>

      {payload.reason && <p className="hitl-panel__reason">{payload.reason}</p>}

      {typeof payload.completeness_score === 'number' && (
        <p className="hitl-panel__score">
          Completeness: <strong>{Math.round(payload.completeness_score * 100)}%</strong>
        </p>
      )}

      {Array.isArray(payload.gaps) && payload.gaps.length > 0 && (
        <div className="hitl-panel__gaps">
          <strong>Outstanding gaps</strong>
          <ul>
            {payload.gaps.map((gap, i) => (
              <li key={i}>{typeof gap === 'string' ? gap : gap.description ?? JSON.stringify(gap)}</li>
            ))}
          </ul>
        </div>
      )}

      <label className="hitl-panel__feedback">
        <span>Feedback (required to request a revision)</span>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          placeholder="e.g. Quantify customer concentration with exact FY figures."
          disabled={busy !== null}
        />
      </label>

      {error && <p className="hitl-panel__error" role="alert">{error}</p>}

      <div className="hitl-panel__actions">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            title={action.hint}
            className={`btn btn-sm hitl-panel__action hitl-panel__action--${action.id}`}
            disabled={busy !== null}
            onClick={() => submit(action.id)}
          >
            {busy === action.id ? 'Working…' : action.label}
          </button>
        ))}
      </div>
    </section>
  );
}
