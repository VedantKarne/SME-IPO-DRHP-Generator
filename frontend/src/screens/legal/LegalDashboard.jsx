/**
 * LegalDashboard.jsx
 *
 * Dashboard page for users who sign in with the "Legal Advisor" role.
 *
 * Layout (top to bottom):
 *   1. Page heading + subtitle
 *   2. Legal Review summary panel -- score ring + 3 metric stat cards
 *   3. Priority Areas list -- 3 fixed-height rows, each with a 6px status
 *      dot, label, note, and status badge (icon + text)
 *   4. Legal Content Area cards -- 6 cards with a 3px left-border status
 *      indicator, description, meta row, and 4 action buttons (UI-only,
 *      no functional logic in this phase)
 *
 * Design system compliance (design-system.md):
 *   - All colours use CSS variable tokens (--signal, --status-*, --ink*, etc.)
 *   - Score ring: single --signal stroke, SVG circle mechanic -- matches
 *     the ScoreRing in Dashboard.jsx exactly
 *   - Status indicators: 6px dot in rows, 3px left-border on cards
 *   - Never more than one primary button visible per card
 *   - No inline hardcoded colour/spacing values -- all in legal-dashboard.css
 *     (fontSize on the ring number is a math calculation, not a design token)
 *
 * Styles:     ./legal-dashboard.css
 * Mock data:  ./legalMockData.js  (replace with API calls in Phase 2)
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  AlertTriangle,
  CheckCircle2,
  FileEdit,
  MessageSquare,
  Eye,
  CalendarDays,
  User,
  AlertCircle,
  Clock,
  ArrowRight,
  Upload,
  Send,
} from 'lucide-react';
import './legal-dashboard.css';
import {
  fetchDashboardSummary,
  fetchLegalFlags,
  fetchRecentActivity,
} from './legalApi';
import { LEGAL_CONTENT_AREAS } from './legalMockData';

// ---------------------------------------------------------------------------
// Score Ring
// Replicates ScoreRing from Dashboard.jsx: single --signal stroke, SVG
// circle mechanic, animated on mount. The fontSize prop is a math
// calculation derived from `size`, so it stays as an inline style.
// ---------------------------------------------------------------------------
function LegalScoreRing({ score, size = 120, stroke = 9 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [anim, setAnim] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnim(score), 300);
    return () => clearTimeout(t);
  }, [score]);

  const filled = circ * (1 - anim / 100);

  return (
    <div className="readiness-ring-wrap" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        aria-label={`Legal readiness: ${score}%`}
        style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
      >
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="var(--paper-sunken)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="var(--signal)"
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={filled}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s ease' }}
        />
      </svg>
      <div className="readiness-ring-label">
        <span className="readiness-pct" style={{ fontSize: size * 0.28, lineHeight: 1 }}>
          {score}%
        </span>
        <span className="legal-ring-sub-label">LEGAL</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status metadata
// Maps status key to: Lucide icon, text label, and CSS class suffixes.
// Icons match the pattern used in Dashboard.jsx for visual consistency.
// ---------------------------------------------------------------------------
const STATUS_META = {
  issues: {
    label:      'Issues Found',
    Icon:       AlertCircle,
    dotClass:   'legal-status-dot--issues',
    badgeClass: 'legal-status-badge--issues',
  },
  pending: {
    label:      'Pending',
    Icon:       Clock,
    dotClass:   'legal-status-dot--pending',
    badgeClass: 'legal-status-badge--pending',
  },
  clear: {
    label:      'Clear',
    Icon:       CheckCircle2,
    dotClass:   'legal-status-dot--clear',
    badgeClass: 'legal-status-badge--clear',
  },
  draft: {
    label:      'Draft',
    Icon:       FileEdit,
    dotClass:   'legal-status-dot--draft',
    badgeClass: 'legal-status-badge--draft',
  },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const { Icon, label, badgeClass } = meta;
  return (
    <span className={`legal-status-badge ${badgeClass}`}>
      <Icon size={11} strokeWidth={2} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Content area card
// One card per legal DRHP area. 3px left-border encodes status.
// Approve / Request Changes / Add Comment → navigate to /legal/drhp
// View Evidence → navigate to /legal/documents
// ---------------------------------------------------------------------------
function LegalContentCard({ area, onNavigate }) {
  return (
    <article
      className={`legal-content-card legal-content-card--${area.status}`}
      aria-label={area.title}
    >
      {/* Top row: title + issue badge + section tag + status badge */}
      <div className="legal-card-top">
        <div className="legal-card-title-block">
          <div className="legal-card-title-row">
            <h3 className="legal-card-title">{area.title}</h3>
            {area.issueCount > 0 && (
              <span className="legal-issue-count">
                {area.issueCount} issue{area.issueCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="legal-card-section-tag">{area.section}</div>
        </div>
        <StatusBadge status={area.status} />
      </div>

      {/* Description */}
      <p className="legal-card-desc">{area.description}</p>

      {/* Meta row */}
      <div className="legal-card-meta">
        <span className="legal-card-meta-item">
          <CalendarDays size={12} strokeWidth={1.5} />
          Updated {area.lastUpdated}
        </span>
        <span className="legal-card-meta-sep" aria-hidden="true">&middot;</span>
        <span className="legal-card-meta-item">
          <User size={12} strokeWidth={1.5} />
          {area.reviewedBy ?? 'Unassigned'}
        </span>
      </div>

      {/* Action buttons — navigate to DRHP Sections page where full actions are available */}
      <div className="legal-card-actions">
        <button
          id={`legal-approve-${area.id}`}
          type="button"
          className="legal-btn-primary"
          aria-label={`Approve ${area.title}`}
          onClick={() => onNavigate('/legal/drhp')}
        >
          <CheckCircle2 size={12} strokeWidth={2} />
          Approve
        </button>
        <button
          id={`legal-changes-${area.id}`}
          type="button"
          className="legal-btn-secondary"
          aria-label={`Request changes for ${area.title}`}
          onClick={() => onNavigate('/legal/drhp')}
        >
          <FileEdit size={12} strokeWidth={1.5} />
          Request Changes
        </button>
        <button
          id={`legal-comment-${area.id}`}
          type="button"
          className="legal-btn-secondary"
          aria-label={`Add comment to ${area.title}`}
          onClick={() => onNavigate('/legal/drhp')}
        >
          <MessageSquare size={12} strokeWidth={1.5} />
          Add Comment
        </button>
        <button
          id={`legal-evidence-${area.id}`}
          type="button"
          className="legal-btn-secondary"
          aria-label={`View evidence for ${area.title}`}
          onClick={() => onNavigate('/legal/documents')}
        >
          <Eye size={12} strokeWidth={1.5} />
          View Evidence
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Recent activity dot
// ---------------------------------------------------------------------------
const ACTIVITY_DOT_CLS = {
  section_approved:   'legal-recent-type-dot--section_approved',
  changes_requested:  'legal-recent-type-dot--changes_requested',
  document_uploaded:  'legal-recent-type-dot--document_uploaded',
  ai_flag_raised:     'legal-recent-type-dot--ai_flag_raised',
  comment_added:      'legal-recent-type-dot--comment_added',
  clarification_sent: 'legal-recent-type-dot--clarification_sent',
};

const ACTIVITY_VERB = {
  section_approved:   'approved',
  changes_requested:  'requested changes on',
  document_uploaded:  'uploaded a document for',
  ai_flag_raised:     '(AI) flagged issue on',
  comment_added:      'commented on',
  clarification_sent: 'sent clarification for',
};

function fmtRelTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LegalDashboard() {
  const navigate = useNavigate();

  const [score, setScore]         = useState(0);
  const [stats, setStats]         = useState([]);
  const [flags, setFlags]         = useState([]);
  const [activity, setActivity]   = useState([]);

  useEffect(() => {
    // Fetch from legalApi — tries real backend first, falls back to mock.
    fetchDashboardSummary().then((d) => {
      setScore(d.readinessScore);
      setStats([
        { label: 'Sections Reviewed', value: d.sectionsReviewed },
        { label: 'Pending Review',    value: d.pendingReview },
        { label: 'Issues Found',      value: d.issuesFound },
      ]);
    });
    fetchLegalFlags().then(setFlags);
    fetchRecentActivity(4).then(setActivity);
  }, []);

  return (
    <div className="legal-dashboard fade-in">

      {/* Heading */}
      <h1 className="legal-dashboard-heading">Legal Review</h1>
      <p className="legal-dashboard-sub">
        Review and sign off on legal disclosures in the DRHP draft.
      </p>

      {/* 1. Summary panel ------------------------------------------------- */}
      <div className="legal-summary-panel">
        <div className="legal-summary-ring-col">
          <LegalScoreRing score={score} />
          <span className="legal-summary-ring-label">Legal Readiness</span>
        </div>
        <div className="legal-summary-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="legal-stat-card">
              <div className="legal-stat-value">{stat.value}</div>
              <div className="legal-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Priority panel ------------------------------------------------ */}
      <div className="legal-priority-panel">
        <div className="legal-panel-header">
          <AlertTriangle size={14} strokeWidth={1.75} className="legal-panel-header-icon" />
          <span className="legal-panel-title">Priority Areas</span>
          <button
            id="dashboard-view-review-queue"
            type="button"
            className="legal-btn-secondary"
            style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)' }}
            onClick={() => navigate('/legal/review')}
          >
            View Queue <ArrowRight size={11} strokeWidth={2} />
          </button>
        </div>
        {flags.map((item) => {
          const meta = STATUS_META[item.status] ?? STATUS_META.pending;
          return (
            <div key={item.id} className="legal-priority-row" role="listitem">
              <span className={`legal-status-dot ${meta.dotClass}`} aria-hidden="true" />
              <span className="legal-priority-label">{item.label}</span>
              <span className="legal-priority-note">{item.note}</span>
              <StatusBadge status={item.status} />
            </div>
          );
        })}
      </div>

      {/* 3. Content area cards -------------------------------------------- */}
      <div className="legal-content-section-title">
        <FileText size={14} strokeWidth={1.75} className="legal-section-icon" />
        Legal Content Areas
      </div>
      <div className="legal-content-grid">
        {LEGAL_CONTENT_AREAS.map((area) => (
          <LegalContentCard key={area.id} area={area} onNavigate={navigate} />
        ))}
      </div>

      {/* 4. Recent activity ---------------------------------------------- */}
      {activity.length > 0 && (
        <div className="legal-recent-panel">
          <div className="legal-panel-header">
            <Clock size={13} strokeWidth={1.75} style={{ color: 'var(--ink-soft)', flexShrink: 0 }} />
            <span className="legal-panel-title">Recent Activity</span>
            <button
              id="dashboard-view-all-activity"
              type="button"
              className="legal-btn-secondary"
              style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)' }}
              onClick={() => navigate('/legal/activity')}
            >
              View All <ArrowRight size={11} strokeWidth={2} />
            </button>
          </div>
          {activity.map((entry) => (
            <div key={entry.id} className="legal-recent-row">
              <span
                className={`legal-recent-type-dot ${ACTIVITY_DOT_CLS[entry.actionType] ?? ''}`}
                aria-hidden="true"
              />
              <span className="legal-recent-actor">{entry.actor}</span>
              <span className="legal-recent-action-text">
                {ACTIVITY_VERB[entry.actionType] ?? entry.actionType} <strong>{entry.target}</strong>
              </span>
              <span className="legal-recent-time">{fmtRelTime(entry.timestamp)}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
