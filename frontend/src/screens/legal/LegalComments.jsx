/**
 * LegalComments.jsx
 *
 * Legal Advisor — Comments & Threads page (/legal/comments).
 *
 * What it does:
 *   - Shows all threaded comments grouped by DRHP section
 *   - Each thread card is styled by type:
 *       advisor_comment       → signal (crimson) left border
 *       ai_flag               → amber left border (clearly non-human)
 *       clarification_request → pending (blue-grey) left border
 *   - Replies are shown inline under each top-level comment
 *   - AI-flagged comments display a distinct "AI Engine" label so they are
 *     never confused with Legal Advisor human actions
 *   - Filter by type; search by text or section
 *
 * All styles live in legal-dashboard.css (section 7 + shared).
 * Data: fetchLegalComments() from legalApi.js
 */

import { useState, useEffect } from 'react';
import {
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Filter,
} from 'lucide-react';
import './legal-dashboard.css';
import { fetchLegalComments } from './legalApi';

// ---------------------------------------------------------------------------
// Type metadata
// ---------------------------------------------------------------------------
const TYPE_META = {
  advisor_comment: {
    label:   'Advisor Comment',
    Icon:    MessageSquare,
    cardCls: 'legal-comment-card--advisor_comment',
    tagCls:  'legal-comment-type-label--advisor_comment',
  },
  ai_flag: {
    label:   'AI Engine Flag',
    Icon:    AlertTriangle,
    cardCls: 'legal-comment-card--ai_flag',
    tagCls:  'legal-comment-type-label--ai_flag',
  },
  clarification_request: {
    label:   'Clarification Request',
    Icon:    HelpCircle,
    cardCls: 'legal-comment-card--clarification_request',
    tagCls:  'legal-comment-type-label--clarification_request',
  },
};

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Single comment card with replies
// ---------------------------------------------------------------------------
function CommentCard({ comment }) {
  const meta  = TYPE_META[comment.type] ?? TYPE_META.advisor_comment;
  const TypeIcon = meta.Icon;

  return (
    <article
      className={`legal-comment-card ${meta.cardCls}`}
      aria-label={`${meta.label} on ${comment.sectionTitle}`}
    >
      {/* Header */}
      <div className="legal-comment-card-header">
        <span className={`legal-comment-type-label ${meta.tagCls}`}>
          <TypeIcon size={10} strokeWidth={2} style={{ display: 'inline', marginRight: 3 }} />
          {meta.label}
        </span>
        {comment.sectionTitle && (
          <span className="legal-comment-section-ref">
            {comment.sectionTitle}
          </span>
        )}
        <span className="legal-comment-author">{comment.author}</span>
        <span className="legal-comment-timestamp">{fmtTime(comment.createdAt)}</span>
      </div>

      {/* Body */}
      <div className="legal-comment-body">
        <p className="legal-comment-body-text">{comment.text}</p>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="legal-reply-list">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="legal-reply-entry">
              <div className="legal-reply-header">
                <span className="legal-reply-author">{reply.author || 'Unknown'}</span>
                {reply.createdAt && (
                  <span className="legal-reply-time">{fmtTime(reply.createdAt)}</span>
                )}
                {reply.status && (
                  <span className={`legal-reply-status-badge legal-reply-status-badge--${reply.status}`}>
                    {reply.status === 'answered'
                      ? <><CheckCircle2 size={11} strokeWidth={2} /> Answered</>
                      : <><Clock size={11} strokeWidth={2} /> Awaiting Reply</>}
                  </span>
                )}
              </div>
              {reply.text ? (
                <p className="legal-reply-text">{reply.text}</p>
              ) : (
                <p className="legal-awaiting-label">No reply yet — awaiting founder response.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const FILTER_OPTIONS = [
  { value: 'all',                   label: 'All' },
  { value: 'advisor_comment',       label: 'Advisor Comments' },
  { value: 'ai_flag',               label: 'AI Flags' },
  { value: 'clarification_request', label: 'Clarifications' },
];

export default function LegalComments() {
  const [comments, setComments] = useState([]);
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');

  useEffect(() => {
    fetchLegalComments().then(setComments);
  }, []);

  // Summary counts
  const aiCount      = comments.filter((c) => c.type === 'ai_flag').length;
  const humanCount   = comments.filter((c) => c.type !== 'ai_flag').length;
  const awaitingCount = comments.filter((c) =>
    (c.replies || []).some((r) => r.status === 'awaiting')
  ).length;

  const visible = comments.filter((c) => {
    const matchFilter = filter === 'all' || c.type === filter;
    const matchSearch = !search ||
      c.text.toLowerCase().includes(search.toLowerCase()) ||
      (c.sectionTitle || '').toLowerCase().includes(search.toLowerCase()) ||
      c.author.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="legal-page fade-in">
      <h1 className="legal-page-heading">Comments &amp; Threads</h1>
      <p className="legal-page-sub">
        All legal section discussions — advisor comments, clarification requests, and AI engine flags.
        AI-flagged items are clearly marked and never represent a human action.
      </p>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        <div className="legal-stat-card" style={{ flex: '1 1 130px', borderLeft: '3px solid var(--signal)' }}>
          <div className="legal-stat-value" style={{ color: 'var(--signal)', fontSize: '1.4rem' }}>{humanCount}</div>
          <div className="legal-stat-label">Human Comments</div>
        </div>
        <div className="legal-stat-card" style={{ flex: '1 1 130px', borderLeft: '3px solid var(--status-draft)' }}>
          <div className="legal-stat-value" style={{ color: 'var(--status-draft)', fontSize: '1.4rem' }}>{aiCount}</div>
          <div className="legal-stat-label">AI Engine Flags</div>
        </div>
        <div className="legal-stat-card" style={{ flex: '1 1 130px', borderLeft: '3px solid var(--status-pending)' }}>
          <div className="legal-stat-value" style={{ color: 'var(--status-pending)', fontSize: '1.4rem' }}>{awaitingCount}</div>
          <div className="legal-stat-label">Awaiting Reply</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="legal-toolbar">
        <input
          id="legal-comments-search"
          type="search"
          className="legal-search-input"
          placeholder="Search comments, sections, or authors…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search comments"
        />
      </div>

      {/* Filter bar */}
      <div className="legal-filter-bar" role="group" aria-label="Filter by comment type">
        <Filter size={12} strokeWidth={1.75} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
        {FILTER_OPTIONS.map((o) => (
          <button
            key={o.value}
            id={`comments-filter-${o.value}`}
            type="button"
            className={`legal-filter-btn ${filter === o.value ? 'active' : ''}`}
            onClick={() => setFilter(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Note about AI flag distinction */}
      {(filter === 'all' || filter === 'ai_flag') && aiCount > 0 && (
        <div className="legal-ai-flag-strip" style={{ marginBottom: 'var(--space-4)' }}>
          <span className="legal-ai-flag-label">Note</span>
          <div className="legal-ai-flag-body">
            <p className="legal-ai-flag-text">
              Items labelled <strong>"AI Engine Flag"</strong> are generated by the Gap Detection or Consistency Checker engine
              — they are <em>suggestions only</em> and do not represent a Legal Advisor action.
              To formally request changes based on an AI flag, go to the <strong>DRHP Sections</strong> page and use the
              "Formally Request Changes" button on the flag.
            </p>
          </div>
        </div>
      )}

      {/* Comment thread list */}
      {visible.length === 0 ? (
        <div className="legal-empty-state">
          <MessageSquare size={32} strokeWidth={1.25} className="legal-empty-icon" />
          <p className="legal-empty-text">
            {comments.length === 0 ? 'No comments yet.' : 'No comments match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="legal-comment-thread-list">
          {visible.map((comment) => (
            <CommentCard key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  );
}
