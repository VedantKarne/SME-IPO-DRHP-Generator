import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FileBarChart, FileSignature, Factory, Leaf, ShieldCheck, Award, FileText,
  Scale, Building2, ScrollText, CheckCircle2, XCircle, Trash2, Paperclip,
  Bot, FileUp, FileScan, Tags, Calculator, Link2, Boxes, Database,
  FileCheck2, Eye, SendHorizontal, MailCheck,
} from 'lucide-react';
import { getToken, decodeToken, authedFetch } from '../utils/auth';
import { isDemoCompany } from '../utils/demoMode.js';
import { isSentToBanker, markSentToBanker } from '../utils/bankerHandoff.js';

const API_BASE = 'http://127.0.0.1:8000';

const PIPELINE_STEPS = [
  { icon: FileScan,  phase: 'Parse',        heading: 'PDF → Text + Tables', src: 'pdf_parser.py' },
  { icon: Tags,      phase: 'Classify',     heading: 'Section Mapping',     src: 'client_data_chunker.py' },
  { icon: Calculator, phase: 'Extract KPIs', heading: 'Revenue, PAT, NW',    src: 'Groq LLM' },
  { icon: Link2,     phase: 'Enrich',       heading: 'Breadcrumbs Added',   src: 'context_enricher.py' },
  { icon: Boxes,     phase: 'Embed',        heading: 'BGE-M3 Vectors',      src: 'Vector Store' },
  { icon: Database,  phase: 'Index',        heading: 'Searchable in RAG',   src: 'ChromaDB' },
];

// demoFile: sample PDF served as a static frontend asset (frontend/public/
// demo-documents/) for the seeded demo account only — see isDemoCompany
// below. Real accounts never see this field populated on upload; there is
// no backend "view raw file" endpoint, so it's out of scope to wire this up
// for real uploads in this pass.
const INITIAL_CHECKLIST = [
  { icon: FileBarChart, label: 'Audited Financial Statements (FY2022–24)', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null, demoFile: '/demo-documents/audited-financial-statements.pdf' },
  { icon: FileSignature, label: 'Board Resolution for IPO', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null, demoFile: '/demo-documents/board-resolution.pdf' },
  { icon: Factory, label: 'Factory Licence / Registration', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null, demoFile: '/demo-documents/factory-licence.pdf' },
  { icon: Leaf, label: 'Pollution Certificate', required: false, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null, demoFile: '/demo-documents/pollution-certificate.pdf' },
  { icon: ShieldCheck, label: 'Factory Insurance Policy', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null, demoFile: '/demo-documents/factory-insurance.pdf' },
  { icon: Award, label: 'Trademark Certificates', required: false, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null, demoFile: '/demo-documents/trademark-certificates.pdf' },
  { icon: FileText, label: 'Vendor & Customer Contracts (material)', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null, demoFile: '/demo-documents/vendor-customer-contracts.pdf' },
  { icon: Scale, label: 'Litigation / Legal Notices', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null, demoFile: '/demo-documents/litigation-notices.pdf' },
  { icon: Building2, label: 'GST Registration Certificate', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null, demoFile: '/demo-documents/gst-registration.pdf' },
  { icon: ScrollText, label: 'Memorandum & Articles of Association', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null, demoFile: '/demo-documents/moa-aoa.pdf' },
  { icon: FileCheck2, label: 'Certificate of Incorporation', required: true, uploaded: false, filename: null, status: null, uploadId: null, extractedKpis: null, demoFile: '/demo-documents/certificate-of-incorporation.pdf' },
];

