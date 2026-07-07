import { useState, useRef } from 'react';

const INITIAL_CHECKLIST = [
  { icon: '📊', label: 'Audited Financial Statements (FY2022–24)', required: true, uploaded: false },
  { icon: '📋', label: 'Board Resolution for IPO', required: true, uploaded: false },
  { icon: '🏭', label: 'Factory Licence / Registration', required: true, uploaded: false },
  { icon: '🌿', label: 'Pollution Certificate', required: false, uploaded: false },
  { icon: '🛡️', label: 'Factory Insurance Policy', required: true, uploaded: false },
  { icon: '™️', label: 'Trademark Certificates', required: false, uploaded: false },
  { icon: '📝', label: 'Vendor & Customer Contracts (material)', required: true, uploaded: false },
  { icon: '⚖️', label: 'Litigation / Legal Notices', required: true, uploaded: false },
  { icon: '🏢', label: 'GST Registration Certificate', required: true, uploaded: true },
  { icon: '📑', label: 'Memorandum & Articles of Association', required: true, uploaded: true },
];

export default function Documents() {
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const fileInputRef = useRef(null);
  const activeUploadRef = useRef(null);

  const uploaded = checklist.filter(d => d.uploaded).length;
  const total = checklist.length;

  const handleUploadClick = (idx) => {
    activeUploadRef.current = idx;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (!e.target.files?.length) return;
    const idx = activeUploadRef.current;
    if (idx === null) return;
    
    setUploadingIdx(idx);
    
    // Simulate parsing/upload delay
    setTimeout(() => {
      setChecklist(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], uploaded: true };
        return next;
      });
      setUploadingIdx(null);
      e.target.value = ''; // Reset input
    }, 1500);
  };

  return (
    <div className="fade-in">
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleFileChange} 
      />
      
      <h1 style={{ marginBottom: 4 }}>Document Intelligence</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.875rem' }}>
        AI dynamically determines required documents based on your company profile.
      </p>

      {/* Upload progress */}
      <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>{uploaded}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>of {total} uploaded</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
            <span>Document Collection</span>
            <span style={{ color: 'var(--accent)' }}>{Math.round(uploaded/total*100)}%</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${uploaded/total*100}%`, background: 'linear-gradient(90deg, var(--accent), #7c3aed)', borderRadius: 4, transition: 'width 0.8s ease' }} />
          </div>
          <p style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            AI will auto-extract Revenue, PAT, Auditor name, Directors, and KMP data on upload.
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checklist.map((doc, i) => (
          <div key={i} className="card card-sm" style={{
            display: 'flex', alignItems: 'center', gap: 14,
            borderColor: doc.uploaded ? 'rgba(16,185,129,0.2)' : doc.required ? 'rgba(244,63,94,0.15)' : 'var(--glass-border)',
            background: doc.uploaded ? 'rgba(16,185,129,0.04)' : 'var(--glass-bg)',
            cursor: 'default',
          }}>
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{doc.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{doc.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {doc.required ? '⚠️ Required' : 'Optional'}
              </div>
            </div>
            {doc.uploaded ? (
              <span className="badge badge-success">✓ Uploaded</span>
            ) : uploadingIdx === i ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, paddingRight: 8 }}>
                Uploading...
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => handleUploadClick(i)}>
                Upload →
              </button>
            )}
          </div>
        ))}
      </div>

      {/* AI extraction demo */}
      <div className="card" style={{ marginTop: 24, borderColor: 'rgba(79,126,255,0.2)', background: 'rgba(79,126,255,0.04)' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: 14, color: 'var(--accent)' }}>🤖 AI Extraction Preview</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          When you upload a Balance Sheet, Nirmaan AI automatically extracts:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Revenue', value: '₹62 Cr', src: 'P&L Stmt, Pg 4' },
            { label: 'PAT', value: '₹8 Cr', src: 'P&L Stmt, Pg 4' },
            { label: 'Net Worth', value: '₹37 Cr', src: 'Balance Sheet, Pg 2' },
            { label: 'Debt', value: '₹12 Cr', src: 'Balance Sheet, Pg 2' },
            { label: 'EBITDA', value: '₹11.5 Cr', src: 'Notes, Pg 8' },
            { label: 'Auditor', value: 'ABC LLP', src: 'Cover Page' },
          ].map(({ label, value, src }) => (
            <div key={label} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--accent)', marginTop: 2 }}>Source: {src}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
