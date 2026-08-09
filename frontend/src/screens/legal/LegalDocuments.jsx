/**
 * LegalDocuments.jsx
 *
 * Legal Advisor — Document Library page (/legal/documents).
 *
 * What it does:
 *   - Shows all legal-category documents in a filterable table
 *     (litigation records, regulatory approvals, material contracts, etc.)
 *   - Allows the Legal Advisor to upload new legal documents (drag-drop or
 *     file picker) with doc-type and supported-section metadata
 *   - Documents are fetched via legalApi.js; upload uses uploadLegalDocument()
 *   - All styles live in legal-dashboard.css; no inline colours
 *
 * Permissions (Legal Advisor CAN):
 *   - View all legal documents
 *   - Upload litigation records, regulatory approvals, material contracts
 *
 * Permissions (Legal Advisor CANNOT):
 *   - Upload financial-category documents (not rendered here)
 *   - Delete or unlock documents locked by Merchant Banker
 */

import { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  X,
} from 'lucide-react';
import './legal-dashboard.css';
import { fetchLegalDocuments, uploadLegalDocument } from './legalApi';
import { DOC_TYPE_LABELS } from './legalMockData';

// ---------------------------------------------------------------------------
// Verification badge
// ---------------------------------------------------------------------------
const VERIFY_META = {
  matched:     { label: 'Matched',     Icon: CheckCircle2, cls: 'legal-doc-verify-badge--matched' },
  not_checked: { label: 'Not Checked', Icon: Clock,        cls: 'legal-doc-verify-badge--not_checked' },
  mismatch:    { label: 'Mismatch',    Icon: XCircle,      cls: 'legal-doc-verify-badge--mismatch' },
};

