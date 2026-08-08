import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileEdit, Folder, CheckCircle2, User, LogOut } from 'lucide-react';
import { clearToken } from '../utils/auth';
import { broadcastUpdate } from '../utils/tabSync';
import useCanvasStore from '../canvas/services/canvasStore.js';

// "Banker Review" and "Knowledge Base" moved to BankerSidebar.jsx — the
// Merchant Banker role now has its own dedicated page set (see App.jsx's
// role-based routing) rather than sharing the founder's nav.
const NAV = [
  { path: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/workspace',       icon: FileEdit,        label: 'Document Workspace' },
  { path: '/documents',       icon: Folder,          label: 'Documents' },
  { path: '/eligibility',     icon: CheckCircle2,    label: 'Eligibility Engine' },
  { path: '/profile',         icon: User,            label: 'Profile' },
];

export default function GlobalSidebar({ companyName, approvedCount }) {
  const [isOpen, setIsOpen] = useState(false);
  // Real health, polled. The badge below used to be permanently green with no
  // underlying check, so an unreachable backend or an empty retrieval corpus
  // still displayed "System Online".
  const [health, setHealth] = useState(null);
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/workspace');

  // The Sections panel (rendered inside the Workspace canvas, not here) takes
  // over as the primary side panel while in rail mode — see canvasStore.js.
  const navRailCollapsed = useCanvasStore((s) => s.navRailCollapsed);
  const setNavRailCollapsed = useCanvasStore((s) => s.setNavRailCollapsed);
  const railMode = isWorkspace && navRailCollapsed;

  useEffect(() => { setIsOpen(false); }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/health');
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setHealth(data ?? { healthy: false, reachable: false });
      } catch {
        if (!cancelled) setHealth({ healthy: false, reachable: false });
      }
    };
    check();
    const timer = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const sidebarClass = `global-sidebar--static${railMode ? ' global-sidebar--rail' : ''}`;

  return (
    <>
      <aside className={`shell-sidebar global-sidebar ${sidebarClass}`}>
        <div className="sidebar-brand" style={{ justifyContent: railMode ? 'center' : 'space-between', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/nirmaan-mark-dark.svg" alt="Nirmaan" className="sidebar-brand-logo" />
            {!railMode && <div className="sidebar-brand-name">Nirmaan</div>}
          </div>
        </div>

        {!railMode && companyName && (
          <div className="sidebar-company">{companyName}</div>
        )}

        <nav className="sidebar-nav">
          {NAV.map(item => {
            const isActive = location.pathname === item.path;
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
                {!railMode && item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
        {!railMode && (
        <>
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
          <div
            className="status-dot"
            style={{
              background: health === null ? 'var(--sidebar-ink-soft)'
                : health.healthy ? 'var(--status-approved)'
                : 'var(--status-draft)',
            }}
          />
          <div>
            <div style={{
              fontSize: '0.75rem', fontWeight: 600,
              color: health === null ? 'var(--sidebar-ink-soft)'
                : health.healthy ? 'var(--status-approved)'
                : 'var(--status-draft)',
            }}>
              {health === null ? 'Checking…'
                : health.reachable === false ? 'Backend unreachable'
                : health.healthy ? 'System Online'
                : 'Degraded'}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-ink-soft)' }}>
              {health === null ? '\u00a0'
                : health.reachable === false ? 'Start the API server'
                : !health.llm_configured ? 'GROQ_API_KEY not set'
                : !health.retrieval_ready ? 'Corpus not indexed — drafts will be ungrounded'
                : `Corpus: ${(health.corpus?.regulatory_clauses ?? 0).toLocaleString()} reg / ${(health.corpus?.precedent_chunks ?? 0).toLocaleString()} prec`}
            </div>
          </div>
        </div>
        </>
        )}

          <button
            className="nav-item sidebar-logout"
            title={railMode ? 'Log out' : undefined}
            onClick={() => { clearToken(); broadcastUpdate('LOGOUT'); window.location.reload(); }}
          >
            <span className="nav-icon">
              <LogOut size={18} strokeWidth={1.5} color="var(--sidebar-ink-soft)" />
            </span>
            {!railMode && 'Log out'}
          </button>
        </div>
      </aside>
    </>
  );
}
