// Finance/CA's Review Queue page — the full "Financial Review Queue" list
// (one row per financial area) with real section data instead of Step 3's
// mock. "Review"/"View" navigates to the DRHP Sections page, which is
// where the Comment / Request Clarification / Approve actions actually
// live — this page stays the at-a-glance status view, matching the
// queue's original dashboard-preview design.
import { useNavigate } from 'react-router-dom';
import { FINANCE_APPROVABLE_SECTIONS } from '../../permissions/financeRolePermissions';
import { deriveReviewStatus } from './sectionStatus';
import FinancialReviewQueue from './components/FinancialReviewQueue';

export default function FinanceReviewQueuePage({ sections = [] }) {
  const navigate = useNavigate();
  const financialSections = sections.filter((s) => FINANCE_APPROVABLE_SECTIONS.includes(s.name));

  const items = financialSections.map((s) => ({
    id: s.id || s.name,
    area: s.name,
    review_status: deriveReviewStatus(s),
    issue_count: (s.flagged_gaps || []).length,
  }));

  return (
    <div className="finance-page">
      <header className="finance-header">
        <h1 className="finance-title">Review Queue</h1>
        <p className="finance-subtitle">All financial areas awaiting Finance/CA review</p>
      </header>
      <FinancialReviewQueue
        items={items}
        title="Financial Review Queue"
        onAction={() => navigate('/finance-dashboard/sections')}
      />
    </div>
  );
}
