import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Zap, WifiOff } from 'lucide-react';
import { setToken } from '../utils/auth';

const API = 'http://127.0.0.1:8000';

/**
 * makeMockToken(email, companyName)
 *
 * Builds a structurally valid JWT (header.payload.signature) entirely in the
 * browser when the backend is unreachable. The token satisfies:
 *   - decodeToken(): base64-decodes the middle segment into a JSON object
 *   - isTokenExpired(): payload.exp is 30 days from now (well in the future)
 *   - bootstrap() in App.jsx: company_id and company_name are present
 *
 * The signature segment is a static placeholder -- there is no secret key,
 * so this token is intentionally NOT secure. It is only used as a session
 * stand-in while the backend is offline (development / demo only).
 */
function makeMockToken(email, companyName) {
  const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    sub:          email,
    company_id:   'mock-' + email.replace(/[^a-z0-9]/gi, '-'),
    company_name: companyName || email.split('@')[0],
    exp:          Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
    iat:          Math.floor(Date.now() / 1000),
  }));
  const sig = btoa('offline-mock-signature');
  return `${header}.${payload}.${sig}`;
}

export default function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cin, setCin] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // True when the backend is unreachable and a mock session was created
  const [offlineMode, setOfflineMode] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOfflineMode(false);
    
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
      // TypeError = fetch itself failed = backend is down / unreachable.
      // In that case, mint a mock token from the entered credentials so the
      // user can still navigate the frontend without the backend running.
      if (err instanceof TypeError) {
        const name = isLogin
          ? email.split('@')[0]          // derive a name from email on login
          : (companyName || email.split('@')[0]); // use the typed company name on register
        setToken(makeMockToken(email, name));
        setOfflineMode(true);
        onAuthSuccess(!isLogin);
      } else {
        // Real server error (wrong credentials, validation, etc.) -- show it.
        setError(err.message);
      }
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
    setOfflineMode(false);

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
      if (err instanceof TypeError) {
        // Backend unreachable -- create a mock demo session
        setToken(makeMockToken('demo@nirmaan.ai', 'Nirmaan Technologies Ltd'));
        setOfflineMode(true);
        onAuthSuccess(false);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing">
      <div className="landing-bg" />
      <div className="landing-grid" />

      <div className="auth-wrapper">
        <Link to="/" className="landing-logo" style={{ marginBottom: '2.5rem', textDecoration: 'none', cursor: 'pointer' }}>
          <img src="/nirmaan-mark.svg" alt="Nirmaan AI Logo" className="landing-logo-mark" />
          <div className="landing-logo-text">Nirmaan AI</div>
        </Link>

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
