import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileWarning, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { getSectionReviewState } from '../../utils/reviewStatus.js';

const FILTERS = [
  { key: 'all',                label: 'All' },
  { key: 'needs_review',       label: 'Needs Review' },
  { key: 'changes_requested',  label: 'Changes Requested' },
  { key: 'compliance_issues',  label: 'Compliance Issues' },
  { key: 'evidence_missing',   label: 'Evidence Missing' },
  { key: 'approved',           label: 'Approved' },
];

const STATE_META = {
  approved:           { label: 'Approved',          color: 'var(--status-approved)' },
  under_review:       { label: 'Under Review',       color: 'var(--status-draft)' },
  changes_requested:  { label: 'Changes Requested',  color: 'var(--status-gap)' },
  not_started:        { label: 'Not Started',        color: 'var(--ink-faint)' },
};

export default function ReviewQueue({ sections = [], consistency }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');

  const consistencyFields = new Set((consistency?.checks || []).map((c) => c.field));

  // Loose heuristic: a consistency check's `field` name (e.g. "capital_structure_post_issue_cap")
  // rarely matches a section name directly, so this flags sections whose name
  // shares a significant word with an open check — good enough for a filter
  // chip, not a claim of precise per-section compliance status.
  function hasComplianceIssue(section) {
    const words = section.name.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
    return [...consistencyFields].some((field) => words.some((w) => field.includes(w)));
  }

  const rows = useMemo(() => sections.map((s) => ({
    ...s,
    reviewState: getSectionReviewState(s),
    missingCount: (s.missing_docs || []).length,
    gapCount: (s.flagged_gaps || []).length,
    hasComplianceIssue: hasComplianceIssue(s),
  })), [sections, consistency]);

  const filtered = rows.filter((s) => {
    switch (filter) {
      case 'needs_review':      return s.reviewState === 'under_review';
      case 'changes_requested': return s.reviewState === 'changes_requested';
      case 'compliance_issues': return s.hasComplianceIssue;
      case 'evidence_missing':  return s.missingCount > 0;
      case 'approved':          return s.reviewState === 'approved';
      default:                  return true;
    }
  });

  const handleReview = (sectionName) => {
    navigate('/workspace', { state: { jumpToSection: sectionName } });
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>Review Queue</h1>
        <span className="badge badge-accent">{rows.length}</span>
      </div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.875rem' }}>
        Sections needing your review, sorted by DRHP order.
      </p>

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-secondary'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 && (
          <div className="card" style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: '0.85rem' }}>
            No sections match this filter.
          </div>
        )}
        {filtered.map((s) => {
          const meta = STATE_META[s.reviewState];
          return (
            <div key={s.name} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)' }}>{s.name}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.72rem', color: 'var(--ink-soft)' }}>
                  <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                  {s.gapCount > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <FileWarning size={11} strokeWidth={2} /> {s.gapCount} gap{s.gapCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {s.missingCount > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <ShieldAlert size={11} strokeWidth={2} /> {s.missingCount} missing doc{s.missingCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {s.hasComplianceIssue && (
                    <span style={{ color: 'var(--status-gap)', fontWeight: 600 }}>Compliance issue</span>
                  )}
                </div>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--signal)', flexShrink: 0 }}>
                {Math.round((s.score || 0) * 100)}%
              </div>
              {s.reviewState === 'approved' ? (
                <span className="badge badge-success" style={{ flexShrink: 0 }}>
                  <CheckCircle2 size={12} strokeWidth={2} /> Locked
                </span>
              ) : (
                <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => handleReview(s.name)}>
                  Review <ArrowRight size={12} strokeWidth={2} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
