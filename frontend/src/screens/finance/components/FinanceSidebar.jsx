// Left navigation for the Finance/CA workspace. Only rendered on
// /finance-dashboard/* routes (see App.jsx) — the Founder/Merchant Banker
// app tree still renders components/GlobalSidebar.jsx unchanged.
//
// Reuses GlobalSidebar's existing sidebar CSS classes (.global-sidebar,
// .sidebar-brand, .sidebar-nav, .nav-item, .nav-icon, .sidebar-footer,
// .sidebar-logout — all defined in index.css, not landing-page-scoped) so
// the Finance/CA nav is visually identical to the rest of the app's chrome
// without introducing new styling. Only the nav item list and routes differ.
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Wallet, Folder, FileText, FileCheck2,
  ClipboardCheck, MessageSquare, Activity, LogOut, User,
} from 'lucide-react';
import { clearToken, decodeToken, getToken } from '../../../utils/auth';
import { broadcastUpdate } from '../../../utils/tabSync';

const NAV = [
  { path: '/finance-dashboard',              icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/finance-dashboard/financial-data', icon: Wallet,         label: 'Financial Data' },
  { path: '/finance-dashboard/documents',      icon: Folder,         label: 'Documents' },
  { path: '/finance-dashboard/sections',       icon: FileText,       label: 'DRHP Sections' },
  { path: '/finance-dashboard/evidence',       icon: FileCheck2,     label: 'Evidence' },
  { path: '/finance-dashboard/review-queue',   icon: ClipboardCheck, label: 'Review Queue' },
  { path: '/finance-dashboard/comments',       icon: MessageSquare,  label: 'Comments' },
  { path: '/finance-dashboard/activity',       icon: Activity,       label: 'Activity' },
];

export default function FinanceSidebar({ companyName }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  return (
    <aside className="shell-sidebar global-sidebar global-sidebar--static">
      <div className="sidebar-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/nirmaan-mark-dark.svg" alt="Nirmaan" className="sidebar-brand-logo" />
          <div className="sidebar-brand-name">Nirmaan</div>
        </div>
      </div>

      {companyName && <div className="sidebar-company">{companyName}</div>}
      <div className="sidebar-company" style={{ marginTop: -12 }}>Finance / CA Workspace</div>

      <nav className="sidebar-nav">
        {NAV.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">
                <item.icon size={18} strokeWidth={1.5} color={isActive ? 'var(--sidebar-signal)' : 'var(--sidebar-ink-soft)'} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <Link
          to="/profile"
          className="nav-item"
          style={{ marginBottom: '8px' }}
        >
          <span className="nav-icon">
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--sidebar-signal)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600
            }}>
              {decodeToken(getToken())?.email ? decodeToken(getToken()).email.substring(0, 2).toUpperCase() : <User size={14} />}
            </div>
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--sidebar-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {decodeToken(getToken())?.company_name || 'My Profile'}
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--sidebar-ink-soft)' }}>
              ID: {decodeToken(getToken())?.nirmaan_id || 'N/A'}
            </span>
          </div>
        </Link>
        <button
          className="nav-item sidebar-logout"
          onClick={() => { clearToken(); localStorage.removeItem('nirmaan_role'); broadcastUpdate('LOGOUT'); window.location.href = '/auth'; }}
        >
          <span className="nav-icon">
            <LogOut size={18} strokeWidth={1.5} color="var(--sidebar-ink-soft)" />
          </span>
          Log out
        </button>
      </div>
    </aside>
  );
}
