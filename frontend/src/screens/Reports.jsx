import { useState } from 'react';
import { FileText, Download, Loader2, CheckCircle2, XCircle, Clock, Paperclip } from 'lucide-react';
import * as canvasApi from '../canvas/services/canvasApi.js';
import { mockEvidenceReport } from '../mocks/reportsEvidenceMockData.js';
import { mockAuditTrail } from '../mocks/reportsAuditTrailMockData.js';

const TABS = [
  { key: 'draft',      label: 'DRHP Draft' },
  { key: 'evidence',   label: 'Evidence Report' },
  { key: 'compliance', label: 'Compliance Report' },
  { key: 'audit',      label: 'Audit Trail' },
];

function ComingSoonButton() {
  return (
    <button className="btn btn-secondary btn-sm" disabled title="No report-file generator exists for this tab yet">
      <Download size={13} strokeWidth={2} /> Coming soon
    </button>
  );
}

function DraftTab({ companyId, companyName, sections }) {
  const [exporting, setExporting] = useState(null);
  const [error, setError] = useState(null);
  const approvedCount = sections.filter((s) => s.locked).length;

  const handleExport = async (fmt) => {
    setExporting(fmt);
    setError(null);
    try {
      const blob = await canvasApi.exportFull(companyId, fmt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(companyName || 'DRHP').replace(/[^a-z0-9]/gi, '_')}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e?.message ?? 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <FileText size={16} strokeWidth={1.75} color="var(--signal)" />
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>Full DRHP Draft</h3>
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--ink-faint)', marginBottom: 14 }}>
        {approvedCount} / {sections.length} sections approved. Includes drafted-but-unapproved sections so it can be
        reviewed at any stage, not just at final sign-off.
      </p>
      {error && (
        <p style={{ fontSize: '0.78rem', color: 'var(--status-gap)', marginBottom: 10 }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary btn-sm" onClick={() => handleExport('pdf')} disabled={!!exporting}>
          {exporting === 'pdf' ? <Loader2 size={13} strokeWidth={2} className="spin" /> : <Download size={13} strokeWidth={2} />} DRHP PDF
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => handleExport('docx')} disabled={!!exporting}>
          {exporting === 'docx' ? <Loader2 size={13} strokeWidth={2} className="spin" /> : <Download size={13} strokeWidth={2} />} DRHP DOCX
        </button>
      </div>
    </div>
  );
}

function EvidenceTab() {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Paperclip size={16} strokeWidth={1.75} color="var(--signal)" />
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>Evidence Report</h3>
        </div>
        <ComingSoonButton />
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--ink-faint)', marginBottom: 14 }}>
        Sample source citations per section. No per-section, page-level citation API exists yet — this is illustrative.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {mockEvidenceReport.map((row) => (
          <div key={row.section} style={{ padding: '12px 14px', background: 'var(--paper-sunken)', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>{row.section}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--signal)' }}>{Math.round(row.confidenceScore * 100)}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--paper-raised)', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
              <div style={{ height: '100%', width: `${Math.round(row.confidenceScore * 100)}%`, background: 'var(--signal)', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {row.sources.map((s) => (
                <div key={s} style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>· {s}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComplianceTab({ eligibility, consistency }) {
  if (!eligibility) {
    return <div className="card"><p style={{ fontSize: '0.85rem', color: 'var(--ink-faint)' }}>Loading…</p></div>;
  }
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} strokeWidth={1.75} color="var(--signal)" />
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>Compliance Report</h3>
        </div>
        <ComingSoonButton />
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--ink-faint)', marginBottom: 14 }}>
        {eligibility.checks.filter((c) => c.passed).length} / {eligibility.checks.length} SEBI ICDR criteria met.
        {consistency?.has_issues ? ` ${consistency.checks.length} cross-document consistency issue(s) found.` : ' No cross-document consistency issues.'}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: consistency?.has_issues ? 16 : 0 }}>
        {eligibility.checks.map((c, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--rule)' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>{c.name}</div>
              {!c.passed && <div style={{ fontSize: '0.72rem', color: 'var(--status-gap)', marginTop: 2 }}>{c.reason}</div>}
              {c.clause_id && <div style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: 2 }}>{c.clause_id}</div>}
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600, color: c.passed ? 'var(--status-approved)' : 'var(--status-gap)', flexShrink: 0 }}>
              {c.passed ? <CheckCircle2 size={14} strokeWidth={2} /> : <XCircle size={14} strokeWidth={2} />}
              {c.passed ? 'Pass' : 'Fail'}
            </span>
          </div>
        ))}
      </div>
      {consistency?.has_issues && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {consistency.checks.map((c, i) => {
            const isCritical = c.severity === 'critical';
            return (
              <div
                key={i}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: isCritical ? 'var(--status-gap-soft)' : 'var(--status-draft-soft)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>
                  <span>{c.field.replace(/_/g, ' ')}</span>
                  <span style={{ color: isCritical ? 'var(--status-gap)' : 'var(--status-draft)' }}>{isCritical ? 'Critical' : 'Warning'}</span>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', margin: '4px 0 0' }}>{c.fix}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AuditTab() {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} strokeWidth={1.75} color="var(--signal)" />
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>Audit Trail</h3>
        </div>
        <ComingSoonButton />
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--ink-faint)', marginBottom: 14 }}>
        Sample timeline — a real per-user activity feed for this exact view is not wired up yet (see banker Activity page for real, unattributed events).
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {mockAuditTrail.map((row, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--rule)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>{row.action}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', marginTop: 2 }}>{row.actor} · {row.role}</div>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', flexShrink: 0, whiteSpace: 'nowrap' }}>{row.timestamp}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Reports({ companyId, companyName, sections = [], eligibility, consistency }) {
  const [tab, setTab] = useState('draft');

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 4 }}>Reports</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.875rem' }}>
        DRHP draft, evidence, compliance and audit history in one place.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'draft' && <DraftTab companyId={companyId} companyName={companyName} sections={sections} />}
      {tab === 'evidence' && <EvidenceTab />}
      {tab === 'compliance' && <ComplianceTab eligibility={eligibility} consistency={consistency} />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}
