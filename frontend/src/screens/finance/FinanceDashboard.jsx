// Finance/CA dashboard — landing page for the Finance/CA role after
// sign-in (see App.jsx's /finance-dashboard/* route and
// utils/roleRouting.js). Distinct from screens/Dashboard.jsx (the Founder
// dashboard): financial readiness rather than overall IPO readiness, and a
// Financial Review Queue instead of Section Pipeline / Eligibility / Next
// Actions.
//
// Data comes from the same /api/session/restore payload App.jsx already
// fetches for every role (sections, readiness, uploadedDocuments props) —
// no separate fetch needed here, matching how screens/Dashboard.jsx
// consumes that same bootstrap data. See mockFinancialReview.js /
// HARDCODED_DATA_LOG.md — that mock file is no longer used by this page.
import { useNavigate } from 'react-router-dom';
import './finance.css';
import FinancialReviewSummary from './components/FinancialReviewSummary';
import FinancialReviewQueue from './components/FinancialReviewQueue';
import { FINANCE_APPROVABLE_SECTIONS } from '../../permissions/financeRolePermissions';
import { deriveReviewStatus } from './sectionStatus';

export default function FinanceDashboard({ companyName, sections = [], readiness, uploadedDocuments = [] }) {
  const navigate = useNavigate();

  const financialSections = sections.filter((s) => FINANCE_APPROVABLE_SECTIONS.includes(s.name));

  const summary = {
    financial_readiness: readiness?.financial_readiness ?? 0,
    documents_verified: uploadedDocuments.filter((d) => d.status === 'done').length,
    documents_total: uploadedDocuments.length,
    sections_pending: financialSections.filter((s) => deriveReviewStatus(s) !== 'verified').length,
    issues_found: financialSections.reduce((sum, s) => sum + (s.flagged_gaps || []).length, 0),
  };

  const queueItems = financialSections.map((s) => ({
    id: s.id || s.name,
    area: s.name,
    review_status: deriveReviewStatus(s),
    issue_count: (s.flagged_gaps || []).length,
  }));

  return (
    <div className="fade-in">
      <div className="dashboard-greeting">Financial Review</div>
      <div className="dashboard-company">{companyName || 'Finance / CA Workspace'}</div>

      <FinancialReviewSummary summary={summary} />
      <FinancialReviewQueue items={queueItems} onAction={() => navigate('/finance-dashboard/review-queue')} />
    </div>
  );
}
