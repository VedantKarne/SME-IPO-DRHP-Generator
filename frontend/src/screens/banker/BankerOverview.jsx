import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, ArrowRight, AlertTriangle, CheckCircle2, Wallet, Scale, Users, ClipboardList,
} from 'lucide-react';
import ScoreRing from '../../components/ScoreRing.jsx';
import { countReviewStatuses, needsReview } from '../../utils/reviewStatus.js';

const SUBSCORES = [
  { key: 'financial_score',  label: 'Financials',  icon: Wallet },
  { key: 'legal_score',      label: 'Legal',        icon: Scale },
  { key: 'management_score', label: 'Management',   icon: Users },
  { key: 'overall_score',    label: 'Compliance',   icon: ClipboardList },
];

const REVIEW_STATUS_META = [
  { key: 'approved',          label: 'Approved',          color: 'var(--status-approved)' },
  { key: 'under_review',      label: 'Under Review',      color: 'var(--status-draft)' },
  { key: 'changes_requested', label: 'Changes Requested', color: 'var(--status-gap)' },
  { key: 'not_started',       label: 'Not Started',       color: 'var(--ink-faint)' },
];

export default function BankerOverview({ companyName, sections = [], readiness, eligibility, consistency }) {
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);

  const r = readiness || {};
  const overall = r.overall_score || 0;
  const statusCounts = countReviewStatuses(sections);

  const failedEligibility = (eligibility?.checks || []).filter((c) => !c.passed);
  const gappedSections = sections.filter((s) => (s.flagged_gaps || []).length > 0);
  const attentionItems = [
    ...(consistency?.checks || []).map((c) => ({
      kind: 'consistency', title: c.field.replace(/_/g, ' '), desc: c.fix,
      priority: c.severity === 'critical' ? 'High' : 'Medium',
    })),
    ...failedEligibility.map((c) => ({
      kind: 'eligibility', title: c.name, desc: c.reason || 'Eligibility condition not met.', priority: 'High',
    })),
    ...gappedSections.map((s) => ({
      kind: 'gap', title: s.name, desc: `${s.flagged_gaps.length} flagged gap${s.flagged_gaps.length > 1 ? 's' : ''}`,
      priority: 'Medium', sectionName: s.name,
    })),
  ];

  const reviewQueuePreview = sections.filter(needsReview).slice(0, 5);

  // Derived notifications — not a persisted system, just the real signals
  // above surfaced as a header dropdown (see PROJECT_CONTEXT.md scope note).
  const notifications = [
    ...attentionItems.slice(0, 3).map((a) => ({ level: 'high', text: a.title })),
    ...reviewQueuePreview.slice(0, 2).map((s) => ({ level: 'review', text: `${s.name} ready for review` })),
  ];

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div className="dashboard-company" style={{ marginBottom: 2 }}>{companyName || 'Loading company...'}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            SME IPO · Merchant Banker Review
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setNotifOpen((v) => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Bell size={14} strokeWidth={2} />
              {notifications.length > 0 && (
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, minWidth: 16, textAlign: 'center',
                  padding: '0 5px', borderRadius: 999, background: 'var(--signal)', color: '#fff',
                }}>
                  {notifications.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="card card-sm" style={{
                position: 'absolute', right: 0, top: '110%', width: 300, zIndex: 50,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: 10, color: 'var(--ink)' }}>Notifications</div>
                {notifications.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--ink-faint)', margin: 0 }}>Nothing needs your attention right now.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {notifications.map((n, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8rem' }}>
                        {n.level === 'high'
                          ? <AlertTriangle size={13} strokeWidth={2} color="var(--status-gap)" style={{ marginTop: 2, flexShrink: 0 }} />
                          : <CheckCircle2 size={13} strokeWidth={2} color="var(--status-draft)" style={{ marginTop: 2, flexShrink: 0 }} />}
                        <span style={{ color: 'var(--ink-soft)' }}>{n.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/workspace')}>
            View IPO
          </button>
        </div>
      </div>

      {/* IPO Readiness + Review Status */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="readiness-hero">
          <ScoreRing score={overall} />
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4, color: 'var(--ink)' }}>
              IPO Readiness
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: 16, maxWidth: 420 }}>
              {r.sections_approved ?? 0} / {r.total_sections ?? sections.length} sections approved.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, maxWidth: 460 }}>
              {REVIEW_STATUS_META.map(({ key, label, color }) => (
                <div key={key} className="stat-card">
                  <div className="stat-value" style={{ color }}>{statusCounts[key]}</div>
                  <div className="stat-label">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 24 }}>
          {SUBSCORES.map(({ key, label, icon: Icon }) => (
            <div key={key} className="card card-sm" style={{ textAlign: 'center' }}>
              <Icon size={18} strokeWidth={1.5} color="var(--signal)" style={{ marginBottom: 4 }} />
              <ScoreRing score={r[key] || 0} size={78} stroke={7} />
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--ink-soft)', marginTop: 8 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Attention Required */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={16} strokeWidth={1.75} color="var(--status-gap)" />
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>
              {attentionItems.length} issue{attentionItems.length === 1 ? '' : 's'} needing attention
            </h3>
          </div>
          {attentionItems.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--ink-faint)' }}>No open issues right now.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attentionItems.slice(0, 4).map((a, i) => {
                const isHigh = a.priority === 'High';
                return (
                  <div key={i} style={{
                    padding: '10px 12px',
                    background: isHigh ? 'var(--status-gap-soft)' : 'var(--status-draft-soft)',
                    borderLeft: `3px solid ${isHigh ? 'var(--status-gap)' : 'var(--status-draft)'}`,
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)', textTransform: 'capitalize' }}>{a.title}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isHigh ? 'var(--status-gap)' : 'var(--status-draft)', flexShrink: 0 }}>
                        {a.priority}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', margin: '4px 0 0' }}>{a.desc}</p>
                  </div>
                );
              })}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }} onClick={() => navigate('/banker/compliance')}>
                Review Compliance <ArrowRight size={12} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>

        {/* Review Queue preview */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>Review Queue</h3>
            <span className="badge badge-accent">{reviewQueuePreview.length}</span>
          </div>
          {reviewQueuePreview.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: 'var(--ink-faint)' }}>Nothing waiting on your review.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reviewQueuePreview.map((s) => (
                <div key={s.name} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: 'var(--paper-sunken)', borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>{s.name}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--signal)' }}>{Math.round((s.score || 0) * 100)}%</span>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => navigate('/banker/review-queue')}>
            View all <ArrowRight size={12} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
