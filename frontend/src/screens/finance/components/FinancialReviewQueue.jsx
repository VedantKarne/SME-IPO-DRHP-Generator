// "Financial Review Queue" list: one row per financial DRHP area, each with
// a status indicator (icon + color, per design-system.md's rule that status
// colors appear only as small dots / thin left-borders / text — never a
// filled badge or full-card background) and a Review/View action.
//
// Row background/border/text colors live in finance.css as status modifier
// classes; the lucide icon `color` prop is the one exception, matching the
// same convention already used for icon coloring throughout the app (e.g.
// components/GlobalSidebar.jsx, screens/Dashboard.jsx).
import { CheckCircle2, AlertTriangle, Clock, Circle } from 'lucide-react';

export const STATUS_CONFIG = {
  verified: {
    label: 'Verified',
    icon: CheckCircle2,
    color: 'var(--status-approved)',
    action: 'View',
  },
  issues: {
    label: 'Has issues',
    icon: AlertTriangle,
    color: 'var(--status-gap)',
    action: 'Review',
  },
  pending: {
    label: 'Pending verification',
    icon: Clock,
    color: 'var(--status-draft)',
    action: 'Review',
  },
  not_reviewed: {
    label: 'Not reviewed',
    icon: Circle,
    color: 'var(--status-pending)',
    action: 'Review',
  },
};

// `onAction`, when passed, is called with the item when its Review/View
// button is clicked (used by the full Review Queue page). Omitted on the
// Dashboard's read-only preview, where the buttons render but do nothing —
// matching the Founder Dashboard's own read-only preview panels, which
// link out to a full page ("Full Report →") rather than acting inline.
export default function FinancialReviewQueue({ items, onAction, title = 'Financial Review Queue' }) {
  return (
    <div className="card">
      <h3 style={{ marginBottom: 14, fontSize: '0.95rem', color: 'var(--ink)' }}>{title}</h3>
      {items.length === 0 ? (
        <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>No financial sections drafted yet.</p>
      ) : (
        <div className="finance-queue">
          {items.map((item) => {
            const cfg = STATUS_CONFIG[item.review_status];
            const Icon = cfg.icon;
            return (
              <div key={item.id} className={`finance-queue-row finance-queue-row--${item.review_status}`}>
                <Icon size={16} strokeWidth={1.5} color={cfg.color} className="finance-queue-icon" />
                <div className="finance-queue-info">
                  <div className="finance-queue-area">{item.area}</div>
                  <div className={`finance-queue-status finance-queue-status--${item.review_status}`}>
                    {cfg.label}
                    {item.issue_count > 0 ? ` · ${item.issue_count} issue${item.issue_count > 1 ? 's' : ''}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onAction ? () => onAction(item) : undefined}
                >
                  {cfg.action}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
