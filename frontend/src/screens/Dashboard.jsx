import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'http://localhost:8000';

function ScoreRing({ score, size = 140, stroke = 10, color = 'var(--accent)' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [anim, setAnim] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnim(score), 300);
    return () => clearTimeout(t);
  }, [score]);

  const filled = circ * (1 - anim / 100);

  return (
    <div className="readiness-ring-wrap" style={{ width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={filled}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)', filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="readiness-ring-label">
        <span className="readiness-pct" style={{ fontSize: size * 0.28, lineHeight: 1 }}>{score}%</span>
        <span className="readiness-pct-label" style={{ fontSize: size * 0.14, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.08em', marginTop: 2 }}>READY</span>
      </div>
    </div>
  );
}

const SUBSCORES = [
  { key: 'financial_score', label: 'Financials', icon: '💰', color: 'var(--success)' },
  { key: 'legal_score',     label: 'Legal',      icon: '⚖️', color: 'var(--accent)' },
  { key: 'management_score',label: 'Management', icon: '👤', color: 'var(--purple)' },
  { key: 'overall_score',   label: 'Compliance', icon: '📋', color: 'var(--warning)' },
];

const NEXT_ACTIONS = [
  { icon: '📄', title: 'Upload Audited Financials', desc: 'FY2022–FY2024 Balance Sheets required for Revenue section', urgent: true },
  { icon: '📝', title: 'Generate Risk Factors section', desc: 'Click Generate in Document Workspace', urgent: false },
  { icon: '⚖️', title: 'Resolve KMP Litigation disclosure', desc: 'Rahul Sharma — provide litigation details for mandatory disclosure', urgent: true },
  { icon: '✅', title: 'Get Merchant Banker approval', desc: '2 sections awaiting intermediary certification', urgent: false },
];

export default function Dashboard({ companyId, companyName, sections, readiness, eligibility }) {
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const promoterName = 'Vedant';

  const r = readiness || {};
  const overall = r.overall_score || 0;
  const pending = r.sections_pending ?? 22;
  const approved = r.sections_approved ?? 0;
  const openGaps = r.total_open_gaps ?? 0;

  // Estimate days based on pending sections
  const estimatedDays = pending * 2;

  return (
    <div className="fade-in">
      {/* Greeting */}
      <div className="dashboard-greeting">
        {greeting}, {promoterName} 👋
      </div>
      <div className="dashboard-company">{companyName || 'Loading company...'}</div>

      {/* Hero — Readiness + Stats */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="readiness-hero">
          <ScoreRing score={overall} />
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>
              IPO Readiness Score
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 380 }}>
              Your DRHP preparation is {overall}% complete. {pending > 0 ? `${pending} sections still need to be generated and reviewed.` : 'All sections generated — final review pending.'}
            </p>
            <div className="readiness-stats">
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--warning)' }}>{estimatedDays}</div>
                <div className="stat-label">Est. Days Remaining</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--error)' }}>{openGaps + (eligibility?.checks?.filter(c => !c.passed).length || 0)}</div>
                <div className="stat-label">Open Issues</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--success)' }}>{approved}</div>
                <div className="stat-label">Sections Approved</div>
              </div>
            </div>
          </div>
        </div>

        <button className="btn btn-primary btn-lg" style={{ marginTop: 8 }} onClick={() => navigate('/workspace')}>
          Continue Preparation →
        </button>
      </div>

      {/* Sub-score rings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {SUBSCORES.map(({ key, label, icon, color }) => (
          <div key={key} className="card card-sm" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{icon}</div>
            <ScoreRing score={r[key] || 0} size={100} stroke={8} color={color} />
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: 12 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Section quick overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Sections status */}
        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Section Pipeline</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Approved & Locked', count: approved, color: 'var(--success)' },
              { label: 'In Draft', count: r.sections_in_draft || 0, color: 'var(--warning)' },
              { label: 'Not Started', count: pending, color: 'var(--text-muted)' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontWeight: 700, color }}>{count}</span>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/workspace')}>
              Open Workspace →
            </button>
          </div>
        </div>

        {/* Eligibility quick status */}
        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Eligibility Checks</h3>
          {eligibility ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {eligibility.checks.slice(0, 4).map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                  <span className={`badge ${c.passed ? 'badge-success' : 'badge-error'}`}>
                    {c.passed ? '✓ Pass' : '✗ Fail'}
                  </span>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/eligibility')}>
                Full Report →
              </button>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</p>
          )}
        </div>
      </div>

      {/* Next Actions */}
      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: '0.95rem' }}>Next Actions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {NEXT_ACTIONS.map((a, i) => (
            <div key={i} style={{
              display: 'flex', gap: 14, alignItems: 'flex-start',
              padding: '12px 14px',
              background: a.urgent ? 'rgba(244,63,94,0.05)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${a.urgent ? 'rgba(244,63,94,0.15)' : 'var(--glass-border)'}`,
              borderRadius: 10
            }}>
              <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{a.icon}</span>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2 }}>{a.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{a.desc}</div>
              </div>
              {a.urgent && <span className="badge badge-error" style={{ marginLeft: 'auto', flexShrink: 0 }}>Urgent</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