export default function Documents({ readOnly = false }) {
  // Get companyId directly from token
  const token = getToken();
  const decoded = token ? decodeToken(token) : null;
  const companyId = decoded?.company_id ?? null;
  const isDemo = isDemoCompany(decoded?.company_name ?? null);

  // For the seeded demo account, the checklist starts pre-filled with the
  // sample PDFs so the page demonstrates a fully-prepared filing without
  // requiring an actual upload. reconcileWithBackend (below) still runs
  // afterwards and will only overwrite a slot if a real backend record
  // exists for it, so this never fights genuine uploads.
  const [checklist, setChecklist] = useState(() =>
    isDemo
      ? INITIAL_CHECKLIST.map((doc) => ({
          ...doc,
          uploaded: true,
          status: 'done',
          filename: doc.demoFile.split('/').pop(),
        }))
      : INITIAL_CHECKLIST
  );
  const [uploadingIdx, setUploadingIdx] = useState(null);

  const [pollingActive, setPollingActive] = useState(false);
  const fileInputRef = useRef(null);
  const activeUploadRef = useRef(null);

  const [sentToBanker, setSentToBanker] = useState(() => isSentToBanker(companyId));
  const [showSentDialog, setShowSentDialog] = useState(false);

  const handleSendToBanker = () => {
    markSentToBanker(companyId);
    setSentToBanker(true);
    setShowSentDialog(true);
  };

  const uploaded = checklist.filter(d => d.uploaded || d.status === 'done').length;
  const total = checklist.length;

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
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--status-draft)', animation: 'pulse 1.2s infinite' }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--status-draft)', fontWeight: 600 }}>Processing…</span>
        </div>
      );
    }
    if (doc.status === 'done' || doc.uploaded) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="badge badge-success"><CheckCircle2 size={12} strokeWidth={2} /> Extracted</span>
          {doc.demoFile && (
            <button
              onClick={() => window.open(doc.demoFile, '_blank', 'noopener,noreferrer')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4, display: 'flex' }}
              title="View document"
            >
              <Eye size={14} strokeWidth={2} />
            </button>
          )}
          {doc.uploadId && !readOnly && (
            <button
              onClick={() => handleRemove(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex' }}
              title="Remove document"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          )}
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: 'var(--error)', fontWeight: 600 }}>
            <XCircle size={13} strokeWidth={2} /> Failed
          </span>
          {!readOnly && (
            <button
              onClick={() => handleRemove(i)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, display: 'flex' }}
              title="Remove document"
            >
              <Trash2 size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      );
    }
    if (readOnly) {
      return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not uploaded</span>;
    }
    return (
      <button className="btn btn-secondary btn-sm" onClick={() => handleUploadClick(i)}>
        Upload
      </button>
    );
  };

  return (
    <div className="fade-in">
      {!readOnly && (
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          accept=".pdf,.xlsx,.xls,.docx,.doc"
        />
      )}

      <h1 style={{ marginBottom: 4 }}>Document Intelligence</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.875rem' }}>
        {readOnly
          ? 'Documents uploaded by the issuer for this filing.'
          : 'AI dynamically determines required documents based on your company profile.'}
      </p>

      {/* First-time nudge — purely informational, so it's styled as a neutral
          tip (ink-toned left rule, paper-raised surface) rather than the
          --signal/--status-gap red used below for documents that actually
          need action. Same red on both used to make the "go read this" note
          and the "go do this" checklist cards visually indistinguishable.
          Not relevant to a read-only viewer who can't upload anyway. */}
      {!readOnly && uploaded === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', marginBottom: 24,
          background: 'var(--paper-raised)', border: '1px solid var(--rule)',
          borderLeft: '3px solid var(--ink-faint)',
          borderRadius: 'var(--radius-md)',
        }}>
          <FileUp size={20} strokeWidth={1.75} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Upload documents to start IPO generation.
          </span>
        </div>
      )}

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
          <div style={{ height: 8, background: 'var(--paper-sunken)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${uploaded / total * 100}%`, background: 'var(--accent)', borderRadius: 'var(--radius-md)', transition: 'width 0.8s ease' }} />
          </div>
          <p style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Nirmaan AI extracts Revenue, PAT, Auditor name, Directors, and KMP data on upload.
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--signal)' }}>*</span> Required
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checklist.map((doc, i) => {
          const DocIcon = doc.icon;
          return (
          <div
            key={i}
            className="card card-sm"
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              borderColor: doc.uploaded || doc.status === 'done'
                ? 'var(--success)'
                : doc.status === 'error'
                ? 'var(--error)'
                : doc.required ? 'var(--status-gap)' : 'var(--glass-border)',
              background: 'var(--glass-bg)',
            }}
          >
            <DocIcon size={20} strokeWidth={1.75} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                {doc.label}
                {doc.required && <span style={{ color: 'var(--signal)' }}> *</span>}
              </div>
              {doc.filename && (
                <div style={{ fontSize: '0.72rem', color: 'var(--accent)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Paperclip size={11} strokeWidth={2} /> {doc.filename}
                </div>
              )}
            </div>
            {getStatusBadge(doc, i)}
          </div>
          );
        })}
      </div>

      {/* Send to Merchant Banker — hands the uploaded documents off for
          drafting. Once sent, the button is replaced by a small confirmation
          container rather than staying clickable, since there's nothing left
          to send until new documents are added. Founder-only action — the
          banker viewing this same checklist read-only has nothing to send. */}
      {!readOnly && (sentToBanker ? (
        <div
          className="card card-sm"
          style={{
            marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 10,
            background: 'var(--success-dim)', borderColor: 'var(--success)',
            padding: '10px 16px',
          }}
        >
          <CheckCircle2 size={16} strokeWidth={2} color="var(--success)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--ink)', fontWeight: 500 }}>
            Document sent to Merchant Banker
          </span>
        </div>
      ) : (
        <button
          className="btn btn-primary"
          onClick={handleSendToBanker}
          disabled={uploaded === 0}
          title={uploaded === 0 ? 'Upload at least one document first' : undefined}
          style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <SendHorizontal size={15} strokeWidth={2} /> Send to Merchant Banker
        </button>
      ))}

      {/* Send confirmation dialog */}
      {!readOnly && showSentDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sent to Merchant Banker"
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(28,27,25,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSentDialog(false); }}
        >
          <div className="card" style={{ width: '100%', maxWidth: 360, textAlign: 'center', padding: 32 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--success-dim)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <MailCheck size={28} strokeWidth={1.75} color="var(--success)" />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: '1rem' }}>Document sent to Merchant Banker</h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Your merchant banker can now review your documents and draft your DRHP in the Document Workspace.
            </p>
            <button className="btn btn-primary" onClick={() => setShowSentDialog(false)}>Done</button>
          </div>
        </div>
      )}

      {/* AI extraction info */}
      <div className="card" style={{ marginTop: 24, borderColor: 'var(--rule)', background: 'var(--accent-dim)' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: 14, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Bot size={16} strokeWidth={1.75} /> AI Extraction Pipeline
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          When you upload a financial statement, Nirmaan AI runs the full ingestion pipeline:
        </p>
        <div className="pipeline-row">
          {PIPELINE_STEPS.map(({ icon: StepIcon, phase, heading, src }) => (
            <div className="pipeline-step" key={phase}>
              <div className="pipeline-circle">
                <StepIcon size={17} strokeWidth={1.75} />
              </div>
              <div className="pipeline-step-text">
                <div className="pipeline-phase">{phase}</div>
                <div className="pipeline-heading">{heading}</div>
                <div className="pipeline-desc">via: {src}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
