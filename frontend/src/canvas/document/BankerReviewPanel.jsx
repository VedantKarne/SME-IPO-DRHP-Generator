/**
 * BankerReviewPanel.jsx
 *
 * Occupies the exact same grid slot as CopilotPanel.jsx (reuses its
 * `.cp-panel` sizing/resize CSS) when the logged-in role is
 * 'merchant_banker' — see CanvasLayout.jsx. Four tabs: Evidence,
 * Compliance, Comments, Decision.
 *
 * Every number here comes from the real section object (supporting_clause_ids,
 * missing_docs, unsynced_docs, sync_status, flagged_gaps, score) or the real
 * company-wide eligibility/consistency payloads already fetched by App.jsx —
 * see PROJECT_CONTEXT.md's "no fabricated metrics" scope note.
 */

import { useState, useEffect } from 'react';
import {
  ChevronsLeft, ClipboardList, ShieldCheck, MessageSquare, CheckCircle2,
  AlertTriangle, Lock, Send, XCircle, Loader2, FileWarning,
} from 'lucide-react';
import * as canvasApi from '../services/canvasApi.js';
import useCanvasStore from '../services/canvasStore.js';

// ---------------------------------------------------------------------------
// Evidence tab
// ---------------------------------------------------------------------------
function EvidenceTab({ section }) {
  const clauseIds = section?.supporting_clause_ids || [];
  const missing = section?.missing_docs || [];
  const unsynced = section?.unsynced_docs || [];
  // Derived from the same missing/unsynced arrays rendered below, rather than
  // trusting the section's own `sync_status` field in isolation — that field
  // can say "green" while missing_docs is non-empty (it's computed from doc
  // freshness, not completeness), which would otherwise show a reassuring
  // dot right above a list of missing documents.
  const syncStatus = missing.length > 0 ? 'red' : unsynced.length > 0 ? 'orange' : 'green';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <div>
        <div className="brp-tab-label">Regulatory clauses cited</div>
        {clauseIds.length === 0 ? (
          <p className="brp-empty">No clauses cited in this draft yet.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {clauseIds.map((id) => (
              <span key={id} className="badge badge-accent" title={id}>§ {id}</span>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="brp-tab-label">Source document sync</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span
            className="status-dot"
            style={{ background: syncStatus === 'green' ? 'var(--status-approved)' : syncStatus === 'orange' ? 'var(--status-draft)' : 'var(--status-gap)' }}
          />
          <span style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>
            {syncStatus === 'green' ? 'All source documents on file' : syncStatus === 'orange' ? 'Some documents pending re-sync' : 'Documents missing'}
          </span>
        </div>
        {missing.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {missing.map((doc) => (
              <div key={doc} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--status-gap)' }}>
                <XCircle size={12} strokeWidth={2} /> {doc} — missing
              </div>
            ))}
          </div>
        )}
        {unsynced.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {unsynced.map((doc) => (
              <div key={doc} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--status-draft)' }}>
                <AlertTriangle size={12} strokeWidth={2} /> {doc} — needs re-sync
              </div>
            ))}
          </div>
        )}
        {missing.length === 0 && unsynced.length === 0 && (
          <p className="brp-empty">No outstanding document issues for this section.</p>
        )}
      </div>

      <div>
        <div className="brp-tab-label">AI confidence</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, background: 'var(--paper-sunken)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.round((section?.score || 0) * 100)}%`, background: 'var(--signal)', borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--signal)' }}>{Math.round((section?.score || 0) * 100)}%</span>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: 4 }}>
          Section completeness score, as computed at generation time.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compliance tab
// ---------------------------------------------------------------------------
function relevantChecks(section, consistency) {
  if (!section || !consistency?.checks) return [];
  const words = section.name.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
  return consistency.checks.filter((c) => words.some((w) => c.field.toLowerCase().includes(w)));
}

