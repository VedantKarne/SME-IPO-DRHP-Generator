// Finance/CA's Documents page — upload financial-statement documents and
// track their processing status. Reuses the same upload/status/delete
// endpoints as the Founder's screens/Documents.jsx
// (src/api/document_upload_router.py), scoped to just the
// financial-statement doc type ("0") since Finance/CA's remit here is
// financial documents, not the Founder's full company document checklist.
//
// Upload/remove controls are permission-gated (can('uploadDocuments')) —
// hidden entirely for a role that shouldn't see them, not shown-then-403'd.
import { useState, useEffect, useCallback, useRef } from 'react';
import { FileBarChart, CheckCircle2, XCircle, Trash2, Eye } from 'lucide-react';
import { getCurrentRole } from '../../utils/auth';
import { can } from '../../permissions/financeRolePermissions';
import { getDocumentStatus, uploadFinancialDocument, deleteDocument, viewEvidenceFile } from './api';

export default function FinanceDocuments({ companyId }) {
  const role = getCurrentRole();
  const canUpload = can(role, 'uploadDocuments');
  const canView = can(role, 'viewEvidence');

  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    try {
      const records = await getDocumentStatus(companyId);
      setDocs(records.filter((r) => r.doc_type === '0'));
    } catch (_) { /* transient — next poll or manual refresh will retry */ }
  }, [companyId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const inFlight = docs.some((d) => d.status === 'pending' || d.status === 'processing');
    if (!inFlight) return undefined;
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [docs, refresh]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !companyId) return;
    setUploading(true);
    setError(null);
    try {
      await uploadFinancialDocument(companyId, file);
      await refresh();
    } catch (err) {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (uploadId) => {
    try {
      await deleteDocument(uploadId);
      refresh();
    } catch (_) {
      setError('Could not remove that document.');
    }
  };

  const handleView = async (uploadId) => {
    try {
      await viewEvidenceFile(uploadId);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fade-in">
      <div className="dashboard-greeting">Documents</div>
      <div className="dashboard-company">Financial statements & supporting evidence</div>

      {canUpload && (
        <>
          <input
            type="file" ref={fileInputRef} style={{ display: 'none' }}
            onChange={handleFileChange} accept=".pdf,.xlsx,.xls,.docx,.doc"
          />
          <button
            className="btn btn-primary" style={{ marginBottom: 20 }}
            onClick={() => fileInputRef.current?.click()} disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Upload Financial Document'}
          </button>
        </>
      )}

      {error && <div className="canvas-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      {docs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--ink-faint)' }}>No financial documents uploaded yet.</p>
        </div>
      ) : (
        <div className="finance-doc-list">
          {docs.map((doc) => (
            <div key={doc.upload_id} className="card card-sm finance-doc-row">
              <FileBarChart size={20} strokeWidth={1.75} color="var(--ink-soft)" className="finance-doc-icon" />
              <div className="finance-doc-info">
                <div className="finance-doc-name">{doc.filename}</div>
                <div className="finance-doc-meta">
                  Uploaded {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}
                </div>
              </div>
              {doc.status === 'done' ? (
                <span className="badge badge-success"><CheckCircle2 size={12} strokeWidth={2} /> Processed</span>
              ) : doc.status === 'error' ? (
                <span className="badge badge-error"><XCircle size={12} strokeWidth={2} /> Failed</span>
              ) : (
                <span className="badge badge-muted">{doc.status === 'processing' ? 'Processing…' : 'Queued'}</span>
              )}
              {canView && doc.status === 'done' && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleView(doc.upload_id)} title="View document">
                  <Eye size={13} strokeWidth={2} />
                </button>
              )}
              {canUpload && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRemove(doc.upload_id)} title="Remove document">
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
