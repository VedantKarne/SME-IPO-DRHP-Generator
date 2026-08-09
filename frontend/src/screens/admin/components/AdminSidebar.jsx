/** * AdminSidebar.jsx
 * 
 * Distinct Navigation Shell component for System Admin users.
 * Displays the system console sidebar menu with 7 distinct sections:
 * (Overview, Users, Roles & Permissions, Projects, Audit Logs,
 * System Monitoring, Regulatory Rules).
 * 
 * Designed to look and feel like a system management console, completely
 * separate from the document IPO workspace sidebar used by other roles.
 */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Shield, LogOut, User } from 'lucide-react';
import { ADMIN_NAV_ITEMS } from '../config/adminNavConfig';
import { clearToken, decodeToken, getToken } from '../../../utils/auth';

export default function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    localStorage.removeItem('nirmaan_role');
    window.location.href = '/auth';
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-header">
        <Link to="/admin/overview" className="admin-sidebar-brand">
          <div className="admin-brand-icon">
            <Shield size={16} />
          </div>
          <div>
            <div className="admin-brand-title">Nirmaan AI</div>
            <div className="admin-brand-badge">System Admin Console</div>
          </div>
        </Link>
      </div>

      <nav className="admin-sidebar-nav">
        {ADMIN_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/admin/overview' && location.pathname.startsWith(item.path));

          return (
            <Link
              key={item.id}
              to={item.path}
              className={`admin-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="admin-sidebar-footer">
        <Link to="/profile" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', flex: 1, overflow: 'hidden' }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--status-approved)',
            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0
          }}>
            {decodeToken(getToken())?.email ? decodeToken(getToken()).email.substring(0, 2).toUpperCase() : <User size={14} />}
          </div>
          <div className="admin-user-info">
            <span className="admin-user-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {decodeToken(getToken())?.company_name || 'System Admin'}
            </span>
            <span className="admin-user-role" style={{ fontSize: '0.65rem' }}>
              ID: {decodeToken(getToken())?.nirmaan_id || 'N/A'}
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="admin-logout-btn"
          title="Log Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
