/**
 * LegalReviewQueue.jsx
 *
 * Legal Advisor — Review Queue page (/legal/review).
 *
 * What it does:
 *   - Shows a prioritized worklist of items requiring Legal Advisor attention
 *   - Items are sections with gaps, unverified documents, or compliance issues
 *   - Each item shows: name, type tag, AI flag description, last-touched-by,
 *     status badge, and action buttons (Approve / Request Changes / View Section)
 *   - AI-flagged items explicitly label the flag as AI-suggested; the
 *     "Request Changes" button is always the Legal Advisor's own manual action
 *   - Items sorted by priority (ascending number = higher priority)
 *
 * All styles live in legal-dashboard.css (section 6 + shared).
 * Data: fetchReviewQueue() from legalApi.js
 */

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  FileEdit,
  Eye,
  Clock,
  AlertCircle,
  AlertTriangle,
  FileText,
  ClipboardList,
  User,
} from 'lucide-react';
import './legal-dashboard.css';
import { fetchReviewQueue, approveLegalSection, submitReview } from './legalApi';

// ---------------------------------------------------------------------------
// Item type icon
// ---------------------------------------------------------------------------
const ITEM_TYPE_META = {
  section:    { Icon: FileText,      label: 'Section' },
  document:   { Icon: FileEdit,      label: 'Document' },
  compliance: { Icon: ClipboardList, label: 'Compliance' },
};

