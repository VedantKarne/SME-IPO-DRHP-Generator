// Shared placeholder for the Finance/CA nav items that don't have real page
// content yet (Financial Data, Documents, DRHP Sections, Evidence, Review
// Queue, Comments, Activity — only the Dashboard itself is built out).
// Keeps every nav link routable to something real instead of a blank page.
export default function FinanceComingSoon({ label }) {
  return (
    <div className="fade-in">
      <div className="dashboard-greeting">{label}</div>
      <div className="card" style={{ marginTop: 20 }}>
        <p style={{ color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
          {label} is coming soon for the Finance / CA workspace.
        </p>
      </div>
    </div>
  );
}
