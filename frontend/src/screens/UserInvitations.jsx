import { useState, useEffect } from 'react';
import { Check, X, Building2, Shield, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authedFetch } from '../utils/auth';

const API = 'http://127.0.0.1:8000';

export default function UserInvitations() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvitations();
  }, []);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const res = await authedFetch(`${API}/api/user/invitations`);
      if (!res.ok) throw new Error('Failed to load invitations');
      const data = await res.json();
      setInvitations(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (invitationId, action) => {
    try {
      const res = await authedFetch(`${API}/api/invitations/${invitationId}/${action}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`Failed to ${action} invitation`);

      // If accepted, we can redirect to the company dashboard or just refresh
      if (action === 'accept') {
        // Find the company id
        const inv = invitations.find(i => i.id === invitationId);
        if (inv) {
          localStorage.setItem('nirmaan_company_id', inv.company_id);
          localStorage.setItem('nirmaan_company_name', inv.company_name);
          // Let's refresh the page fully to let App.jsx bootstrap grab the new projects list
          window.location.href = '/workspace';
          return;
        }
      }

      fetchInvitations();
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="fade-in" style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>

        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>My Invitations</h1>
          <p style={{ color: 'var(--ink-soft)' }}>Pending invitations to collaborate on IPO projects.</p>
        </div>

        {error && <div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading invitations...</div>
        ) : invitations.length === 0 ? (
          <div className="card fade-in" style={{ padding: '48px', textAlign: 'center', background: 'var(--paper-raised)', border: '1px solid var(--rule)', borderRadius: '12px' }}>
            <div style={{ display: 'inline-flex', padding: '16px', background: 'var(--paper-sunken)', borderRadius: '50%', marginBottom: '16px', color: 'var(--ink-faint)' }}>
              <Clock size={32} />
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--ink)', marginBottom: '8px' }}>No Pending Invitations</h3>
            <p style={{ color: 'var(--ink-soft)', fontSize: '14px', maxWidth: '300px', margin: '0 auto' }}>
              When a Founder or Promoter invites you to collaborate on their IPO, it will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {invitations.map(inv => (
              <div key={inv.id} className="card fade-in" style={{ background: 'var(--paper-raised)', border: '1px solid var(--rule)', borderRadius: '12px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: 'var(--paper-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)' }}>
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px 0' }}>{inv.company_name}</h3>
                    <p style={{ fontSize: '14px', color: 'var(--ink-soft)', margin: '0 0 12px 0' }}>IPO Collaboration</p>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--ink-faint)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={14} /> Role: <span style={{ color: 'var(--ink)', textTransform: 'capitalize' }}>{inv.role.replace('_', ' ')}</span></span>
                      <span>Access: <span style={{ color: 'var(--ink)', textTransform: 'capitalize' }}>{inv.permission}</span></span>
                      <span>Invited by: <span style={{ color: 'var(--ink)' }}>{inv.invited_by_name}</span></span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => handleAction(inv.id, 'decline')}
                    style={{ background: 'transparent', border: '1px solid var(--rule)', borderRadius: '6px', padding: '8px 16px', color: 'var(--ink-soft)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}
                  >
                    <X size={16} /> Decline
                  </button>
                  <button
                    onClick={() => handleAction(inv.id, 'accept')}
                    style={{ background: 'var(--signal)', border: 'none', borderRadius: '6px', padding: '8px 16px', color: 'white', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}
                  >
                    <Check size={16} /> Accept
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
  );
}
