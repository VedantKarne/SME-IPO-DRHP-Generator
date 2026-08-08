import { useState, useEffect } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, GitBranch } from 'lucide-react';
import * as canvasApi from '../../canvas/services/canvasApi.js';

// The 4 keys src/api/impact_router.py's IMPACT_MAP actually recognizes —
// see PROJECT_CONTEXT.md: this is a static dependency lookup, not a live
// SEBI regulation-change feed, so it's labeled "Data Dependency Map" here
// rather than "Regulatory Updates".
const IMPACT_KEYS = [
  { key: 'total_issue_size_lakhs', label: 'Total Issue Size' },
  { key: 'ebitda_lakhs',           label: 'EBITDA' },
  { key: 'litigation',             label: 'Litigation' },
  { key: 'registered_office',      label: 'Registered Office' },
];

export default function Compliance({ eligibility, consistency }) {
  const [impacts, setImpacts] = useState(null);

  useEffect(() => {
    Promise.all(IMPACT_KEYS.map(({ key }) => canvasApi.getImpact(key).catch(() => ({ changed_field: key, affected_sections: [] }))))
      .then((results) => setImpacts(results));
  }, []);

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 4 }}>Compliance</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.875rem' }}>
        Eligibility, cross-document consistency, and data dependencies for this filing.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Eligibility */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <ShieldCheck size={16} strokeWidth={1.75} color="var(--signal)" />
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>SEBI ICDR Eligibility</h3>
          </div>
          {!eligibility ? (
            <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eligibility.checks.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--rule)' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>{c.name}</div>
                    {!c.passed && <div style={{ fontSize: '0.72rem', color: 'var(--status-gap)', marginTop: 2 }}>{c.reason}</div>}
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600, color: c.passed ? 'var(--status-approved)' : 'var(--status-gap)', flexShrink: 0 }}>
                    {c.passed ? <CheckCircle2 size={14} strokeWidth={2} /> : <XCircle size={14} strokeWidth={2} />}
                    {c.passed ? 'Pass' : 'Fail'}
                  </span>
                </div>
              ))}
              <div style={{
                marginTop: 6, padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                background: eligibility.eligible ? 'var(--status-approved-soft)' : 'var(--status-gap-soft)',
                fontSize: '0.82rem', fontWeight: 600,
                color: eligibility.eligible ? 'var(--status-approved)' : 'var(--status-gap)',
              }}>
                {eligibility.eligible ? 'Eligible for SME IPO listing' : 'Not yet eligible — mandatory checks failing'}
              </div>
            </div>
          )}
        </div>

        {/* Consistency */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={16} strokeWidth={1.75} color="var(--status-gap)" />
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>Cross-Document Consistency</h3>
          </div>
          {!consistency ? (
            <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>Loading…</p>
          ) : !consistency.has_issues ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--status-approved-soft)', borderRadius: 'var(--radius-sm)' }}>
              <CheckCircle2 size={18} strokeWidth={1.5} color="var(--status-approved)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>All financial and capital structure data is internally consistent.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {consistency.checks.map((c, i) => {
                const isCritical = c.severity === 'critical';
                return (
                  <div key={i} style={{
                    padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    background: isCritical ? 'var(--status-gap-soft)' : 'var(--status-draft-soft)',
                    borderLeft: `3px solid ${isCritical ? 'var(--status-gap)' : 'var(--status-draft)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>{c.field.replace(/_/g, ' ')}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: isCritical ? 'var(--status-gap)' : 'var(--status-draft)' }}>
                        {isCritical ? 'Critical' : 'Warning'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', margin: '4px 0 0' }}>{c.fix}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Data Dependency Map */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <GitBranch size={16} strokeWidth={1.75} color="var(--signal)" />
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>Data Dependency Map</h3>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginBottom: 14 }}>
          If a core figure below changes, these DRHP sections need re-review. A fixed dependency map, not live regulation monitoring.
        </p>
        {!impacts ? (
          <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>Loading…</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {impacts.map((imp, i) => (
              <div key={i} style={{ padding: '12px 14px', background: 'var(--paper-sunken)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
                  {IMPACT_KEYS[i]?.label ?? imp.changed_field}
                </div>
                {imp.affected_sections.length === 0 ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', margin: 0 }}>No mapped sections.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {imp.affected_sections.map((s) => (
                      <div key={s} style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>· {s}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
