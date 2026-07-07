export default function Review({ sections, companyId }) {
  const pending = sections.filter(s => !s.locked && s.draft_text);
  const approved = sections.filter(s => s.locked);

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 4 }}>Merchant Banker Workspace</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.875rem' }}>
        Review and certify sections as the registered intermediary. Locked sections are binding.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="card card-sm" style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--warning)' }}>{pending.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Awaiting Your Review</div>
        </div>
        <div className="card card-sm" style={{ borderColor: 'rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.05)' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--success)' }}>{approved.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Certified & Locked</div>
        </div>
      </div>

      {pending.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text-muted)' }}>No sections awaiting review. Generate sections in the Document Workspace first.</p>
        </div>
      )}

      {pending.map(s => (
        <div key={s.id} className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: '1rem', margin: 0 }}>{s.name}</h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Completeness: {Math.round(s.score * 100)}%
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary btn-sm">💬 Comment</button>
              <button className="btn btn-secondary btn-sm" style={{ color: 'var(--warning)' }}>↩ Request Changes</button>
              <button className="btn btn-success btn-sm" onClick={async () => {
                const res = await fetch(`http://localhost:8000/api/sections/${s.id}/approve`, { method: 'POST' });
                if (res.ok) window.location.reload();
              }}>✓ Certify</button>
            </div>
          </div>
          <div style={{ padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', maxHeight: 140, overflowY: 'auto', lineHeight: 1.6 }}>
            {s.draft_text?.slice(0, 500)}...
          </div>
          {s.flagged_gaps?.length > 0 && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(244,63,94,0.08)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--error)' }}>
              ⚠️ {s.flagged_gaps.length} unresolved gap(s) require attention before certification.
            </div>
          )}
        </div>
      ))}

      {approved.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '20px 0 10px' }}>Certified Sections</h3>
          {approved.map(s => (
            <div key={s.id} className="card card-sm" style={{ marginBottom: 8, borderColor: 'rgba(16,185,129,0.2)', opacity: 0.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem' }}>{s.name}</span>
                <span className="badge badge-success">🔒 Certified</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
