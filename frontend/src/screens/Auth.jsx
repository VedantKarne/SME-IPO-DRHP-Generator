import { useState } from 'react';
import { Loader2, Zap } from 'lucide-react';
import { setToken } from '../utils/auth';

const API = 'http://127.0.0.1:8000';

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cin, setCin] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
        ? { email, password }
        : { email, password, company_name: companyName, cin };
        
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }
      
      setToken(data.access_token);
      onAuthSuccess(!isLogin); // Pass true if it was a registration
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLogin(true);
    setEmail('demo@nirmaan.ai');
    setPassword('demo123');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@nirmaan.ai', password: 'demo123' })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Demo login failed');
      }

      setToken(data.access_token);
      onAuthSuccess(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing">
      <div className="landing-bg" />
      <div className="landing-grid" />

      <div className="auth-wrapper">
        <div className="landing-logo" style={{ marginBottom: '2.5rem' }}>
          <div className="landing-logo-mark">N</div>
          <div className="landing-logo-text">Nirmaan AI</div>
        </div>

        <div className="auth-card fade-in">
          <div className="auth-tabs">
            <button 
              className={`auth-tab ${isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(true); setError(null); }}
            >
              Log In
            </button>
            <button 
              className={`auth-tab ${!isLogin ? 'active' : ''}`}
              onClick={() => { setIsLogin(false); setError(null); }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
            {!isLogin && (
              <>
                <div className="auth-input-group">
                  <label className="auth-label">Company Name</label>
                  <input 
                    type="text" required 
                    value={companyName} onChange={e => setCompanyName(e.target.value)} 
                    placeholder="Enter your company name"
                  />
                </div>
                <div className="auth-input-group">
                  <label className="auth-label">CIN (Corporate Identification Number)</label>
                  <input 
                    type="text" required 
                    value={cin} onChange={e => setCin(e.target.value)} 
                    placeholder="e.g. L12345MH2021PTC123456"
                  />
                </div>
              </>
            )}

            <div className="auth-input-group">
              <label className="auth-label">Email Address</label>
              <input 
                type="email" required 
                value={email} onChange={e => setEmail(e.target.value)} 
                placeholder="name@company.com"
              />
            </div>

            <div className="auth-input-group">
              <label className="auth-label">Password</label>
              <input 
                type="password" required 
                value={password} onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div style={{ padding: '12px', marginBottom: '16px', background: 'var(--error-dim)', color: 'var(--error)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', textAlign: 'center', border: '1px solid var(--error)' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', marginTop: '8px', fontSize: '1rem' }} disabled={loading}>
              {loading ? <Loader2 size={16} strokeWidth={2} className="spin" /> : (isLogin ? 'Log In to Workspace' : 'Create Company Account')}
            </button>
          </form>

          {/* Quick Demo Access for Hackathon Reviewers & Judges */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--rule)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-soft)', marginBottom: '12px', fontWeight: 500, letterSpacing: '0.02em' }}>
              Evaluating for Hackathon Demo?
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDemoLogin}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--ink)',
                borderColor: 'var(--rule)',
                background: 'var(--paper-sunken)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {loading ? <Loader2 size={16} strokeWidth={2} className="spin" /> : (
                <>
                  <Zap size={15} color="var(--signal)" />
                  <span>One-Click Demo Access</span>
                </>
              )}
            </button>
            <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: '10px', fontFamily: 'var(--font-ui)' }}>
              Default credentials: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)', background: 'var(--paper-sunken)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--rule)' }}>demo@nirmaan.ai</code> / <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)', background: 'var(--paper-sunken)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--rule)' }}>demo123</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
