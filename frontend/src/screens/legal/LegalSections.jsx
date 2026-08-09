/**
 * LegalSections.jsx
 *
 * Legal Advisor — DRHP Legal Sections page (/legal/drhp).
 *
 * What it does:
 *   - Two-column layout: left nav rail (6 sections) + right content area
 *   - Content area shows: section header, action bar, draft text, AI flags,
 *     evidence docs, and inline comment/action history
 *   - Legal Advisor can Approve, Request Changes (manually), or Add Comment
 *     on any section that is NOT locked by the Merchant Banker
 *   - AI flags from Gap Detection / Consistency Checker are surfaced as
 *     *suggestions* with a "Click to formally request changes" CTA — the
 *     system never auto-submits this action
 *   - Section locked by Merchant Banker: action buttons not rendered
 *
 * All styles live in legal-dashboard.css (sections 4 + shared).
 * Data: legalApi.js → fetchLegalDraftSections / approveLegalSection / submitReview
 */

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  FileEdit,
  MessageSquare,
  Eye,
  Lock,
  AlertTriangle,
  ChevronRight,
  FileText,
  X,
} from 'lucide-react';
import './legal-dashboard.css';
import {
  fetchLegalDraftSections,
  fetchLegalDocuments,
  approveLegalSection,
  submitReview,
} from './legalApi';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const ACTION_TYPE_META = {
  comment:        { label: 'Comment',         cls: 'comment' },
  change_request: { label: 'Change Request',  cls: 'change-request' },
  approval:       { label: 'Approved',        cls: 'approval' },
};

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// AI Flag strip
// "AI flagged this — click to formally request changes" — never auto-submitted
// ---------------------------------------------------------------------------
function AiFlagStrip({ flag, onRequestChanges }) {
  return (
    <div className="legal-ai-flag-strip" role="note" aria-label="AI engine flag">
      <span className="legal-ai-flag-label">AI Flag</span>
      <div className="legal-ai-flag-body">
        <p className="legal-ai-flag-text">{flag.description}</p>
        <span className={`legal-ai-flag-severity legal-ai-flag-severity--${flag.severity}`}>
          {flag.severity === 'critical' ? '● Critical' : '● Warning'}
          {' '}· {flag.engine === 'gap_detector' ? 'Gap Detection Engine' : 'Consistency Checker'}
        </span>
        {flag.suggestedAction && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)', marginTop: 'var(--space-1)' }}>
            Suggestion: {flag.suggestedAction}
          </p>
        )}
        {/* CTA — explicit human action only, never auto-submitted */}
        <button
          id={`ai-flag-cta-${flag.id}`}
          type="button"
          className="legal-ai-flag-cta"
          onClick={() => onRequestChanges(flag)}
          title="This will open the 'Request Changes' form pre-filled with this AI suggestion. You must submit it manually."
        >
          <FileEdit size={11} strokeWidth={1.75} />
          AI flagged this — click to formally request changes
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline comment form
// ---------------------------------------------------------------------------
function InlineCommentForm({ sectionId, onSubmitted, onCancel, prefillNote = '', prefillChangeRequest = false }) {
  const [note, setNote]           = useState(prefillNote);
  const [reqChg, setReqChg]       = useState(prefillChangeRequest);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  async function handleSubmit() {
    if (!note.trim()) { setError('Please enter a note.'); return; }
    setLoading(true);
    setError(null);
    const res = await submitReview(sectionId, note.trim(), reqChg);
    setLoading(false);
    if (res.success) {
      onSubmitted({ note: note.trim(), requestChanges: reqChg });
    } else {
      setError(res.error || 'Submission failed.');
    }
  }

  return (
    <div className="legal-inline-comment-form">
      <label className="legal-label" htmlFor={`comment-textarea-${sectionId}`}>
        {reqChg ? 'Change Request Note' : 'Comment'}
      </label>
      <textarea
        id={`comment-textarea-${sectionId}`}
        className="legal-inline-textarea"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={reqChg ? 'Describe the change required…' : 'Add a comment…'}
        rows={4}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={reqChg}
            onChange={(e) => setReqChg(e.target.checked)}
            style={{ accentColor: 'var(--signal)' }}
          />
          Mark as Change Request
        </label>
      </div>
      {error && <p className="legal-feedback legal-feedback--error">{error}</p>}
      <div className="legal-inline-form-actions">
        <button type="button" className="legal-btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="legal-btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Submitting…' : reqChg ? 'Submit Change Request' : 'Submit Comment'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section content panel (right side)
// ---------------------------------------------------------------------------
function SectionContent({ section, allDocs }) {
  const [showCommentForm, setShowCommentForm]     = useState(false);
  const [prefillNote, setPrefillNote]             = useState('');
  const [prefillReqChg, setPrefillReqChg]         = useState(false);
  const [actionHistory, setActionHistory]         = useState([]);
  const [approvedLocally, setApprovedLocally]     = useState(false);
  const [approving, setApproving]                 = useState(false);
  const [feedback, setFeedback]                   = useState(null);

  const isLocked    = section.lockedByBanker;
  const isApproved  = section.status === 'clear' || approvedLocally;

  // Evidence docs linked to this section
  const evidenceDocs = allDocs.filter((d) =>
    (section.evidenceDocs || []).includes(d.id)
  );

  async function handleApprove() {
    setApproving(true);
    setFeedback(null);
    const res = await approveLegalSection(section.id);
    setApproving(false);
    if (res.success) {
      setApprovedLocally(true);
      const entry = {
        type: 'approval',
        note: `Approved "${section.title}".`,
        timestamp: new Date().toISOString(),
        actor: 'You (Legal Advisor)',
      };
      setActionHistory((prev) => [entry, ...prev]);
      setFeedback({ kind: 'success', text: 'Section approved.' });
    } else {
      setFeedback({ kind: 'error', text: res.error || 'Approval failed.' });
    }
    setTimeout(() => setFeedback(null), 5000);
  }

  function handleAiFlagCta(flag) {
    setPrefillNote(`AI flag from ${flag.engine === 'gap_detector' ? 'Gap Detection Engine' : 'Consistency Checker'}:\n\n${flag.description}\n\nSuggested action: ${flag.suggestedAction || '—'}`);
    setPrefillReqChg(true);
    setShowCommentForm(true);
  }

  function handleCommentSubmitted({ note, requestChanges }) {
    const entry = {
      type: requestChanges ? 'change_request' : 'comment',
      note,
      timestamp: new Date().toISOString(),
      actor: 'You (Legal Advisor)',
    };
    setActionHistory((prev) => [entry, ...prev]);
    setShowCommentForm(false);
    setPrefillNote('');
    setPrefillReqChg(false);
    setFeedback({ kind: 'success', text: requestChanges ? 'Change request submitted.' : 'Comment added.' });
    setTimeout(() => setFeedback(null), 5000);
  }

  // Existing comments from mock data
  const existingComments = section.comments || [];

  return (
    <div className="legal-section-content">
      {/* Section header */}
      <div className="legal-section-doc-header">
        <div>
          <h2 className="legal-section-doc-title">{section.title}</h2>
          <div className="legal-section-doc-ref">{section.section}</div>
          {section.approvedBy && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-approved)', marginTop: 'var(--space-1)' }}>
              <CheckCircle2 size={11} strokeWidth={2} style={{ display: 'inline', marginRight: 4 }} />
              Approved by {section.approvedBy} · {fmtTime(section.approvedAt)}
            </div>
          )}
          {approvedLocally && !section.approvedBy && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--status-approved)', marginTop: 'var(--space-1)' }}>
              <CheckCircle2 size={11} strokeWidth={2} style={{ display: 'inline', marginRight: 4 }} />
              Approved just now
            </div>
          )}
        </div>

        {/* Action buttons — not rendered when section is locked by Merchant Banker */}
        {!isLocked && (
          <div className="legal-section-actions-bar">
            <button
              id={`sections-approve-${section.id}`}
              type="button"
              className="legal-btn-primary"
              onClick={handleApprove}
              disabled={approving || isApproved}
              title={isApproved ? 'Already approved' : 'Approve this section'}
            >
              <CheckCircle2 size={12} strokeWidth={2} />
              {approving ? 'Approving…' : isApproved ? 'Approved' : 'Approve'}
            </button>
            <button
              id={`sections-request-changes-${section.id}`}
              type="button"
              className="legal-btn-secondary"
              onClick={() => { setPrefillReqChg(true); setShowCommentForm(true); }}
            >
              <FileEdit size={12} strokeWidth={1.5} />
              Request Changes
            </button>
            <button
              id={`sections-comment-${section.id}`}
              type="button"
              className="legal-btn-secondary"
              onClick={() => { setPrefillReqChg(false); setShowCommentForm(true); }}
            >
              <MessageSquare size={12} strokeWidth={1.5} />
              Add Comment
            </button>
          </div>
        )}
      </div>

      {/* Locked notice */}
      {isLocked && (
        <div className="legal-locked-notice">
          <Lock size={14} strokeWidth={1.75} className="legal-locked-icon" />
          <span>This section has been locked and certified by the Merchant Banker. No further actions are allowed on this section.</span>
        </div>
      )}

      {/* Inline feedback */}
      {feedback && (
        <p className={`legal-feedback legal-feedback--${feedback.kind}`}>
          {feedback.kind === 'success' ? <CheckCircle2 size={12} strokeWidth={2} style={{ display: 'inline', marginRight: 4 }} /> : null}
          {feedback.text}
        </p>
      )}

      {/* AI flags — surfaced as suggestions, action always manual */}
      {(section.aiFlags || []).length > 0 && (
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-2)' }}>
            <AlertTriangle size={11} strokeWidth={2} style={{ display: 'inline', marginRight: 4, color: 'var(--status-draft)' }} />
            AI Engine Flags ({section.aiFlags.length}) — review suggestion, your manual action required
          </div>
          {section.aiFlags.map((flag) => (
            <AiFlagStrip key={flag.id} flag={flag} onRequestChanges={handleAiFlagCta} />
          ))}
        </div>
      )}

      {/* Draft text */}
      <div className="legal-draft-area">
        <pre className="legal-draft-text">{section.draftText}</pre>
      </div>

      {/* Evidence documents */}
      {evidenceDocs.length > 0 && (
        <div className="legal-evidence-panel">
          <div className="legal-panel-header">
            <Eye size={13} strokeWidth={1.75} style={{ color: 'var(--ink-soft)', flexShrink: 0 }} />
            <span className="legal-panel-title">Evidence Documents ({evidenceDocs.length})</span>
          </div>
          <div className="legal-evidence-list">
            {evidenceDocs.map((doc) => (
              <div key={doc.id} className="legal-evidence-item">
                <FileText size={13} strokeWidth={1.5} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
                <span className="legal-evidence-filename">{doc.filename}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>{doc.fileSize}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inline comment form */}
      {showCommentForm && !isLocked && (
        <div className="legal-action-entry" style={{ border: '1px solid var(--rule)', borderLeft: '3px solid var(--signal)' }}>
          <InlineCommentForm
            sectionId={section.id}
            prefillNote={prefillNote}
            prefillChangeRequest={prefillReqChg}
            onSubmitted={handleCommentSubmitted}
            onCancel={() => { setShowCommentForm(false); setPrefillNote(''); setPrefillReqChg(false); }}
          />
        </div>
      )}

      {/* Action history (session-local + existing mock comments) */}
      {(actionHistory.length > 0 || existingComments.length > 0) && (
        <div className="legal-action-history">
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--space-3)' }}>
            Comments &amp; Actions
          </div>

          {/* Session actions (newest first) */}
          {actionHistory.map((entry, i) => {
            const meta = ACTION_TYPE_META[entry.type] ?? ACTION_TYPE_META.comment;
            return (
              <div key={i} className={`legal-action-entry legal-action-entry--${entry.type.replace('_', '-')}`}>
                <div className="legal-action-entry-header">
                  <span className={`legal-action-type-tag legal-action-type-tag--${entry.type.replace('_', '-')}`}>
                    {meta.label}
                  </span>
                  <span className="legal-action-author">{entry.actor}</span>
                  <span className="legal-action-time">{fmtTime(entry.timestamp)}</span>
                </div>
                <div className="legal-action-entry-body">{entry.note}</div>
              </div>
            );
          })}

          {/* Existing comments from mock data */}
          {existingComments.map((c) => (
            <div key={c.id} className="legal-action-entry legal-action-entry--comment">
              <div className="legal-action-entry-header">
                <span className="legal-action-type-tag legal-action-type-tag--comment">Comment</span>
                <span className="legal-action-author">{c.author}</span>
                <span className="legal-action-time">{fmtTime(c.createdAt)}</span>
              </div>
              <div className="legal-action-entry-body">{c.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LegalSections() {
  const [sections, setSections] = useState([]);
  const [allDocs, setAllDocs]   = useState([]);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    Promise.all([fetchLegalDraftSections(), fetchLegalDocuments()]).then(([secs, docs]) => {
      setSections(secs);
      setAllDocs(docs);
      if (secs.length > 0) setActiveId(secs[0].id);
    });
  }, []);

  const activeSection = sections.find((s) => s.id === activeId);

  return (
    <div className="legal-page fade-in">
      <h1 className="legal-page-heading">DRHP Legal Sections</h1>
      <p className="legal-page-sub">
        Review draft text, AI-flagged issues, and evidence for each legal section.
        Approve or request changes — all actions are manual.
      </p>

      {sections.length === 0 ? (
        <div className="legal-empty-state">
          <FileText size={32} strokeWidth={1.25} className="legal-empty-icon" />
          <p className="legal-empty-text">Loading sections…</p>
        </div>
      ) : (
        <div className="legal-sections-layout">
          {/* Left nav rail */}
          <nav className="legal-section-nav" aria-label="DRHP legal sections">
            {sections.map((s) => (
              <button
                key={s.id}
                id={`section-nav-${s.id}`}
                type="button"
                className={`legal-section-nav-item legal-section-nav-item--${s.status} ${activeId === s.id ? 'active' : ''}`}
                onClick={() => setActiveId(s.id)}
                aria-current={activeId === s.id ? 'page' : undefined}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <span className={`legal-status-dot legal-status-dot--${s.status}`} aria-hidden="true" />
                <span className="legal-nav-item-label">{s.title}</span>
                {activeId === s.id && <ChevronRight size={12} strokeWidth={2} style={{ color: 'var(--signal)', flexShrink: 0 }} />}
              </button>
            ))}
          </nav>

          {/* Right content */}
          {activeSection && (
            <SectionContent
              key={activeSection.id}
              section={activeSection}
              allDocs={allDocs}
            />
          )}
        </div>
      )}
    </div>
  );
}
