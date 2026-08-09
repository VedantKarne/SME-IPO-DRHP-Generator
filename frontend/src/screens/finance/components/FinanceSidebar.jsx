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
  ClipboardCheck, MessageSquare, Activity, LogOut,
} from 'lucide-react';
import { clearToken } from '../../../utils/auth';
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
        <hr className="sidebar-divider" />
        <button
          className="nav-item sidebar-logout"
          onClick={() => { clearToken(); broadcastUpdate('LOGOUT'); window.location.reload(); }}
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
