import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clearToken } from '../utils/auth';
import { broadcastUpdate } from '../utils/tabSync';

const NAV = [
  { path: '/dashboard',       icon: '📊', label: 'Dashboard' },
  { path: '/workspace',       icon: '📝', label: 'Document Workspace' },
  { path: '/documents',       icon: '📁', label: 'Documents' },
  { path: '/eligibility',     icon: '✅', label: 'Eligibility Engine' },
  { path: '/review',          icon: '👤', label: 'Banker Review' },
  { path: '/knowledge-base',  icon: '🧠', label: 'Knowledge Base' },
];

export default function GlobalSidebar({ companyName, approvedCount }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/workspace');

  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  const sidebarClass = 'global-sidebar--static';

  return (
    <>
      <aside className={`shell-sidebar global-sidebar ${sidebarClass}`}>
        <div className="sidebar-brand" style={{ justifyContent: 'space-between', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="sidebar-brand-logo">N</div>
            <div className="sidebar-brand-name">Nirmaan</div>
          </div>
        </div>

        {companyName && (
          <div className="sidebar-company">
            {companyName}
            <button 
              onClick={() => { clearToken(); broadcastUpdate('LOGOUT'); window.location.reload(); }}
              style={{ display: 'block', marginTop: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Log out
            </button>
          </div>
        )}

        <nav className="sidebar-nav">
          {NAV.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <hr className="sidebar-divider" />

        <div className="sidebar-progress">
          <div className="progress-label">Sections Complete</div>
          <div>
            <span className="progress-count">{approvedCount || 0}</span>
            <span className="progress-sub"> / 25</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${((approvedCount || 0) / 25) * 100}%` }} />
          </div>
        </div>

        <div className="sidebar-status">
          <div className="status-dot" />
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>System Online</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Groq + BGE-M3</div>
          </div>
        </div>
      </aside>
    </>
  );
}
