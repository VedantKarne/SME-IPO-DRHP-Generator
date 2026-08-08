import { useState, useEffect } from 'react';
import { Lock, ChevronDown, ChevronUp, Download, Loader2, History } from 'lucide-react';
import * as canvasApi from '../../canvas/services/canvasApi.js';
import { countReviewStatuses, getSectionReviewState } from '../../utils/reviewStatus.js';

const STATE_META = {
  approved:           { label: 'Approved',          color: 'var(--status-approved)' },
  under_review:       { label: 'Pending',            color: 'var(--status-draft)' },
  changes_requested:  { label: 'Changes Requested',  color: 'var(--status-gap)' },
  not_started:        { label: 'Not Started',        color: 'var(--ink-faint)' },
};

function VersionHistory({ companyId, sectionName }) {
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    canvasApi.getVersions(companyId, sectionName)
      .then(setVersions)
      // The backend's version-history query has a pre-existing UUID/string
      // type bug (same one that makes autosave fail silently elsewhere in
      // the app — see PROJECT_CONTEXT.md); its 500 response leaks a raw SQL
      // traceback as the error detail, which is not something to show here.
      .catch(() => setError('Version history is temporarily unavailable for this section.'));
  }, [companyId, sectionName]);

  if (error) return <p style={{ fontSize: '0.78rem', color: 'var(--status-gap)', margin: '8px 0 0' }}>{error}</p>;
  if (!versions) return <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', margin: '8px 0 0' }}>Loading version history…</p>;
  if (versions.length === 0) return <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', margin: '8px 0 0' }}>No saved versions yet.</p>;

  return (
    <div style={{ marginTop: 10, paddingLeft: 22, borderLeft: '2px solid var(--rule)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {versions.map((v) => (
        <div key={v.id} style={{ fontSize: '0.78rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{v.label}</span>
            <span style={{ color: 'var(--ink-faint)', flexShrink: 0 }}>
              {new Date(v.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div style={{ color: 'var(--ink-soft)', fontSize: '0.72rem' }}>by {v.author_label || 'Unknown'} · {v.source}</div>
        </div>
      ))}
    </div>
  );
}

export default function Approvals({ companyId, companyName, sections = [], readiness }) {
  const [expanded, setExpanded] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);

  const counts = countReviewStatuses(sections);
  const allApproved = sections.length > 0 && counts.approved === sections.length;
  const r = readiness || {};

  const handleExport = async (fmt) => {
    setExporting(fmt);
    setExportError(null);
    try {
      const blob = await canvasApi.exportFull(companyId, fmt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(companyName || 'DRHP').replace(/[^a-z0-9]/gi, '_')}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e?.message ?? 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 4 }}>Approvals</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.875rem' }}>
        Approval status and version history for every DRHP section.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="card card-sm" style={{ textAlign: 'center' }}>
          <div className="stat-value" style={{ color: 'var(--status-approved)' }}>{counts.approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="card card-sm" style={{ textAlign: 'center' }}>
          <div className="stat-value" style={{ color: 'var(--status-draft)' }}>{counts.under_review}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="card card-sm" style={{ textAlign: 'center' }}>
          <div className="stat-value" style={{ color: 'var(--status-gap)' }}>{counts.changes_requested}</div>
          <div className="stat-label">Changes Requested</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sections.map((s) => {
            const state = getSectionReviewState(s);
            const meta = STATE_META[state];
            const isOpen = expanded === s.name;
            return (
              <div key={s.name} style={{ borderBottom: '1px solid var(--rule)' }}>
                <button
                  onClick={() => setExpanded(isOpen ? null : s.name)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {s.locked ? <Lock size={13} strokeWidth={2} color="var(--status-approved)" /> : <History size={13} strokeWidth={2} color="var(--ink-faint)" />}
                  <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--ink)' }}>{s.name}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: meta.color }}>{meta.label}</span>
                  {isOpen ? <ChevronUp size={14} strokeWidth={2} color="var(--ink-faint)" /> : <ChevronDown size={14} strokeWidth={2} color="var(--ink-faint)" />}
                </button>
                {isOpen && <div style={{ paddingBottom: 12 }}><VersionHistory companyId={companyId} sectionName={s.name} /></div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Final Sign-off */}
      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: '0.95rem', color: 'var(--ink)' }}>Final IPO Readiness</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: 14 }}>
          {counts.approved} / {sections.length} sections approved
          {r.total_open_gaps ? ` · ${r.total_open_gaps} open gap${r.total_open_gaps > 1 ? 's' : ''}` : ''}
        </p>
        {!allApproved ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--status-draft)', background: 'var(--status-draft-soft)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
            {sections.length - counts.approved} section{sections.length - counts.approved === 1 ? '' : 's'} still need approval before final package generation.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: '0.82rem', color: 'var(--status-approved)', fontWeight: 600 }}>
              All sections approved — ready for final assembly.
            </div>
            {exportError && (
              <p style={{ fontSize: '0.78rem', color: 'var(--status-gap)', marginBottom: 10 }}>{exportError}</p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary btn-sm" onClick={() => handleExport('pdf')} disabled={!!exporting}>
                {exporting === 'pdf' ? <Loader2 size={13} strokeWidth={2} className="spin" /> : <Download size={13} strokeWidth={2} />} DRHP PDF
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => handleExport('docx')} disabled={!!exporting}>
                {exporting === 'docx' ? <Loader2 size={13} strokeWidth={2} className="spin" /> : <Download size={13} strokeWidth={2} />} DRHP DOCX
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
