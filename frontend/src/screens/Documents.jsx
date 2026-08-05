import { useState, useRef, useEffect, useCallback } from 'react';
import { getToken, decodeToken, authedFetch } from '../utils/auth';

const API_BASE = 'http://127.0.0.1:8000';

const INITIAL_CHECKLIST = [
  { icon: '📊', label: 'Audited Financial Statements (FY2022–24)', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null },
  { icon: '📋', label: 'Board Resolution for IPO', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null },
  { icon: '🏭', label: 'Factory Licence / Registration', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null },
  { icon: '🌿', label: 'Pollution Certificate', required: false, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null },
  { icon: '🛡️', label: 'Factory Insurance Policy', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null },
  { icon: '™️', label: 'Trademark Certificates', required: false, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null },
  { icon: '📝', label: 'Vendor & Customer Contracts (material)', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null },
  { icon: '⚖️', label: 'Litigation / Legal Notices', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null },
  { icon: '🏢', label: 'GST Registration Certificate', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null },
  { icon: '📑', label: 'Memorandum & Articles of Association', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null },
];

const STATUS_COLORS = {
  pending: 'var(--accent)',
  processing: '#f59e0b',
  done: '#10b981',
  error: '#f43f5e',
};

export default function Documents() {
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  
  // Get companyId directly from token
  const token = getToken();
  const companyId = token ? decodeToken(token)?.company_id : null;
  
  const [pollingActive, setPollingActive] = useState(false);
  const fileInputRef = useRef(null);
  const activeUploadRef = useRef(null);

  const uploaded = checklist.filter(d => d.uploaded || d.status === 'done').length;
  const total = checklist.length;

  // Keyword map: checklist label → filename keywords to match against backend records
  const LABEL_KEYWORDS = [
    ['Audited Financial', ['financial', 'audit', 'p&l', 'profit', 'balance_sheet']],
    ['Board Resolution', ['board_resolution', 'board_res', 'br_']],
    ['Factory Licence', ['factory', 'licence', 'registration']],
    ['Pollution', ['pollution']],
    ['Insurance', ['insurance']],
    ['Trademark', ['trademark']],
    ['Vendor', ['vendor', 'contract', 'customer']],
    ['Litigation', ['litigation', 'legal_notice']],
    ['GST', ['gst']],
    ['Memorandum', ['moa', 'memorandum', 'articles', 'aoa']],
  ];

  const reconcileWithBackend = async (cid) => {
    try {
      const res = await authedFetch(`${API_BASE}/api/documents/status/${cid}`);
      if (!res.ok) return;
      const records = await res.json(); // [{upload_id, filename, doc_type, status, ...}]
      if (!records.length) return;

      setChecklist(prev => prev.map((item, i) => {
        // Try to find a matching backend record by doc_type (which is the checklist index)
        const match = records.find(r => r.doc_type === String(i));
        if (!match) return item;

        return {
          ...item,
          uploadId: match.upload_id,
          filename: match.filename,
          status: match.status,
          uploaded: match.status === 'done',
        };
      }));
    } catch (_) {}
  };

  // Initialize from backend
  useEffect(() => {
    if (companyId) {
      reconcileWithBackend(companyId);
    }
  }, [companyId]);

  // Poll status for any 'pending' or 'processing' items
  const pollStatuses = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await authedFetch(`${API_BASE}/api/documents/status/${companyId}`);
      if (!res.ok) return;
      const statuses = await res.json();

      setChecklist(prev => {
        let changed = false;
        const next = prev.map(item => {
          if (!item.uploadId) return item;
          const s = statuses.find(st => st.upload_id === item.uploadId);
          if (!s) return item;
          if (s.status !== item.status) {
            changed = true;
            return {
              ...item,
              status: s.status,
              uploaded: s.status === 'done',
            };
          }
          return item;
        });
        return changed ? next : prev;
      });
    } catch (_) {}
  }, [companyId]);

  useEffect(() => {
    if (!pollingActive) return;
    const interval = setInterval(pollStatuses, 2000);
    return () => clearInterval(interval);
  }, [pollingActive, pollStatuses]);

  // Stop polling when no items are in-flight
  useEffect(() => {
    const inFlight = checklist.some(d => d.status === 'pending' || d.status === 'processing');
    setPollingActive(inFlight);
  }, [checklist]);

  const handleUploadClick = (idx) => {
    activeUploadRef.current = idx;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    if (!e.target.files?.length) return;
    const idx = activeUploadRef.current;
    if (idx === null) return;

    const file = e.target.files[0];
    e.target.value = '';

    if (!companyId) {
      // Fallback: no backend available, show optimistic UI
      setUploadingIdx(idx);
      setTimeout(() => {
        setChecklist(prev => {
          const next = [...prev];
          next[idx] = { ...next[idx], uploaded: true, status: 'done', filename: file.name };
          return next;
        });
        setUploadingIdx(null);
      }, 1500);
      return;
    }

    // Mark as uploading in UI
    setUploadingIdx(idx);
    setChecklist(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], status: 'pending', filename: file.name };
      return next;
    });

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', String(idx));

      // authedFetch now omits Content-Type for FormData, so the browser can
      // set the multipart boundary. This used to need a raw fetch.
      const res = await authedFetch(`${API_BASE}/api/documents/upload/${companyId}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`);
      }

      const data = await res.json();
      setChecklist(prev => {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          status: 'pending',
          uploadId: data.upload_id,
          filename: file.name,
        };
        return next;
      });
      setPollingActive(true);
    } catch (err) {
      setChecklist(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'error', filename: file.name };
        return next;
      });
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleRemove = async (idx) => {
    const doc = checklist[idx];
    if (!doc.uploadId) return;

    // Optimistically update UI to revert to initial state for this slot
    setChecklist(prev => {
      const next = [...prev];
      next[idx] = { ...INITIAL_CHECKLIST[idx] };
      return next;
    });

    try {
      const res = await authedFetch(`${API_BASE}/api/documents/${doc.uploadId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        throw new Error('Failed to delete document');
      }
    } catch (err) {
      // If deletion fails, silently re-sync with backend to restore it
      if (companyId) reconcileWithBackend(companyId);
    }
  };


  const getStatusBadge = (doc, i) => {
    if (doc.status === 'processing' || uploadingIdx === i) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.2s infinite' }} />
          <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>Processing…</span>
        </div>
      );
    }
    if (doc.status === 'done' || doc.uploaded) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="badge badge-success">✓ Extracted</span>
          <button 
            onClick={() => handleRemove(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
            title="Remove document"
          >
            🗑️
          </button>
        </div>
      );
    }
    if (doc.status === 'pending') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>Queued</span>
        </div>
      );
    }
    if (doc.status === 'error') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.72rem', color: '#f43f5e', fontWeight: 600 }}>✗ Failed</span>
          <button 
            onClick={() => handleRemove(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
            title="Remove document"
          >
            🗑️
          </button>
        </div>
      );
    }
    return (
      <button className="btn btn-secondary btn-sm" onClick={() => handleUploadClick(i)}>
        Upload →
      </button>
    );
  };

  return (
    <div className="fade-in">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept=".pdf,.xlsx,.xls,.docx,.doc"
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
            <span style={{ color: 'var(--accent)' }}>{Math.round(uploaded / total * 100)}%</span>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${uploaded / total * 100}%`, background: 'linear-gradient(90deg, var(--accent), #7c3aed)', borderRadius: 4, transition: 'width 0.8s ease' }} />
          </div>
          <p style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Nirmaan AI extracts Revenue, PAT, Auditor name, Directors, and KMP data on upload.
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checklist.map((doc, i) => (
          <div
            key={i}
            className="card card-sm"
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              borderColor: doc.uploaded || doc.status === 'done'
                ? 'rgba(16,185,129,0.2)'
                : doc.status === 'error'
                ? 'rgba(244,63,94,0.2)'
                : doc.required ? 'rgba(244,63,94,0.15)' : 'var(--glass-border)',
              background: doc.uploaded || doc.status === 'done'
                ? 'rgba(16,185,129,0.04)'
                : doc.status === 'error'
                ? 'rgba(244,63,94,0.04)'
                : 'var(--glass-bg)',
            }}
          >
            <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{doc.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{doc.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {doc.filename
                  ? <span style={{ color: 'var(--accent)' }}>📄 {doc.filename}</span>
                  : doc.required ? '⚠️ Required' : 'Optional'}
              </div>
            </div>
            {getStatusBadge(doc, i)}
          </div>
        ))}
      </div>

      {/* AI extraction info */}
      <div className="card" style={{ marginTop: 24, borderColor: 'rgba(79,126,255,0.2)', background: 'rgba(79,126,255,0.04)' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: 14, color: 'var(--accent)' }}>🤖 AI Extraction Pipeline</h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          When you upload a financial statement, Nirmaan AI runs the full ingestion pipeline:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { label: 'Parse', value: 'PDF → Text + Tables', src: 'pdf_parser.py' },
            { label: 'Classify', value: 'Section Mapping', src: 'client_data_chunker.py' },
            { label: 'Extract KPIs', value: 'Revenue, PAT, NW', src: 'Groq LLM' },
            { label: 'Enrich', value: 'Breadcrumbs Added', src: 'context_enricher.py' },
            { label: 'Embed', value: 'BGE-M3 Vectors', src: 'Vector Store' },
            { label: 'Index', value: 'Searchable in RAG', src: 'ChromaDB' },
          ].map(({ label, value, src }) => (
            <div key={label} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--accent)', marginTop: 2 }}>via: {src}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
