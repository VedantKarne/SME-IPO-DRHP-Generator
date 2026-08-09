import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Shield, Hash, Copy, CheckCircle2 } from 'lucide-react';
import { getToken, decodeToken, getCurrentRole } from '../utils/auth';

export default function UserProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    role: '',
    nirmaan_id: '',
    company_name: '',
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setProfile({
          name: decoded.company_name || decoded.email?.split('@')[0] || 'User',
          email: decoded.email || 'user@example.com',
          role: decoded.role || getCurrentRole() || 'user',
          nirmaan_id: decoded.nirmaan_id || 'N/A',
          company_name: decoded.company_name || 'N/A',
        });
      }
    }
  }, []);

  const handleCopyId = () => {
    if (profile.nirmaan_id && profile.nirmaan_id !== 'N/A') {
      navigator.clipboard.writeText(profile.nirmaan_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatRole = (roleStr) => {
    return roleStr
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getInitials = (name) => {
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--paper-sunken)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ backgroundColor: 'var(--paper)', borderBottom: '1px solid var(--rule)', padding: '16px 24px', display: 'flex', alignItems: 'center' }}>
        <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '8px', border: 'none' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ margin: '0 0 0 16px', fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)' }}>User Profile</h1>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 24px' }}>
        <div className="card" style={{ maxWidth: '600px', width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--signal)', 
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem', fontWeight: 700, letterSpacing: '1px'
            }}>
              {getInitials(profile.name)}
            </div>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: 'var(--ink)' }}>{profile.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink-soft)', fontSize: '0.9rem' }}>
                <Shield size={14} />
                <span>{formatRole(profile.role)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            
            <div style={{ padding: '16px', backgroundColor: 'var(--paper-sunken)', borderRadius: '8px', border: '1px solid var(--rule)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Hash size={12} /> Nirmaan ID
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>
                  {profile.nirmaan_id}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-faint)', marginTop: '4px' }}>
                  Provide this ID to your administrator for IPO allotment.
                </div>
              </div>
              <button onClick={handleCopyId} className="btn btn-secondary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {copied ? <CheckCircle2 size={16} color="var(--status-approved)" /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy ID'}
              </button>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--paper-sunken)', borderRadius: '8px', border: '1px solid var(--rule)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={12} /> Email Address
              </div>
              <div style={{ fontSize: '1rem', color: 'var(--ink)' }}>
                {profile.email}
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--paper-sunken)', borderRadius: '8px', border: '1px solid var(--rule)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={12} /> Full Name (Editable Demo)
              </div>
              <input 
                type="text" 
                value={profile.name} 
                onChange={(e) => setProfile({...profile, name: e.target.value})}
                className="input-text" 
                style={{ width: '100%', maxWidth: '300px' }}
              />
              <div style={{ fontSize: '0.8rem', color: 'var(--ink-faint)', marginTop: '8px' }}>
                Changes are simulated locally for this demo.
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
