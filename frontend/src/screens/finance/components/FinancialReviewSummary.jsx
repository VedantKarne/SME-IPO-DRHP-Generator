// Top summary panel for the Finance/CA dashboard: a readiness score ring
// (reusing the shared ScoreRing component/pattern from the Founder
// dashboard, per design-system.md's single-stroke score ring rule) plus
// three at-a-glance stats. Layout reuses the existing .readiness-hero /
// .readiness-stats / .stat-card classes already defined in index.css for
// the Founder dashboard's own readiness hero.
import ScoreRing from '../../../components/ScoreRing';

export default function FinancialReviewSummary({ summary }) {
  const { financial_readiness, documents_verified, documents_total, sections_pending, issues_found } = summary;

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div className="readiness-hero">
        <ScoreRing score={financial_readiness} />
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4, color: 'var(--ink)' }}>
            Financial Readiness
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: 20, maxWidth: 420 }}>
            Financial disclosures are {financial_readiness}% verified against source documents and financial statements.
          </p>
          <div className="readiness-stats">
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--status-approved)' }}>
                {documents_verified}/{documents_total}
              </div>
              <div className="stat-label">Documents Verified</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--status-draft)' }}>{sections_pending}</div>
              <div className="stat-label">Sections Pending</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--status-gap)' }}>{issues_found}</div>
              <div className="stat-label">Issues Found</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