function VerifyBadge({ status }) {
  const meta = VERIFY_META[status] ?? VERIFY_META.not_checked;
  const { Icon, label, cls } = meta;
  return (
    <span className={`legal-doc-verify-badge ${cls}`}>
      <Icon size={11} strokeWidth={2} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Upload modal
// ---------------------------------------------------------------------------
const DOC_TYPE_OPTIONS = [
  { value: 'litigation_record',   label: 'Litigation Record' },
  { value: 'regulatory_approval', label: 'Regulatory Approval' },
  { value: 'material_contract',   label: 'Material Contract' },
  { value: 'moa_aoa',             label: 'MOA / AOA' },
  { value: 'licence_copy',        label: 'Licence Copy' },
  { value: 'legal_other',         label: 'Legal — Other' },
];

const SECTION_OPTIONS = [
  { value: '',                    label: '— None (general) —' },
  { value: 'risk-factors',        label: 'Risk Factors' },
  { value: 'legal-proceedings',   label: 'Legal Proceedings' },
  { value: 'outstanding-litigation', label: 'Outstanding Litigation' },
  { value: 'material-contracts',  label: 'Material Contracts' },
  { value: 'govt-regulatory',     label: 'Government & Regulatory Matters' },
  { value: 'other-disclosures',   label: 'Other Legal Disclosures' },
];

function UploadModal({ onClose, onUploaded }) {
  const [file, setFile]         = useState(null);
  const [docType, setDocType]   = useState('legal_other');
  const [section, setSection]   = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const inputRef = useRef();

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function handleSubmit() {
    if (!file) { setError('Please select a file.'); return; }
    setLoading(true);
    setError(null);
    const result = await uploadLegalDocument(file, { docType, supportedSection: section });
    setLoading(false);
    if (result.success) {
      onUploaded(result);
    } else {
      setError(result.error || 'Upload failed — please try again.');
    }
  }

  return (
    <div className="legal-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="upload-modal-title">
      <div className="legal-modal">
        <div className="legal-modal-header">
          <h2 className="legal-modal-title" id="upload-modal-title">Upload Legal Document</h2>
          <button className="legal-modal-close" onClick={onClose} aria-label="Close upload modal">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="legal-modal-body">
          {/* Drop zone */}
          <div
            className={`legal-upload-zone ${dragOver ? 'legal-upload-zone--active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Drop file or click to browse"
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          >
            <Upload size={28} strokeWidth={1.5} className="legal-upload-zone-icon" />
            {file ? (
              <span className="legal-upload-zone-text" style={{ color: 'var(--ink)', fontWeight: 500 }}>
                {file.name}
              </span>
            ) : (
              <>
                <span className="legal-upload-zone-text">
                  Drag a file here or <strong>click to browse</strong>
                </span>
                <span className="legal-upload-zone-hint">PDF, DOCX, XLSX · max 25 MB</span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.xlsx,.doc,.png,.jpg"
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]); }}
            />
          </div>

          {/* Doc type */}
          <div>
            <label className="legal-label" htmlFor="upload-doc-type">Document Type</label>
            <select
              id="upload-doc-type"
              className="legal-select"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              {DOC_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Supported section */}
          <div>
            <label className="legal-label" htmlFor="upload-section">Supported DRHP Section</label>
            <select
              id="upload-section"
              className="legal-select"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              {SECTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="legal-feedback legal-feedback--error">{error}</p>
          )}
        </div>

        <div className="legal-modal-footer">
          <button id="upload-modal-cancel" type="button" className="legal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            id="upload-modal-submit"
            type="button"
            className="legal-btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Uploading…' : 'Upload Document'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const ALL_TYPES = 'all';

export default function LegalDocuments() {
  const [docs, setDocs]               = useState([]);
  const [filter, setFilter]           = useState(ALL_TYPES);
  const [searchText, setSearchText]   = useState('');
  const [showUpload, setShowUpload]   = useState(false);
  const [successMsg, setSuccessMsg]   = useState(null);

  useEffect(() => {
    fetchLegalDocuments().then(setDocs);
  }, []);

  function handleUploaded(result) {
    setShowUpload(false);
    setSuccessMsg(`"${result.filename}" uploaded successfully.`);
    // Re-fetch document list
    fetchLegalDocuments().then(setDocs);
    setTimeout(() => setSuccessMsg(null), 5000);
  }

  const typeFilters = [ALL_TYPES, ...Object.keys(DOC_TYPE_LABELS)];

  const visibleDocs = docs.filter((d) => {
    const matchType   = filter === ALL_TYPES || d.docType === filter;
    const matchSearch = !searchText || d.filename.toLowerCase().includes(searchText.toLowerCase());
    return matchType && matchSearch;
  });

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="legal-page fade-in">
      <h1 className="legal-page-heading">Legal Documents</h1>
      <p className="legal-page-sub">
        Manage and upload litigation records, regulatory approvals, and material contracts
        that support the DRHP legal disclosures.
      </p>

      {/* Toolbar */}
      <div className="legal-toolbar">
        <input
          id="legal-docs-search"
          type="search"
          className="legal-search-input"
          placeholder="Search by filename…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          aria-label="Search documents"
        />
        <button
          id="legal-docs-upload-btn"
          type="button"
          className="legal-btn-primary"
          onClick={() => setShowUpload(true)}
        >
          <Upload size={13} strokeWidth={2} />
          Upload Document
        </button>
      </div>

      {/* Type filters */}
      <div className="legal-filter-bar" role="group" aria-label="Filter by document type">
        <Filter size={12} strokeWidth={1.75} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
        {typeFilters.map((t) => (
          <button
            key={t}
            id={`legal-docs-filter-${t}`}
            type="button"
            className={`legal-filter-btn ${filter === t ? 'active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t === ALL_TYPES ? 'All' : (DOC_TYPE_LABELS[t] ?? t)}
          </button>
        ))}
      </div>

      {/* Success message */}
      {successMsg && (
        <p className="legal-feedback legal-feedback--success" style={{ marginBottom: 'var(--space-4)' }}>
          <CheckCircle2 size={13} strokeWidth={2} /> {successMsg}
        </p>
      )}

      {/* Document table */}
      <div className="legal-docs-table-wrap">
        <table className="legal-docs-table" aria-label="Legal documents table">
          <thead>
            <tr>
              <th className="legal-docs-th">Document</th>
              <th className="legal-docs-th">Type</th>
              <th className="legal-docs-th">Uploaded By</th>
              <th className="legal-docs-th">Date</th>
              <th className="legal-docs-th">Size</th>
              <th className="legal-docs-th">Verification</th>
            </tr>
          </thead>
          <tbody>
            {visibleDocs.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="legal-empty-state">
                    <FileText size={32} strokeWidth={1.25} className="legal-empty-icon" />
                    <p className="legal-empty-text">
                      {docs.length === 0
                        ? 'No documents uploaded yet.'
                        : 'No documents match the current filter.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              visibleDocs.map((doc) => (
                <tr key={doc.id} className="legal-docs-row">
                  <td className="legal-docs-td legal-docs-td--filename" title={doc.filename}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <FileText size={13} strokeWidth={1.5} style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
                      {doc.filename}
                    </span>
                  </td>
                  <td className="legal-docs-td">
                    <span className={`legal-doc-type-tag legal-doc-type-tag--${doc.docType}`}>
                      {DOC_TYPE_LABELS[doc.docType] ?? doc.docType}
                    </span>
                  </td>
                  <td className="legal-docs-td legal-docs-td--meta">{doc.uploadedBy ?? '—'}</td>
                  <td className="legal-docs-td legal-docs-td--meta">{fmtDate(doc.uploadedAt)}</td>
                  <td className="legal-docs-td legal-docs-td--meta">{doc.fileSize ?? '—'}</td>
                  <td className="legal-docs-td">
                    <VerifyBadge status={doc.verificationStatus} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}
