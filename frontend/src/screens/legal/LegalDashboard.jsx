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
} from 'lucide-react';
import './legal-dashboard.css';
import {
  LEGAL_READINESS_SCORE,
  LEGAL_SUMMARY_STATS,
  LEGAL_PRIORITY_ITEMS,
  LEGAL_CONTENT_AREAS,
} from './legalMockData';

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
// One primary button (Approve) per card; three secondary buttons.
// Buttons are UI-only -- no onClick handlers in this phase.
// ---------------------------------------------------------------------------
function LegalContentCard({ area }) {
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

      {/* Action buttons -- UI controls only, no functional logic this phase */}
      <div className="legal-card-actions">
        <button
          id={`legal-approve-${area.id}`}
          type="button"
          className="legal-btn-primary"
          aria-label={`Approve ${area.title}`}
        >
          <CheckCircle2 size={12} strokeWidth={2} />
          Approve
        </button>
        <button
          id={`legal-changes-${area.id}`}
          type="button"
          className="legal-btn-secondary"
          aria-label={`Request changes for ${area.title}`}
        >
          <FileEdit size={12} strokeWidth={1.5} />
          Request Changes
        </button>
        <button
          id={`legal-comment-${area.id}`}
          type="button"
          className="legal-btn-secondary"
          aria-label={`Add comment to ${area.title}`}
        >
          <MessageSquare size={12} strokeWidth={1.5} />
          Add Comment
        </button>
        <button
          id={`legal-evidence-${area.id}`}
          type="button"
          className="legal-btn-secondary"
          aria-label={`View evidence for ${area.title}`}
        >
          <Eye size={12} strokeWidth={1.5} />
          View Evidence
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LegalDashboard() {
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
          <LegalScoreRing score={LEGAL_READINESS_SCORE} />
          <span className="legal-summary-ring-label">Legal Readiness</span>
        </div>
        <div className="legal-summary-stats">
          {LEGAL_SUMMARY_STATS.map((stat) => (
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
        </div>
        {LEGAL_PRIORITY_ITEMS.map((item) => {
          const meta = STATUS_META[item.status] ?? STATUS_META.pending;
          return (
            <div key={item.id} className="legal-priority-row">
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
          <LegalContentCard key={area.id} area={area} />
        ))}
      </div>

    </div>
  );
}
