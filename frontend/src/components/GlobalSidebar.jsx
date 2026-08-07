import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileEdit, Folder, CheckCircle2, UserCheck, BookOpen } from 'lucide-react';
import { clearToken } from '../utils/auth';
import { broadcastUpdate } from '../utils/tabSync';

const NAV = [
  { path: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/workspace',       icon: FileEdit,        label: 'Document Workspace' },
  { path: '/documents',       icon: Folder,          label: 'Documents' },
  { path: '/eligibility',     icon: CheckCircle2,    label: 'Eligibility Engine' },
  { path: '/review',          icon: UserCheck,       label: 'Banker Review' },
  { path: '/knowledge-base',  icon: BookOpen,        label: 'Knowledge Base' },
];

export default function GlobalSidebar({ companyName, approvedCount }) {
  const [isOpen, setIsOpen] = useState(false);
  // Real health, polled. The badge below used to be permanently green with no
  // underlying check, so an unreachable backend or an empty retrieval corpus
  // still displayed "System Online".
  const [health, setHealth] = useState(null);
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/workspace');

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
              style={{ display: 'block', marginTop: '8px', background: 'none', border: 'none', color: 'var(--sidebar-ink-soft)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Log out
            </button>
          </div>
        )}

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
      </aside>
    </>
  );
}
