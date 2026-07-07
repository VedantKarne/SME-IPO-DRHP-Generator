import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

const API = 'http://localhost:8000';

const NAV = [
  { path: '/dashboard',  icon: '📊', label: 'Dashboard' },
  { path: '/workspace',  icon: '📝', label: 'Document Workspace' },
  { path: '/documents',  icon: '📁', label: 'Documents' },
  { path: '/eligibility',icon: '✅', label: 'Eligibility Engine' },
  { path: '/review',     icon: '👤', label: 'Banker Review' },
];

function CopilotRail({ companyId, currentSection }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hi! I\'m your IPO Copilot. Ask me anything about regulations, sections, or how to improve your draft.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/copilot/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, current_section: currentSection || 'General', question: q })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'ai', text: data.answer }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: 'I couldn\'t reach the server. Please ensure the backend is running.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Connection error. Please check the backend.' }]);
    }
    setLoading(false);
  };

  const quickPrompts = [
    'What is DRHP?',
    'Explain SEBI ICDR Reg 229 in simple terms',
    'What documents does a promoter need to submit?',
    'Why is KMP litigation disclosure required?',
  ];

  return (
    <aside className="shell-copilot">
      <div className="copilot-header">
        <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--accent), #7c3aed)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>N</div>
        <div>
          <div className="copilot-title">IPO Copilot</div>
          <div className="copilot-subtitle">Regulatory AI assistant</div>
        </div>
      </div>

      <div className="copilot-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai'} fade-in`}>
            {msg.role === 'ai' && <div className="chat-sender">Nirmaan</div>}
            {msg.role === 'user' && <div className="chat-sender" style={{ textAlign: 'right' }}>You</div>}
            <div className="chat-bubble-content" style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg chat-msg-ai fade-in">
            <div className="typing-indicator">
              <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick prompts */}
      {messages.length === 1 && (
        <div style={{ padding: '0 14px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {quickPrompts.map(p => (
            <button key={p} onClick={() => {
              setInput('');
              // Simulate form submit with the prompt
              const fakeEvent = { preventDefault: () => {} };
              setInput(p);
              setTimeout(() => {
                setMessages(prev => [...prev, { role: 'user', text: p }]);
                setLoading(true);
                fetch(`${API}/api/copilot/ask`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ company_id: companyId, current_section: currentSection || 'General', question: p })
                }).then(r => r.ok ? r.json() : null)
                  .then(data => {
                    if (data) setMessages(prev => [...prev, { role: 'ai', text: data.answer }]);
                    else setMessages(prev => [...prev, { role: 'ai', text: 'Backend unreachable.' }]);
                    setLoading(false);
                    setInput('');
                  })
                  .catch(() => { setMessages(prev => [...prev, { role: 'ai', text: 'Connection error.' }]); setLoading(false); });
              }, 10);
            }} className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start', fontSize: '0.75rem' }}>
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="copilot-input-area">
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, width: '100%' }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask me anything..." disabled={loading} style={{ flex: 1, fontSize: '0.82rem' }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()} style={{ flexShrink: 0, padding: '8px 12px' }}>↑</button>
        </form>
      </div>
    </aside>
  );
}

export default function AppShell({ children, companyId, companyName, approvedCount, currentSection }) {
  const location = useLocation();

  return (
    <div className="shell">
      {/* Sidebar */}
      <aside className="shell-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-logo">N</div>
          <div className="sidebar-brand-name">Nirmaan</div>
        </div>

        {companyName && (
          <div className="sidebar-company">{companyName}</div>
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

        {/* Progress tracker */}
        <div className="sidebar-progress">
          <div className="progress-label">Sections Complete</div>
          <div>
            <span className="progress-count">{approvedCount}</span>
            <span className="progress-sub"> / 25</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${(approvedCount / 25) * 100}%` }} />
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

      {/* Main */}
      <main className="shell-main">{children}</main>

      {/* Copilot */}
      <CopilotRail companyId={companyId} currentSection={currentSection} />
    </div>
  );
}
