import { useState } from 'react';

export default function Review({ sections, setSections, companyId }) {
  const [actionStatus, setActionStatus] = useState({});
  const [activeInput, setActiveInput] = useState({ id: null, type: null });
  const [inputValue, setInputValue] = useState('');
  const [savedNotes, setSavedNotes] = useState({});

  const pending = sections.filter(s => !s.locked && s.draft_text && !s.returned);
  const returned = sections.filter(s => !s.locked && s.returned);
  const approved = sections.filter(s => s.locked);

  const handleAction = (id, msg) => {
    setActionStatus(prev => ({ ...prev, [id]: msg }));
    setTimeout(() => {
      setActionStatus(prev => ({ ...prev, [id]: null }));
    }, 3000);
  };

  const handleInputSubmit = (e, id) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      const isReq = activeInput.type === 'request';
      setSavedNotes(prev => ({
        ...prev,
        [id]: [...(prev[id] || []), { text: inputValue, type: activeInput.type }]
      }));
      setInputValue('');
      setActiveInput({ id: null, type: null });
      handleAction(id, isReq ? 'Changes requested' : 'Comment saved');
      
      if (isReq) {
        // Move to 'Returned' state so it leaves the pending queue!
        setTimeout(() => {
            setSections(prev => prev.map(sec => sec.id === id ? { ...sec, returned: true } : sec));
        }, 1200);
      }
    }
  };

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 4 }}>Merchant Banker Workspace</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.875rem' }}>
        Review and certify sections as the registered intermediary. Locked sections are binding.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="card card-sm" style={{ borderColor: 'rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.05)' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--warning)' }}>{pending.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Awaiting Your Review</div>
        </div>
        <div className="card card-sm" style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--error)' }}>{returned.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Returned to Issuer</div>
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {actionStatus[s.id] && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)', marginRight: 8, fontWeight: 500 }} className="fade-in">
                  ✓ {actionStatus[s.id]}
                </span>
              )}
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setActiveInput(activeInput.id === s.id && activeInput.type === 'comment' ? {id:null,type:null} : {id: s.id, type: 'comment'})}
              >
                💬 Comment
              </button>
              <button 
                className="btn btn-secondary btn-sm" 
                style={{ color: 'var(--warning)' }} 
                onClick={() => setActiveInput(activeInput.id === s.id && activeInput.type === 'request' ? {id:null,type:null} : {id: s.id, type: 'request'})}
              >
                ↩ Request Changes
              </button>
              <button className="btn btn-success btn-sm" onClick={async () => {
                const res = await fetch(`http://localhost:8000/api/sections/${s.id}/approve`, { method: 'POST' });
                if (res.ok) {
                    setSections(prev => prev.map(sec => sec.id === s.id ? { ...sec, locked: true } : sec));
                }
              }}>✓ Certify</button>
            </div>
          </div>
          
          <div style={{ padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 10, fontSize: '0.82rem', color: 'var(--text-secondary)', maxHeight: 140, overflowY: 'auto', lineHeight: 1.6 }}>
            {s.draft_text?.slice(0, 500)}...
          </div>

          {activeInput.id === s.id && (
            <div className="fade-in" style={{ marginTop: 12 }}>
              <input 
                type="text" 
                autoFocus
                placeholder={activeInput.type === 'comment' ? "Type your comment and press Enter..." : "Describe the required changes and press Enter..."}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => handleInputSubmit(e, s.id)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 6,
                  border: `1px solid ${activeInput.type === 'request' ? 'rgba(245,158,11,0.4)' : 'var(--glass-border)'}`,
                  background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          )}

          {savedNotes[s.id] && savedNotes[s.id].map((note, idx) => (
            <div key={idx} className="fade-in" style={{ 
              marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem',
              background: note.type === 'request' ? 'rgba(245,158,11,0.08)' : 'rgba(79,126,255,0.08)',
              borderLeft: `3px solid ${note.type === 'request' ? 'var(--warning)' : 'var(--accent)'}`
            }}>
              <strong style={{ color: note.type === 'request' ? 'var(--warning)' : 'var(--accent)' }}>
                {note.type === 'request' ? 'Change Requested: ' : 'Comment: '}
              </strong>
              {note.text}
            </div>
          ))}

          {s.flagged_gaps?.length > 0 && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(244,63,94,0.08)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--error)' }}>
              ⚠️ {s.flagged_gaps.length} unresolved gap(s) require attention before certification.
            </div>
          )}
        </div>
      ))}

      {returned.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '20px 0 10px' }}>Returned to Issuer</h3>
          {returned.map(s => (
            <div key={s.id} className="card card-sm" style={{ marginBottom: 8, borderColor: 'rgba(239,68,68,0.2)', opacity: 0.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem' }}>{s.name}</span>
                <span className="badge" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)' }}>↩ Needs Revision</span>
              </div>
            </div>
          ))}
        </>
      )}

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