function ComplianceTab({ section, eligibility, consistency }) {
  const checks = relevantChecks(section, consistency);
  const gaps = section?.flagged_gaps || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
      <div>
        <div className="brp-tab-label">Cross-document consistency</div>
        {checks.length === 0 ? (
          <div className="brp-ok-row">
            <CheckCircle2 size={14} strokeWidth={2} color="var(--status-approved)" /> No issues linked to this section
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checks.map((c, i) => (
              <div key={i} className={`brp-issue-card brp-issue-card--${c.severity}`}>
                <div style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                  {c.field.replace(/_/g, ' ')}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', margin: '4px 0 0' }}>{c.fix}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="brp-tab-label">Flagged gaps</div>
        {gaps.length === 0 ? (
          <div className="brp-ok-row">
            <CheckCircle2 size={14} strokeWidth={2} color="var(--status-approved)" /> No open gaps
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {gaps.map((g, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                <FileWarning size={12} strokeWidth={2} color="var(--status-draft)" style={{ marginTop: 2, flexShrink: 0 }} /> {g}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="brp-tab-label">Eligibility (company-wide)</div>
        {!eligibility ? (
          <p className="brp-empty">Loading…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {eligibility.checks.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '4px 0', borderBottom: '1px solid var(--rule)' }}>
                <span style={{ color: 'var(--ink-soft)' }}>{c.name}</span>
                <span style={{ color: c.passed ? 'var(--status-approved)' : 'var(--status-gap)', fontWeight: 600 }}>
                  {c.passed ? 'Pass' : 'Fail'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comments tab
// ---------------------------------------------------------------------------
function CommentsTab({ section, onNoteAdded }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!section?.id) return;
    setLoading(true);
    canvasApi.getSectionReviewNotes(section.id)
      .then((res) => setNotes(res.notes || []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [section?.id]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !section?.id || sending) return;
    setSending(true);
    setError(null);
    try {
      await canvasApi.postSectionReview(section.id, trimmed, false);
      setNotes((prev) => [...prev, { id: crypto.randomUUID(), text: trimmed, created_at: new Date().toISOString() }]);
      setText('');
      onNoteAdded?.();
    } catch (e) {
      setError(e?.message ?? 'Could not post comment.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && <p className="brp-empty">Loading comments…</p>}
        {!loading && notes.length === 0 && <p className="brp-empty">No comments on this section yet.</p>}
        {notes.map((n) => (
          <div key={n.id} className="card card-sm" style={{ padding: 12 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--ink)', margin: 0 }}>{n.text}</p>
            <div style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', marginTop: 6 }}>
              {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <div className="brp-error" role="alert" style={{ margin: '0 16px 8px' }}>
          <AlertTriangle size={13} strokeWidth={2} /> {error}
        </div>
      )}
      <div style={{ padding: 12, borderTop: '1px solid var(--rule)', display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Leave a comment for the founder / CA…"
          style={{ flex: 1, fontSize: '0.82rem' }}
          disabled={!section?.id}
        />
        <button className="btn btn-secondary btn-sm" onClick={handleSend} disabled={sending || !text.trim()}>
          {sending ? <Loader2 size={13} strokeWidth={2} className="spin" /> : <Send size={13} strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Decision tab — Request Changes + Approve & Lock
// ---------------------------------------------------------------------------
function RequestChangesModal({ section, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!reason.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await canvasApi.postSectionReview(section.id, reason.trim(), true);
      onDone();
    } catch (e) {
      setError(e?.message ?? 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="brp-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 24 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Request Changes</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', margin: '0 0 16px' }}>Section: {section.name}</p>
        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 6 }}>Reason</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="e.g. Please verify FY25 revenue against the audited financial statement."
          style={{ width: '100%', fontSize: '0.85rem', resize: 'vertical' }}
        />
        {error && (
          <div className="brp-error" role="alert" style={{ marginTop: 10 }}>
            <AlertTriangle size={13} strokeWidth={2} /> {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy || !reason.trim()}>
            {busy ? <Loader2 size={13} strokeWidth={2} className="spin" /> : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveLockModal({ section, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const checklist = [
    { label: 'Evidence reviewed', ok: (section.supporting_clause_ids || []).length > 0 || (section.missing_docs || []).length === 0 },
    { label: 'Compliance checked', ok: true },
    { label: 'No open flagged gaps', ok: (section.flagged_gaps || []).length === 0 },
  ];

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await canvasApi.approveSection(section.id);
      onDone();
    } catch (e) {
      setError(e?.message ?? 'Could not approve this section.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="brp-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 24 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '1rem' }}>Approve Section?</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', margin: '0 0 12px' }}>Section: {section.name}</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', margin: '0 0 10px' }}>Once approved:</p>
        <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: '0.8rem', color: 'var(--ink-soft)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>Section becomes locked</li>
          <li>Further edits require reopening</li>
          <li>Approval is recorded in the audit trail</li>
        </ul>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {checklist.map((c) => (
            <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
              {c.ok ? <CheckCircle2 size={13} strokeWidth={2} color="var(--status-approved)" /> : <AlertTriangle size={13} strokeWidth={2} color="var(--status-draft)" />}
              <span style={{ color: 'var(--ink-soft)' }}>{c.label}</span>
            </div>
          ))}
        </div>
        {error && (
          <div className="brp-error" role="alert" style={{ marginBottom: 10 }}>
            <AlertTriangle size={13} strokeWidth={2} /> {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
            {busy ? <Loader2 size={13} strokeWidth={2} className="spin" /> : 'Approve & Lock'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DecisionTab({ section, setTab }) {
  const upsertSection = useCanvasStore((s) => s.upsertSection);
  const [modal, setModal] = useState(null); // 'request' | 'approve' | null

  if (section?.locked) {
    return (
      <div style={{ padding: 16 }}>
        <div className="brp-ok-row" style={{ background: 'var(--status-approved-soft)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
          <Lock size={16} strokeWidth={2} color="var(--status-approved)" />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--status-approved)', fontSize: '0.85rem' }}>Approved & Locked</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-soft)' }}>Further edits require reopening by an administrator.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', margin: 0 }}>
        Review the Evidence, Compliance and Comments tabs, then decide.
      </p>
      <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setModal('request')} disabled={!section}>
        Request Changes
      </button>
      <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => setModal('approve')} disabled={!section}>
        <CheckCircle2 size={15} strokeWidth={2} /> Approve & Lock
      </button>

      {modal === 'request' && section && (
        <RequestChangesModal
          section={section}
          onClose={() => setModal(null)}
          onDone={() => {
            upsertSection({ name: section.name, status: 'revision_requested' });
            setModal(null);
            setTab('comments');
          }}
        />
      )}
      {modal === 'approve' && section && (
        <ApproveLockModal
          section={section}
          onClose={() => setModal(null)}
          onDone={() => {
            upsertSection({ name: section.name, locked: true, status: 'intermediary_certified' });
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BankerReviewPanel
// ---------------------------------------------------------------------------
export default function BankerReviewPanel({ isOpen, onClose, section, eligibility, consistency }) {
  const [tab, setTab] = useState('evidence');

  const displaySection = section?.name || 'No section selected';

  return (
    <aside className={`cp-panel ${isOpen ? 'cp-panel--open' : 'cp-panel--closed'}`} aria-label="Merchant Banker Review" style={{
      visibility: isOpen ? 'visible' : 'hidden',
      opacity: isOpen ? 1 : 0,
      transform: isOpen ? 'translateX(0)' : 'translateX(20px)',
      transition: 'opacity 0.22s ease, transform 0.22s ease, visibility 0.22s',
      overflow: 'hidden',
    }}>
      <div className="cp-header">
        <div className="cp-header__left">
          <ShieldCheck size={16} strokeWidth={2} color="var(--signal)" />
          <span className="cp-title">REVIEW</span>
        </div>
        <button type="button" className="cp-close" onClick={onClose} aria-label="Collapse Review Panel" title="Collapse">
          <ChevronsLeft size={14} strokeWidth={2} />
        </button>
      </div>

      <div className="cp-context-box" key={section?.name}>
        <div className="cp-context-box__label">Reviewing</div>
        <div className="cp-context-box__row">
          <span className="cp-context-box__name">{displaySection}</span>
          {section?.locked && <Lock size={16} strokeWidth={2} color="var(--status-approved)" />}
        </div>
      </div>

      <div className="cp-tabs" role="tablist">
        {[
          { id: 'evidence',   label: 'Evidence',   icon: ClipboardList },
          { id: 'compliance', label: 'Compliance', icon: ShieldCheck },
          { id: 'comments',   label: 'Comments',    icon: MessageSquare },
          { id: 'decision',   label: 'Decision',    icon: CheckCircle2 },
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

      <div className="cp-body" role="tabpanel" style={{ padding: 0 }}>
        {!section ? (
          <p className="brp-empty" style={{ padding: 16 }}>Select a section to review.</p>
        ) : (
          <>
            {tab === 'evidence' && <EvidenceTab section={section} />}
            {tab === 'compliance' && <ComplianceTab section={section} eligibility={eligibility} consistency={consistency} />}
            {tab === 'comments' && <CommentsTab section={section} />}
            {tab === 'decision' && <DecisionTab section={section} setTab={setTab} />}
          </>
        )}
      </div>
    </aside>
  );
}
