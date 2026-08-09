/** * AdminOverview.jsx
 * 
 * System Admin Overview Page.
 * Displays system-level analytics, key platform metrics (Active Projects,
 * Active Users, Pending Reviews, System Alerts), and summary panels for
 * Users, Projects, and Audit Logs.
 * 
 * Styled as an administrative console per design_system.md.
 */
import {
  ADMIN_SUMMARY_METRICS,
  ADMIN_USERS_SUMMARY,
  ADMIN_PROJECTS_SUMMARY,
  ADMIN_AUDIT_SUMMARY
} from './data/adminMockData';

export default function AdminOverview() {
  return (
    <div className="admin-page-container">
      <header className="admin-page-header">
        <h1 className="admin-page-title">System Overview</h1>
        <p className="admin-page-subtitle">
          Real-time metrics, platform usage summary, and system-wide activity logs.
        </p>
      </header>

      {/* Top summary row of key metrics */}
      <section className="admin-metrics-grid">
        {ADMIN_SUMMARY_METRICS.map((metric) => (
          <div key={metric.id} className="admin-metric-card">
            <div className="admin-metric-header">
              <span className="admin-metric-label">{metric.label}</span>
            </div>
            <div className="admin-metric-value">{metric.value}</div>
            <div className={`admin-metric-footer ${metric.status}`}>
              {metric.change}
            </div>
          </div>
        ))}
      </section>

      {/* Summary Panels Grid */}
      <section className="admin-panels-grid">
        {/* Panel 1: Users Overview */}
        <div className="admin-panel-card">
          <div className="admin-panel-header">
            <h2 className="admin-panel-title">{ADMIN_USERS_SUMMARY.title}</h2>
            <p className="admin-panel-subtitle">{ADMIN_USERS_SUMMARY.subtitle}</p>
          </div>
          <div className="admin-panel-list">
            {ADMIN_USERS_SUMMAIY.roleBreakdown.map((item, idx) => (
              <div key={idx} className="admin-panel-row">
                <span className="admin-row-name">{item.role}</span>
                <span className="admin-row-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: Projects Overview */}
        <div className="admin-panel-card">
          <div className="admin-panel-header">
            <h2 className="admin-panel-title">{ADMIN_PROJECTS_SUMMAIY.title}</h2>
            <p className="admin-panel-subtitle">{ADMIN_PROJECTS_SUMMAIY.subtitle}</p>
          </div>
          <div className="admin-panel-list">
            {ADMIN_PROJECTS_SUMMARY.stageBreakdown.map((item, idx) => (
              <div key={idx} className="admin-panel-row">
                <span className="admin-row-name">{item.stage}</span>
                <span className="admin-row-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Panel 3: Audit Events Today */}
        <div className="admin-panel-card">
          <div className="admin-panel-header">
            <h2 className="admin-panel-title">{ADMIN_AUDIT_SUMMARY.title}</h2>
            <p className="admin-panel-subtitle">{ADMIN_AUDIT_SUMMARY.subtitle}</p>
          </div>
          <div className="admin-panel-list">
            {ADMIN_AUDIT_SUMMARY.recentEvents.map((item) => (
              <div key={item.id} className="admin-panel-row">
                <span className="admin-row-name">{item.type}</span>
                <span className="admin-row-count">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
