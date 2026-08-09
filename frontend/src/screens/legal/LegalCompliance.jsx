/**
 * LegalCompliance.jsx
 *
 * Legal Advisor — Compliance Matrix page (/legal/compliance).
 *
 * What it does:
 *   - Shows a filterable compliance matrix of SEBI ICDR legal requirements
 *   - Status can be compliant | needs_review | non_compliant
 *   - Filter bar: All | Compliant | Needs Review | Non-Compliant
 *   - Each row shows: requirement, regulation, status dot+text, evidence, DRHP
 *     section link, notes, and a clause reference chip
 *   - Data: fetchComplianceItems() from legalApi.js (mock until engine live)
 *
 * Legal Advisor CANNOT:
 *   - Modify SEBI regulation/compliance rule content
 *   - Approve financial sections (not shown here)
 *
 * All styles live in legal-dashboard.css (section 5 + shared).
 */

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import './legal-dashboard.css';
import { fetchComplianceItems } from './legalApi';

// ---------------------------------------------------------------------------
// Status metadata
// ---------------------------------------------------------------------------
const STATUS_META = {
  compliant:     { label: 'Compliant',     Icon: CheckCircle2, cls: 'compliant' },
  needs_review:  { label: 'Needs Review',  Icon: Clock,        cls: 'needs_review' },
  non_compliant: { label: 'Non-Compliant', Icon: XCircle,      cls: 'non_compliant' },
};

function ComplianceStatus({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.needs_review;
  const { label, Icon, cls } = meta;
  return (
    <span className={`legal-compliance-status legal-compliance-status--${cls}`}>
      <span className={`legal-compliance-dot legal-compliance-dot--${cls}`} aria-hidden="true" />
      <Icon size={11} strokeWidth={2} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Summary counters above the table
// ---------------------------------------------------------------------------
function SummaryBar({ items }) {
  const counts = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const stats = [
    { key: 'compliant',     label: 'Compliant',     color: 'var(--status-approved)' },
    { key: 'needs_review',  label: 'Needs Review',  color: 'var(--status-draft)' },
    { key: 'non_compliant', label: 'Non-Compliant', color: 'var(--status-gap)' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
      {stats.map(({ key, label, color }) => (
        <div key={key} className="legal-stat-card" style={{ borderLeft: `3px solid ${color}` }}>
          <div className="legal-stat-value" style={{ color, fontSize: '1.4rem' }}>
            {counts[key] || 0}
          </div>
          <div className="legal-stat-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const FILTER_OPTIONS = [
  { value: 'all',           label: 'All' },
  { value: 'compliant',     label: 'Compliant' },
  { value: 'needs_review',  label: 'Needs Review' },
  { value: 'non_compliant', label: 'Non-Compliant' },
];

export default function LegalCompliance() {
  const [items, setItems]     = useState([]);
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');

  useEffect(() => {
    fetchComplianceItems().then(setItems);
  }, []);

  const visible = items.filter((item) => {
    const matchFilter = filter === 'all' || item.status === filter;
    const matchSearch = !search ||
      item.requirement.toLowerCase().includes(search.toLowerCase()) ||
      item.regulation.toLowerCase().includes(search.toLowerCase()) ||
      (item.notes || '').toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="legal-page fade-in">
      <h1 className="legal-page-heading">Compliance Matrix</h1>
      <p className="legal-page-sub">
        SEBI ICDR legal requirements mapped to DRHP sections and their current compliance status.
        AI-flagged issues are surfaced here as suggestions — the Legal Advisor reviews and acts manually.
      </p>

      {/* Summary bar */}
      <SummaryBar items={items} />

      {/* Toolbar */}
      <div className="legal-toolbar">
        <input
          id="legal-compliance-search"
          type="search"
          className="legal-search-input"
          placeholder="Search requirements or regulations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search compliance items"
        />
      </div>

      {/* Filter bar */}
      <div className="legal-filter-bar" role="group" aria-label="Filter by compliance status">
        <Filter size={12} strokeWidth={1.75} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
        {FILTER_OPTIONS.map((o) => (
          <button
            key={o.value}
            id={`compliance-filter-${o.value}`}
            type="button"
            className={`legal-filter-btn ${filter === o.value ? 'active' : ''}`}
            onClick={() => setFilter(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Compliance table */}
      <div className="legal-compliance-table-wrap">
        <table className="legal-compliance-table" aria-label="Legal compliance matrix">
          <thead>
            <tr>
              <th className="legal-compliance-th">Requirement</th>
              <th className="legal-compliance-th">Regulation</th>
              <th className="legal-compliance-th">Status</th>
              <th className="legal-compliance-th">Evidence</th>
              <th className="legal-compliance-th">DRHP Section</th>
              <th className="legal-compliance-th">Notes</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="legal-empty-state">
                    <ShieldCheck size={32} strokeWidth={1.25} className="legal-empty-icon" />
                    <p className="legal-empty-text">
                      {items.length === 0
                        ? 'No compliance data loaded yet.'
                        : 'No items match the current filter.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              visible.map((item) => (
                <tr key={item.id} className="legal-compliance-row">
                  <td className="legal-compliance-td legal-compliance-td--req">
                    {item.requirement}
                    {item.clauseRef && (
                      <div style={{ marginTop: 'var(--space-1)' }}>
                        <span className="legal-clause-chip">{item.clauseRef}</span>
                      </div>
                    )}
                  </td>
                  <td className="legal-compliance-td" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                    {item.regulation}
                  </td>
                  <td className="legal-compliance-td" style={{ whiteSpace: 'nowrap' }}>
                    <ComplianceStatus status={item.status} />
                  </td>
                  <td className="legal-compliance-td legal-compliance-td--meta">
                    {item.evidence ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-xs)', color: 'var(--ink-soft)' }}>
                        <FileText size={11} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                        {item.evidence}
                      </span>
                    ) : (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>—</span>
                    )}
                  </td>
                  <td className="legal-compliance-td">
                    {item.drhpSectionId ? (
                      <button
                        type="button"
                        className="legal-section-link"
                        onClick={() => window.location.href = '/legal/drhp'}
                        title="Go to DRHP section"
                      >
                        View Section →
                      </button>
                    ) : (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>—</span>
                    )}
                  </td>
                  <td className="legal-compliance-td legal-compliance-td--notes">
                    {item.notes || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--ink-faint)' }}>
        ⓘ Compliance data is currently from the mock layer. This table will reflect live Compliance Engine output once that endpoint is available.
      </p>
    </div>
  );
}
