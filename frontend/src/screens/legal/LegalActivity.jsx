/**
 * LegalActivity.jsx
 *
 * Legal Advisor — Activity Log page (/legal/activity).
 *
 * What it does:
 *   - Shows a chronological audit trail of all legal-scope events
 *   - Events include: section approvals, change requests, comments, document
 *     uploads, AI engine flags, and clarification sends
 *   - Timeline format: coloured 10px dot + actor + action description + timestamp
 *   - Role tag on each entry (legal_advisor | engine)
 *   - Events are compatible with the shared audit trail format used by the
 *     Merchant Banker flow: { timestamp, actor, role, action }
 *     Legal Advisor actions are logged in this same shape for cross-team merge.
 *   - Filter by action type
 *
 * Audit Trail Sync Note (from project brief):
 *   Legal Advisor actions must be emitted in the shape:
 *     { timestamp, actor, role: "Legal Advisor", action: "..." }
 *   so they can be merged into the shared Reports audit trail alongside
 *   Merchant Banker and CA actions.
 *
 * All styles live in legal-dashboard.css (section 8 + shared).
 * Data: fetchLegalActivity() from legalApi.js
 */

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  FileEdit,
  Upload,
  MessageSquare,
  AlertTriangle,
  Send,
  Activity,
  Filter,
} from 'lucide-react';
import './legal-dashboard.css';
import { fetchLegalActivity } from './legalApi';

// ---------------------------------------------------------------------------
// Action type metadata → icon + text + timeline-dot CSS class
// ---------------------------------------------------------------------------
const ACTION_META = {
  section_approved: {
    label:   'approved section',
    Icon:    CheckCircle2,
    dotCls:  'legal-timeline-dot--section_approved',
  },
  changes_requested: {
    label:   'requested changes on',
    Icon:    FileEdit,
    dotCls:  'legal-timeline-dot--changes_requested',
  },
  document_uploaded: {
    label:   'uploaded document for',
    Icon:    Upload,
    dotCls:  'legal-timeline-dot--document_uploaded',
  },
  ai_flag_raised: {
    label:   '(AI) flagged issue on',
    Icon:    AlertTriangle,
    dotCls:  'legal-timeline-dot--ai_flag_raised',
  },
  comment_added: {
    label:   'commented on',
    Icon:    MessageSquare,
    dotCls:  'legal-timeline-dot--comment_added',
  },
  clarification_sent: {
    label:   'sent clarification request for',
    Icon:    Send,
    dotCls:  'legal-timeline-dot--clarification_sent',
  },
};

const ROLE_LABEL = {
  legal_advisor: 'Legal Advisor',
  engine:        'AI Engine',
};

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Single activity entry
// ---------------------------------------------------------------------------
function ActivityEntry({ entry }) {
  const meta   = ACTION_META[entry.actionType] ?? { label: entry.actionType, Icon: Activity, dotCls: '' };
  const EntryIcon = meta.Icon;
  const roleLabel = ROLE_LABEL[entry.actorRole] ?? entry.actorRole;

  return (
    <div className="legal-activity-entry">
      {/* Left: timeline dot */}
      <div className="legal-activity-entry-left">
        <span className={`legal-timeline-dot ${meta.dotCls}`} aria-hidden="true" />
      </div>

      {/* Right: content */}
      <div className="legal-activity-entry-right">
        <div className="legal-activity-entry-header">
          <span className="legal-activity-actor">{entry.actor}</span>
          <span className="legal-actor-role-tag">{roleLabel}</span>
          <span className="legal-activity-action-desc">{meta.label}</span>
          <span className="legal-activity-target">{entry.target}</span>
          <span className="legal-activity-timestamp">{fmtTime(entry.timestamp)}</span>
        </div>
        {entry.detail && (
          <p className="legal-activity-detail">{entry.detail}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const FILTER_OPTIONS = [
  { value: 'all',                label: 'All' },
  { value: 'section_approved',   label: 'Approvals' },
  { value: 'changes_requested',  label: 'Change Requests' },
  { value: 'comment_added',      label: 'Comments' },
  { value: 'document_uploaded',  label: 'Uploads' },
  { value: 'ai_flag_raised',     label: 'AI Flags' },
  { value: 'clarification_sent', label: 'Clarifications' },
];

export default function LegalActivity() {
  const [entries, setEntries]   = useState([]);
  const [filter, setFilter]     = useState('all');

  useEffect(() => {
    fetchLegalActivity().then(setEntries);
  }, []);

  const visible = filter === 'all'
    ? entries
    : entries.filter((e) => e.actionType === filter);

  // Human action count (excludes engine flags)
  const humanCount  = entries.filter((e) => e.actorRole === 'legal_advisor').length;
  const engineCount = entries.filter((e) => e.actorRole === 'engine').length;

  return (
    <div className="legal-page fade-in">
      <h1 className="legal-page-heading">Activity Log</h1>
      <p className="legal-page-sub">
        Chronological audit trail of all legal advisor actions and AI engine events.
        This log feeds into the shared Reports audit trail in the
        format: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', background: 'var(--paper-sunken)', padding: '1px 4px', borderRadius: 3 }}>
          {'{ timestamp, actor, role, action }'}
        </code>
      </p>

      {/* Audit trail format note for cross-team awareness */}
      <div className="legal-ai-flag-strip" style={{ marginBottom: 'var(--space-5)' }}>
        <span className="legal-ai-flag-label">Audit Trail</span>
        <div className="legal-ai-flag-body">
          <p className="legal-ai-flag-text">
            Legal Advisor actions in this log are emitted in the shared audit trail shape used by all roles
            (<strong>timestamp · actor · role · action</strong>). When the Reports page is merged, these entries
            will be combined with Merchant Banker and CA actions into a single unified log.
          </p>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        <div className="legal-stat-card" style={{ flex: '1 1 130px', borderLeft: '3px solid var(--signal)' }}>
          <div className="legal-stat-value" style={{ color: 'var(--signal)', fontSize: '1.4rem' }}>{humanCount}</div>
          <div className="legal-stat-label">Advisor Actions</div>
        </div>
        <div className="legal-stat-card" style={{ flex: '1 1 130px', borderLeft: '3px solid var(--status-draft)' }}>
          <div className="legal-stat-value" style={{ color: 'var(--status-draft)', fontSize: '1.4rem' }}>{engineCount}</div>
          <div className="legal-stat-label">AI Engine Events</div>
        </div>
        <div className="legal-stat-card" style={{ flex: '1 1 130px', borderLeft: '3px solid var(--ink-faint)' }}>
          <div className="legal-stat-value" style={{ color: 'var(--ink-soft)', fontSize: '1.4rem' }}>{entries.length}</div>
          <div className="legal-stat-label">Total Events</div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="legal-filter-bar" role="group" aria-label="Filter activity by type">
        <Filter size={12} strokeWidth={1.75} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
        {FILTER_OPTIONS.map((o) => (
          <button
            key={o.value}
            id={`activity-filter-${o.value}`}
            type="button"
            className={`legal-filter-btn ${filter === o.value ? 'active' : ''}`}
            onClick={() => setFilter(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {visible.length === 0 ? (
        <div className="legal-empty-state">
          <Activity size={32} strokeWidth={1.25} className="legal-empty-icon" />
          <p className="legal-empty-text">
            {entries.length === 0 ? 'No activity recorded yet.' : 'No entries match the current filter.'}
          </p>
        </div>
      ) : (
        <div className="legal-action-history" style={{ borderTop: 'none' }}>
          <div className="legal-activity-timeline">
            {visible.map((entry) => (
              <ActivityEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
