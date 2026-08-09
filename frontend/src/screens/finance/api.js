// Thin wrapper around the backend endpoints the Finance/CA workspace pages
// call (src/api/finance_router.py + the existing document/section
// endpoints it reuses), so each page component doesn't repeat the same
// authedFetch/URL boilerplate. Not a permissions module — see
// permissions/financeRolePermissions.js for the allow/deny rules; this
// file only talks to the network.
import { authedFetch } from '../../utils/auth';

const API = 'http://127.0.0.1:8000';

const asJson = (res) => (res.ok ? res.json() : Promise.reject(res));

export const getSections = (companyId) =>
  authedFetch(`${API}/api/sections/${companyId}`).then(asJson);

export const getDocumentStatus = (companyId) =>
  authedFetch(`${API}/api/documents/status/${companyId}`).then(asJson);

export const uploadFinancialDocument = (companyId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', '0'); // "0" = Audited Financial Statements, per document_upload_router.py's DOC_TYPE_NAMES
  return authedFetch(`${API}/api/documents/upload/${companyId}`, { method: 'POST', body: formData }).then(asJson);
};

export const deleteDocument = (uploadId) =>
  authedFetch(`${API}/api/documents/${uploadId}`, { method: 'DELETE' }).then(asJson);

export const viewEvidenceFile = async (uploadId) => {
  // Serving requires the Authorization header, so a plain <a href> or
  // window.open(url) can't hit this endpoint directly — fetch the bytes
  // through authedFetch and open a blob URL instead.
  const res = await authedFetch(`${API}/api/documents/${uploadId}/file`);
  if (!res.ok) throw new Error('Could not load the source document.');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
};

export const getFinancials = (companyId) =>
  authedFetch(`${API}/api/finance/${companyId}/financials`).then(asJson);

export const correctFinancialStatement = (companyId, fiscalYear, changes) =>
  authedFetch(`${API}/api/finance/${companyId}/financials/${fiscalYear}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  }).then(asJson);

export const verifyFinancialStatement = (companyId, fiscalYear) =>
  authedFetch(`${API}/api/finance/${companyId}/financials/${fiscalYear}/verify`, { method: 'POST' }).then(asJson);

export const getFinancialStatus = (companyId, fiscalYear) =>
  authedFetch(`${API}/api/finance/${companyId}/financials/${fiscalYear}/status`).then(asJson);

export const addFinanceComment = (sectionId, note, requestClarification) =>
  authedFetch(`${API}/api/finance/sections/${sectionId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ note, request_clarification: requestClarification }),
  }).then(asJson);

export const getFinanceComments = (sectionId) =>
  authedFetch(`${API}/api/finance/sections/${sectionId}/comments`).then(asJson);

export const financeReviewSection = (sectionId) =>
  authedFetch(`${API}/api/finance/sections/${sectionId}/finance-review`, { method: 'POST' }).then(asJson);
