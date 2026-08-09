/** * AdminPlaceholderPage.jsx
 * 
 * Reusable placeholder shell for Admin Console sub-pages:
 * (Users, Roles & Permissions, Projects, Audit Logs, System Monitoring,
 * Regulatory Rules).
 * 
 * Provides a working "soon" console shell so routing functions cleanly
 * without errors pending the next build step.
 */
import { Settings } from 'lucide-react';

export default function AdminPlaceholderPage({ title, description }) {
  return (
    <div className="admin-page-container">
      <header className="admin-page-header">
        <h1 className="admin-page-title">{title}</h1>
        <p className="admin-page-subtitle">
          System Admin Console &mdash; {title}
        </p>
      </header>

      <div className="admin-placeholder-card">
        <div className="admin-placeholder-icon">
          <Settings size={24} />
        </div>
        <h3 className="admin-placeholder-title">{title}</h3>
        <p className="admin-placeholder-desc">
          {description || "This administrative console module is currently in development. Full management capabilities will be available in the next step."}
        </p>
      </div>
    </div>
  );
}
