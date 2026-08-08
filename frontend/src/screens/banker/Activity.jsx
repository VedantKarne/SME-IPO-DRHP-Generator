import { useState, useEffect } from 'react';
import { FileEdit, CheckCircle2, Undo2, MessageSquare, FileUp, Download, Activity as ActivityIcon, Loader2 } from 'lucide-react';
import * as canvasApi from '../../canvas/services/canvasApi.js';

const EVENT_META = {
  section_generated:        { icon: FileEdit,      label: 'generated a draft for',       color: 'var(--ink-soft)' },
  section_approved:         { icon: CheckCircle2,  label: 'approved',                    color: 'var(--status-approved)' },
  section_change_requested: { icon: Undo2,          label: 'requested changes on',         color: 'var(--status-gap)' },
  section_comment:          { icon: MessageSquare, label: 'commented on',                color: 'var(--ink-soft)' },
  document_upload:          { icon: FileUp,         label: 'uploaded a document',          color: 'var(--ink-soft)' },
  drhp_exported:            { icon: Download,       label: 'exported the full DRHP',       color: 'var(--signal)' },
};

export default function Activity({ companyId }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!companyId) return;
    canvasApi.getAuditLog(companyId)
      .then(setRows)
      .catch((e) => setError(e?.message ?? 'Could not load the activity log.'));
  }, [companyId]);

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 4 }}>Activity &amp; Audit</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.875rem' }}>
        Every generation, review, approval, upload and export, in order.
      </p>

      <div className="card">
        {error && (
          <p style={{ fontSize: '0.85rem', color: 'var(--status-gap)' }}>{error}</p>
        )}
        {!error && !rows && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--ink-faint)' }}>
            <Loader2 size={14} strokeWidth={2} className="spin" /> Loading…
          </div>
        )}
        {rows && rows.length === 0 && (
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-faint)' }}>No activity recorded yet.</p>
        )}
        {rows && rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r) => {
              const meta = EVENT_META[r.event_type] ?? { icon: ActivityIcon, label: r.event_type, color: 'var(--ink-faint)' };
              const Icon = meta.icon;
              return (
                <div key={r.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--rule)' }}>
                  <Icon size={15} strokeWidth={2} color={meta.color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>
                      {meta.label}{r.section_name ? <> — <strong>{r.section_name}</strong></> : ''}
                    </div>
                    {r.query && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.query}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {r.timestamp ? new Date(r.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
