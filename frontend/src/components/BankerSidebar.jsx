import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ListChecks, FileEdit, ShieldCheck, ClipboardList,
  BadgeCheck, Activity, Folder, BookOpen, LogOut, Mail, FileText, User
} from 'lucide-react';
import { clearToken, decodeToken, getToken } from '../utils/auth';
import { broadcastUpdate } from '../utils/tabSync';
import useCanvasStore from '../canvas/services/canvasStore.js';
import { needsReview } from '../utils/reviewStatus.js';

const NAV = [
  { path: '/banker/overview', icon: LayoutDashboard, label: 'Overview' },
  { path: '/banker/review-queue', icon: ListChecks, label: 'Review Queue', badgeKey: 'reviewQueue' },
  { path: '/workspace', icon: FileEdit, label: 'DRHP Workspace' },
  { path: '/banker/compliance', icon: ShieldCheck, label: 'Compliance' },
  { path: '/banker/evidence', icon: ClipboardList, label: 'Evidence' },
  { path: '/banker/approvals', icon: BadgeCheck, label: 'Approvals' },
  { path: '/reports', icon: FileText, label: 'Reports' },
  { path: '/banker/activity', icon: Activity, label: 'Activity & Audit' },
  { path: '/documents', icon: Folder, label: 'Documents' },
  { path: '/knowledge-base', icon: BookOpen, label: 'Knowledge Base' },
  { path: '/invitations', icon: Mail, label: 'My Invitations' },
];

export default function BankerSidebar({ companyName, sections = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/workspace');

  // Same mutual-exclusivity as GlobalSidebar: the Workspace's own Sections
  // panel takes over as the primary side panel while in rail mode.
  const navRailCollapsed = useCanvasStore((s) => s.navRailCollapsed);
  const setNavRailCollapsed = useCanvasStore((s) => s.setNavRailCollapsed);
  const railMode = isWorkspace && navRailCollapsed;

  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  const badges = { reviewQueue: sections.filter(needsReview).length };
  const sidebarClass = `global-sidebar--static${railMode ? ' global-sidebar--rail' : ''}`;

  return (
    <aside className={`shell-sidebar global-sidebar ${sidebarClass}`}>
      <div className="sidebar-brand" style={{ justifyContent: railMode ? 'center' : 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/nirmaan-mark-dark.svg" alt="Nirmaan" className="sidebar-brand-logo" />
          {!railMode && <div className="sidebar-brand-name">Nirmaan</div>}
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(item => {
          const isActive = location.pathname === item.path;
          const badgeCount = item.badgeKey ? badges[item.badgeKey] : null;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
              title={railMode ? item.label : undefined}
              onClick={item.path === '/workspace' ? () => setNavRailCollapsed(true) : undefined}
            >
              <span className="nav-icon">
                <item.icon size={18} strokeWidth={1.5} color={isActive ? 'var(--sidebar-signal)' : 'var(--sidebar-ink-soft)'} />
              </span>
              {!railMode && (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                  {item.label}
                  {!!badgeCount && (
                    <span
                      style={{
                        fontSize: '0.68rem', fontWeight: 700, minWidth: 18, textAlign: 'center',
                        padding: '1px 6px', borderRadius: 999,
                        background: isActive ? 'var(--sidebar-signal)' : 'var(--sidebar-ink-soft)',
                        color: 'var(--sidebar)',
                      }}
                    >
                      {badgeCount}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <Link
          to="/profile"
          className="nav-item"
          title={railMode ? 'User Profile' : undefined}
          style={{ marginTop: railMode ? '0' : '16px', marginBottom: '8px' }}
        >
          <span className="nav-icon">
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--sidebar-signal)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600
            }}>
              {decodeToken(getToken())?.email ? decodeToken(getToken()).email.substring(0, 2).toUpperCase() : <User size={14} />}
            </div>
          </span>
          {!railMode && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--sidebar-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {decodeToken(getToken())?.company_name || 'My Profile'}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--sidebar-ink-soft)' }}>
                ID: {decodeToken(getToken())?.nirmaan_id || 'N/A'}
              </span>
            </div>
          )}
        </Link>

        <button
          className="nav-item sidebar-logout"
          title={railMode ? 'Log out' : undefined}
          onClick={() => { clearToken(); localStorage.removeItem('nirmaan_role'); broadcastUpdate('LOGOUT'); window.location.href = '/auth'; }}
        >
          <span className="nav-icon">
            <LogOut size={18} strokeWidth={1.5} color="var(--sidebar-ink-soft)" />
          </span>
          {!railMode && 'Log out'}
        </button>
      </div>
    </aside>
  );
}