// ---------------------------------------------------------------------------
// Status badge (reuse legal-status-badge CSS)
// ---------------------------------------------------------------------------
const STATUS_META = {
  issues:  { label: 'Issues Found', Icon: AlertCircle, cls: 'issues' },
  pending: { label: 'Pending',      Icon: Clock,       cls: 'pending' },
  clear:   { label: 'Clear',        Icon: CheckCircle2,cls: 'clear' },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const { Icon, label, cls } = meta;
  return (
    <span className={`legal-status-badge legal-status-badge--${cls}`}>
      <Icon size={11} strokeWidth={2} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Queue row component
// ---------------------------------------------------------------------------
function QueueRow({ item, onActionTaken }) {
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [done, setDone]         = useState(false);

  const typeMeta = ITEM_TYPE_META[item.itemType] ?? ITEM_TYPE_META.section;
  const TypeIcon = typeMeta.Icon;

  function showFeedback(msg, kind) {
    setFeedback({ msg, kind });
    setTimeout(() => setFeedback(null), 5000);
  }

  async function handleApprove() {
    if (item.itemType !== 'section') return;
    setLoading(true);
    const res = await approveLegalSection(item.drhpSectionId || item.itemId);
    setLoading(false);
    if (res.success) {
      setDone(true);
      showFeedback('Section approved.', 'success');
      onActionTaken?.({ item, action: 'approved' });
    } else {
      showFeedback(res.error || 'Approval failed.', 'error');
    }
  }

  async function handleRequestChanges() {
    const note = `Change request from review queue: ${item.flagDescription}`;
    setLoading(true);
    const res = await submitReview(item.drhpSectionId || item.itemId, note, true);
    setLoading(false);
    if (res.success) {
      showFeedback('Change request submitted.', 'success');
      onActionTaken?.({ item, action: 'change_requested' });
    } else {
      showFeedback(res.error || 'Submission failed.', 'error');
    }
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  const isAiFlag = item.lastTouchedBy?.toLowerCase().includes('engine');

  return (
    <div className={`legal-queue-row legal-queue-row--${item.status} ${done ? 'legal-queue-row--clear' : ''}`}>
      <div className="legal-queue-row-top">
        <div>
          <div className="legal-queue-name-row">
            <span
              style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--ink-faint)' }}
              aria-label={`Priority ${item.priority}`}
            >
              #{item.priority}
            </span>
            <span className="legal-queue-name">{item.name}</span>
            <span className="legal-queue-type-tag">
              <TypeIcon size={11} strokeWidth={1.75} style={{ display: 'inline', marginRight: 3 }} />
              {typeMeta.label}
            </span>
          </div>
        </div>
        <StatusBadge status={done ? 'clear' : item.status} />
      </div>

      {/* Flag description — if from AI engine, label it clearly */}
      <p className="legal-queue-flag-text">
        {isAiFlag && (
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--status-draft)', marginRight: 'var(--space-2)' }}>
            <AlertTriangle size={11} strokeWidth={2} style={{ display: 'inline', marginRight: 2 }} />
            AI Flag:
          </span>
        )}
        {item.flagDescription}
      </p>

      {/* Meta */}
      <div className="legal-queue-meta">
        <span className="legal-queue-meta-item">
          <User size={11} strokeWidth={1.75} />
          Last touched by: <strong style={{ color: 'var(--ink)' }}>{item.lastTouchedBy}</strong>
        </span>
        <span>·</span>
        <span className="legal-queue-meta-item">
          <Clock size={11} strokeWidth={1.75} />
          {fmtTime(item.lastTouchedAt)}
        </span>
      </div>

      {/* Feedback */}
      {feedback && (
        <p className={`legal-feedback legal-feedback--${feedback.kind}`} style={{ marginTop: 'var(--space-2)' }}>
          {feedback.msg}
        </p>
      )}

      {/* Action buttons — always manual */}
      {!done && (
        <div className="legal-queue-actions">
          {item.itemType === 'section' && (
            <button
              id={`queue-approve-${item.id}`}
              type="button"
              className="legal-btn-primary"
              onClick={handleApprove}
              disabled={loading}
            >
              <CheckCircle2 size={12} strokeWidth={2} />
              Approve
            </button>
          )}
          <button
            id={`queue-request-changes-${item.id}`}
            type="button"
            className="legal-btn-secondary"
            onClick={handleRequestChanges}
            disabled={loading}
            title={isAiFlag ? 'AI flagged this — click to formally request changes (your manual action required)' : 'Request changes on this item'}
          >
            <FileEdit size={12} strokeWidth={1.5} />
            {isAiFlag ? 'Formally Request Changes (AI-suggested)' : 'Request Changes'}
          </button>
          {item.drhpSectionId && (
            <button
              id={`queue-view-${item.id}`}
              type="button"
              className="legal-btn-secondary"
              onClick={() => window.location.href = '/legal/drhp'}
            >
              <Eye size={12} strokeWidth={1.5} />
              View Section
            </button>
          )}
        </div>
      )}
      {done && (
        <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--status-approved)' }}>
          <CheckCircle2 size={13} strokeWidth={2} />
          Action taken — this item can be removed from the queue in the next refresh.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LegalReviewQueue() {
  const [items, setItems]       = useState([]);
  const [filter, setFilter]     = useState('all');
  const [actionCount, setActionCount] = useState(0);

  useEffect(() => {
    fetchReviewQueue().then(setItems);
  }, []);

  function handleActionTaken({ item, action }) {
    setActionCount((c) => c + 1);
  }

  const FILTER_OPTIONS = [
    { value: 'all',     label: 'All' },
    { value: 'issues',  label: 'Issues' },
    { value: 'pending', label: 'Pending' },
  ];

  const visible = filter === 'all' ? items : items.filter((i) => i.status === filter);

  const issueCount  = items.filter((i) => i.status === 'issues').length;
  const pendingCount = items.filter((i) => i.status === 'pending').length;

  return (
    <div className="legal-page fade-in">
      <h1 className="legal-page-heading">Review Queue</h1>
      <p className="legal-page-sub">
        Prioritized list of sections, documents, and compliance items requiring your attention.
        AI-flagged items are clearly labelled — your manual action is always required.
      </p>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        <div className="legal-stat-card" style={{ flex: '1 1 140px', borderLeft: '3px solid var(--status-gap)' }}>
          <div className="legal-stat-value" style={{ color: 'var(--status-gap)', fontSize: '1.4rem' }}>{issueCount}</div>
          <div className="legal-stat-label">Items with Issues</div>
        </div>
        <div className="legal-stat-card" style={{ flex: '1 1 140px', borderLeft: '3px solid var(--status-pending)' }}>
          <div className="legal-stat-value" style={{ color: 'var(--status-pending)', fontSize: '1.4rem' }}>{pendingCount}</div>
          <div className="legal-stat-label">Pending Review</div>
        </div>
        <div className="legal-stat-card" style={{ flex: '1 1 140px', borderLeft: '3px solid var(--status-approved)' }}>
          <div className="legal-stat-value" style={{ color: 'var(--status-approved)', fontSize: '1.4rem' }}>{actionCount}</div>
          <div className="legal-stat-label">Actions Taken This Session</div>
        </div>
      </div>

      {/* Filter */}
      <div className="legal-filter-bar" role="group" aria-label="Filter queue by status">
        {FILTER_OPTIONS.map((o) => (
          <button
            key={o.value}
            id={`queue-filter-${o.value}`}
            type="button"
            className={`legal-filter-btn ${filter === o.value ? 'active' : ''}`}
            onClick={() => setFilter(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Queue list */}
      {visible.length === 0 ? (
        <div className="legal-empty-state">
          <CheckCircle2 size={32} strokeWidth={1.25} className="legal-empty-icon" />
          <p className="legal-empty-text">
            {items.length === 0 ? 'Review queue is loading…' : 'No items match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="legal-queue-list">
          {visible.map((item) => (
            <QueueRow
              key={item.id}
              item={item}
              onActionTaken={handleActionTaken}
            />
          ))}
        </div>
      )}
    </div>
  );
}
