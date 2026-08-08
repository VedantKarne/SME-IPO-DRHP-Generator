import { ClipboardList, XCircle, AlertTriangle } from 'lucide-react';

export default function Evidence({ sections = [] }) {
  const total = sections.length || 1;
  // "Covered" = no missing or unsynced source documents for this section —
  // derived from the same missing_docs/unsynced_docs arrays shown below,
  // not the section's own `sync_status` field (which can read "green" even
  // when missing_docs is non-empty — see BankerReviewPanel's EvidenceTab).
  const covered = sections.filter((s) => !(s.missing_docs || []).length && !(s.unsynced_docs || []).length).length;
  const coveragePct = Math.round((covered / total) * 100);

  const withIssues = sections.filter((s) => (s.missing_docs || []).length || (s.unsynced_docs || []).length);
  const totalClauses = sections.reduce((sum, s) => sum + (s.supporting_clause_ids || []).length, 0);

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 4 }}>Evidence</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.875rem' }}>
        Source-document coverage across all {sections.length} sections.
      </p>

      <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--signal)' }}>{coveragePct}%</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>coverage</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
            <span>Evidence Coverage</span>
            <span style={{ color: 'var(--signal)' }}>{covered} / {sections.length} sections fully sourced</span>
          </div>
          <div style={{ height: 8, background: 'var(--paper-sunken)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${coveragePct}%`, background: 'var(--signal)', borderRadius: 'var(--radius-md)' }} />
          </div>
          <p style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {totalClauses} regulatory clause{totalClauses === 1 ? '' : 's'} cited across all drafted sections.
          </p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <ClipboardList size={16} strokeWidth={1.75} color="var(--signal)" />
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>Sections with outstanding document issues</h3>
        </div>
        {withIssues.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-faint)' }}>Every section has its source documents on file.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {withIssues.map((s) => (
              <div key={s.name} style={{ padding: '10px 12px', background: 'var(--paper-sunken)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>{s.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {(s.missing_docs || []).map((d) => (
                    <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--status-gap)' }}>
                      <XCircle size={11} strokeWidth={2} /> {d}
                    </span>
                  ))}
                  {(s.unsynced_docs || []).map((d) => (
                    <span key={d} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--status-draft)' }}>
                      <AlertTriangle size={11} strokeWidth={2} /> {d} (needs re-sync)
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
