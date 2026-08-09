import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, Zap, Briefcase, Scale, ArrowLeft, Shield } from 'lucide-react';
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
function makeMockToken(email, companyName, role = 'promoter') {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  
  // Generate random nirmaan_id
  const prefix = role.split('_').map(w => w[0].toUpperCase()).join('').substring(0, 2) || 'PR';
  const suffix = Math.floor(Math.random() * 90000 + 10000);
  const nirmaan_id = `${prefix}-${suffix}`;

  const payload = btoa(JSON.stringify({
    sub: email,
    company_id: 'mock-' + email.replace(/[^a-z0-9]/gi, '-'),
    company_name: companyName || email.split('@')[0],
    role: role,
    email: email,
    nirmaan_id: nirmaan_id,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
    iat: Math.floor(Date.now() / 1000),
  }));
  const sig = btoa('offline-mock-signature');
  return `${header}.${payload}.${sig}`;
}

export default function Auth({ onAuthSuccess }) {
  const location = useLocation();
  const selectedRole = location.state?.role;
  const landingRole = selectedRole || localStorage.getItem('nirmaan_role');
  const showFounderDemo = !landingRole || landingRole === 'founder';
  const showBankerDemo  = !landingRole || landingRole === 'merchant_banker';
  const showLegalDemo   = !landingRole || landingRole === 'legal_advisor';
  const showAdminDemo   = !landingRole || landingRole === 'admin';
  const showFinanceDemo = !landingRole || landingRole === 'finance_ca';

  const [isLogin, setIsLogin] = useState(true);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [cin, setCin] = useState('');

  const [loading, setLoading] = useState(false);
  const [demoRole, setDemoRole] = useState(null); // 'founder' | 'banker' — which quick-access button is mid-request
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
        : {
            email, password, company_name: companyName, cin,
            ...(selectedRole ? { role: selectedRole } : {}),
          };

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
      onAuthSuccess(!isLogin, selectedRole); // Pass true if it was a registration

    } catch (err) {
      // TypeError = fetch itself failed = backend is down / unreachable.
      // In that case, mint a mock token from the entered credentials so the
      // user can still navigate the frontend without the backend running.
      if (err instanceof TypeError) {
        const name = isLogin
          ? email.split('@')[0]          // derive a name from email on login
          : (companyName || email.split('@')[0]); // use the typed company name on register
        setToken(makeMockToken(email, name, selectedRole || 'promoter'));
        setOfflineMode(true);
        onAuthSuccess(!isLogin, selectedRole);
      } else {
        // Real server error (wrong credentials, validation, etc.) -- show it.
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (roleLabel, demoEmail, demoPassword) => {
    setIsLogin(true);
    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoading(true);
    setDemoRole(roleLabel);
    setError(null);
    setOfflineMode(false);

    // Persist the role so App.jsx routes correctly after demo login
    const roleMap = { founder: 'founder', banker: 'merchant_banker', legal: 'legal_advisor', admin: 'admin', finance: 'finance_ca' };
    if (roleMap[roleLabel]) localStorage.setItem('nirmaan_role', roleMap[roleLabel]);

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Demo login failed');
      }

      setToken(data.access_token);
      onAuthSuccess(false, roleMap[roleLabel]);
    } catch (err) {
      if (err instanceof TypeError || roleLabel === 'legal' || roleLabel === 'admin' || roleLabel === 'finance') {
        const rName = roleMap[roleLabel] || 'promoter';
        const dEmail = roleLabel === 'admin' ? 'admin@nirmaan.ai' : roleLabel === 'legal' ? 'legal@nirmaan.ai' : roleLabel === 'finance' ? 'finance@nirmaan.ai' : demoEmail;
        const dName = roleLabel === 'admin' ? 'System Administrator' : roleLabel === 'legal' ? 'Legal Advisor Demo' : roleLabel === 'finance' ? 'Finance / CA Demo' : 'TechServ Solutions Ltd';
        setToken(makeMockToken(dEmail, dName, rName));
        setOfflineMode(true);
        onAuthSuccess(false, rName);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setDemoRole(null);
    }
  };

  return (
    <div className="landing">
      <div className="landing-bg" />
      <div className="landing-grid" />

      <Link 
        to="/" 
        style={{
          position: 'absolute',
          top: '2.5rem',
          left: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: 'var(--ink-soft)',
          textDecoration: 'none',
          fontWeight: 500,
          fontSize: '0.875rem',
          transition: 'all 0.2s ease',
          zIndex: 10,
          fontFamily: 'var(--font-sans, inherit)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--ink)';
          e.currentTarget.style.transform = 'translateX(-4px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--ink-soft)';
          e.currentTarget.style.transform = 'translateX(0)';
        }}
      >
        <ArrowLeft size={16} />
        Back to Home
      </Link>

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

            {showFounderDemo && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleDemoLogin('founder', 'demo@nirmaan.ai', 'demo123')}
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
                  {demoRole === 'founder' ? <Loader2 size={16} strokeWidth={2} className="spin" /> : (
                    <>
                      <Zap size={15} color="var(--signal)" />
                      <span>Founder Demo Access</span>
                    </>
                  )}
                </button>
                <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: '10px', marginBottom: showBankerDemo || showLegalDemo ? '16px' : '0', fontFamily: 'var(--font-ui)' }}>
                  Default credentials: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)', background: 'var(--paper-sunken)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--rule)' }}>demo@nirmaan.ai</code> / <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)', background: 'var(--paper-sunken)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--rule)' }}>demo123</code>
                </div>
              </>
            )}

            {showBankerDemo && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleDemoLogin('banker', 'banker@nirmaan.ai', 'banker123')}
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
                  {demoRole === 'banker' ? <Loader2 size={16} strokeWidth={2} className="spin" /> : (
                    <>
                      <Briefcase size={15} color="var(--signal)" />
                      <span>Merchant Banker Demo Access</span>
                    </>
                  )}
                </button>
                <div style={{ fontSize: '11px', color: 'var(--ink-faint)', marginTop: '10px', marginBottom: showLegalDemo ? '16px' : '0', fontFamily: 'var(--font-ui)' }}>
                  Default credentials: <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)', background: 'var(--paper-sunken)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--rule)' }}>banker@nirmaan.ai</code> / <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)', background: 'var(--paper-sunken)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--rule)' }}>banker123</code>
                </div>
              </>
            )}

            {showLegalDemo && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleDemoLogin('legal', 'legal@nirmaan.ai', 'legal123')}
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
                  {demoRole === 'legal' ? <Loader2 size={16} strokeWidth={2} className="spin" /> : (
                    <>
                      <Scale size={15} color="var(--signal)" />
                      <span>Legal Advisor Demo Access</span>
                    </>
                  )}
                </button>
              </>
            )}

            {showFinanceDemo && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleDemoLogin('finance', 'finance@nirmaan.ai', 'finance123')}
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
                    gap: '8px',
                    marginTop: '12px'
                  }}
                >
                  {demoRole === 'finance' ? <Loader2 size={16} strokeWidth={2} className="spin" /> : (
                    <>
                      <Zap size={15} color="var(--signal)" />
                      <span>Finance / CA Demo Access</span>
                    </>
                  )}
                </button>
              </>
            )}

            {showAdminDemo && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleDemoLogin('admin', 'admin@nirmaan.ai', 'admin123')}
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
                    gap: '8px',
                    marginTop: '12px'
                  }}
                >
                  {demoRole === 'admin' ? <Loader2 size={16} strokeWidth={2} className="spin" /> : (
                    <>
                      <Shield size={15} color="var(--signal)" />
                      <span>System Admin Demo Access</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
