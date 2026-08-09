import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, CheckCircle2, Clock, X, Search, Briefcase, Scale, Shield, Building2, Check } from 'lucide-react';
import { authedFetch, getToken, decodeToken } from '../utils/auth';

const API = 'http://127.0.0.1:8000';

export default function TeamInvitations() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [myInvitations, setMyInvitations] = useState([]);
  const [loadingMyInvs, setLoadingMyInvs] = useState(false);

  const decodedToken = decodeToken(getToken());
  const storedCompanyId = localStorage.getItem('nirmaan_company_id');
  const companyId = (storedCompanyId && storedCompanyId !== 'null' && storedCompanyId !== 'undefined') ? storedCompanyId : decodedToken?.company_id;

  useEffect(() => {
    fetchTeam();
    fetchMyInvitations();
  }, [companyId]);

  const fetchMyInvitations = async () => {
    try {
      setLoadingMyInvs(true);
      const res = await authedFetch(`${API}/api/user/invitations`);
      if (res.ok) {
        setMyInvitations(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMyInvs(false);
    }
  };

  const handleAction = async (invitationId, action) => {
    try {
      const res = await authedFetch(`${API}/api/invitations/${invitationId}/${action}`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error(`Failed to ${action} invitation`);

      if (action === 'accept') {
        const inv = myInvitations.find(i => i.id === invitationId);
        if (inv) {
          localStorage.setItem('nirmaan_company_id', inv.company_id);
          localStorage.setItem('nirmaan_company_name', inv.company_name);
          window.location.href = '/workspace';
          return;
        }
      }

      fetchMyInvitations();
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const fetchTeam = async () => {
    if (!companyId) return;
    try {
      setLoading(true);
      const res = await authedFetch(`${API}/api/project/${companyId}/members`);
      if (!res.ok) throw new Error('Failed to fetch team');
      const data = await res.json();
      setMembers(data);
    } catch (err) {
      console.error(err);
      setError('Could not load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (invitationId) => {
    try {
      const res = await authedFetch(`${API}/api/invitations/${invitationId}/revoke`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Failed to revoke');
      fetchTeam();
      setSuccessMsg('Invitation revoked successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleRemove = async (userId) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await authedFetch(`${API}/api/project/${companyId}/members/${userId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove');
      fetchTeam();
      setSuccessMsg('Member removed successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <>
      <div className="fade-in" style={{ padding: '40px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>IPO Team</h1>
            <p style={{ color: 'var(--ink-soft)' }}>Manage the professionals collaborating on this IPO.</p>
          </div>
          <button
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={() => setIsInviteModalOpen(true)}
          >
            <UserPlus size={16} />
            Invite Professional
          </button>
        </div>

        {error && <div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
        {successMsg && <div style={{ padding: '12px', background: '#e8f5e9', color: '#2e7d32', borderRadius: '8px', marginBottom: '16px' }}>{successMsg}</div>}

        <div className="card" style={{ background: 'var(--paper-raised)', border: '1px solid var(--rule)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--rule)', background: 'var(--paper-sunken)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Team</h2>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>Loading team...</div>
          ) : members.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-soft)' }}>No team members yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--rule)', background: 'var(--paper)', textAlign: 'left', fontSize: '12px', color: 'var(--ink-faint)', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 24px', fontWeight: 500 }}>Person</th>
                  <th style={{ padding: '12px 24px', fontWeight: 500 }}>Role</th>
                  <th style={{ padding: '12px 24px', fontWeight: 500 }}>Status</th>
                  <th style={{ padding: '12px 24px', fontWeight: 500, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--rule)' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--ink)' }}>{m.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', background: 'var(--paper-sunken)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--rule)' }}>{m.nirmaan_id}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink)' }}>
                        {m.role === 'merchant_banker' ? <Briefcase size={14} color="var(--signal)" /> :
                         m.role === 'legal_advisor' ? <Scale size={14} color="var(--signal)" /> :
                         m.role === 'promoter' ? <Shield size={14} color="var(--status-approved)" /> :
                         <Users size={14} color="var(--ink-soft)" />}
                        <span style={{ textTransform: 'capitalize' }}>{m.role.replace('_', ' ')}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--ink-faint)', marginTop: '4px' }}>
                        {m.permission ? `Access: ${m.permission}` : (m.is_owner ? 'Project Owner' : '')}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px',
                        color: m.status === 'active' ? 'var(--status-approved)' :
                               m.status === 'pending' ? 'var(--status-draft)' : 'var(--ink-soft)' }}>
                        {m.status === 'active' ? <CheckCircle2 size={14} /> :
                         m.status === 'pending' ? <Clock size={14} /> : <span style={{display:'inline-block', width:8, height:8, borderRadius:4, background:'currentColor'}} />}
                        <span style={{ textTransform: 'capitalize' }}>{m.status}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      {!m.is_owner && m.status === 'active' && (
                        <button onClick={() => handleRemove(m.id)} style={{ color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }} title="Remove Member">
                          <Trash2 size={16} />
                        </button>
                      )}
                      {!m.is_owner && m.status === 'pending' && (
                        <button onClick={() => handleRevoke(m.invitation_id)} style={{ color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: '13px', textDecoration: 'underline' }}>
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* My Incoming Invitations */}
        <div style={{ marginTop: '48px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '16px' }}>My Incoming Invitations</h2>
          {loadingMyInvs ? (
            <div style={{ padding: '20px', color: 'var(--ink-soft)' }}>Loading invitations...</div>
          ) : myInvitations.length === 0 ? (
            <div className="card" style={{ padding: '24px', textAlign: 'center', background: 'var(--paper-raised)', border: '1px dashed var(--rule)', borderRadius: '12px', color: 'var(--ink-soft)' }}>
              No pending invitations.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {myInvitations.map(inv => (
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
      </div>

      {isInviteModalOpen && (
        <InviteModal
          onClose={() => setIsInviteModalOpen(false)}
          companyId={companyId}
          onSuccess={() => {
            setIsInviteModalOpen(false);
            setSuccessMsg('Invitation sent!');
            setTimeout(() => setSuccessMsg(''), 3000);
            fetchTeam();
          }}
        />
      )}
    </>
  );
}

function InviteModal({ onClose, companyId, onSuccess }) {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('merchant_banker');
  const [nirmaanId, setNirmaanId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [permission, setPermission] = useState('reviewer');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const handleVerify = async () => {
    if (!nirmaanId) return;
    setVerifying(true);
    setError('');
    try {
      const res = await authedFetch(`${API}/api/users/lookup/${nirmaanId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('No user found with this Nirmaan ID');
        throw new Error('Verification failed');
      }
      const data = await res.json();

      if (data.role !== role) {
        throw new Error(`This Nirmaan ID belongs to a ${data.role.replace('_', ' ')}. Please select the correct registered role.`);
      }

      setVerifiedUser(data);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      const res = await authedFetch(`${API}/api/project/${companyId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          nirmaan_id: nirmaanId,
          role: role,
          permission: permission
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to send invitation');

      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000 }}>
      <div className="card fade-in" style={{ width: '480px', background: 'var(--paper-raised)', borderRadius: '12px', padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Invite to IPO Project</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '24px' }}>
          {error && <div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}

          {step === 1 ? (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--ink-soft)' }}>Professional Role</label>
                <select
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--rule)', background: 'var(--paper)', fontSize: '14px' }}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="merchant_banker">Merchant Banker</option>
                  <option value="chartered_accountant">Chartered Accountant</option>
                  <option value="company_secretary">Company Secretary</option>
                  <option value="legal_advisor">Legal Advisor</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--ink-soft)' }}>Enter Nirmaan ID</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input
                    type="text"
                    placeholder="e.g. MB-10482"
                    value={nirmaanId}
                    onChange={(e) => setNirmaanId(e.target.value)}
                    style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--rule)', background: 'var(--paper)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
                  />
                  <button
                    className="btn btn-secondary"
                    onClick={handleVerify}
                    disabled={!nirmaanId || verifying}
                    style={{ padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    {verifying ? 'Verifying...' : <><Search size={16} /> Verify ID</>}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ background: 'var(--paper-sunken)', border: '1px solid var(--rule)', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-approved)', marginBottom: '12px', fontSize: '14px', fontWeight: 500 }}>
                  <CheckCircle2 size={16} /> User Verified
                </div>
                <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>{verifiedUser.name}</div>
                <div style={{ fontSize: '14px', color: 'var(--ink-soft)', marginTop: '4px' }}>{verifiedUser.organization}</div>
                <div style={{ fontSize: '13px', color: 'var(--ink-faint)', marginTop: '8px', display: 'flex', gap: '12px' }}>
                  <span style={{ textTransform: 'capitalize' }}>{verifiedUser.role.replace('_', ' ')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{verifiedUser.nirmaan_id}</span>
                </div>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--ink-soft)' }}>Project Permission</label>
                <select
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--rule)', background: 'var(--paper)', fontSize: '14px' }}
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="editor">Editor (Can draft & edit)</option>
                  <option value="reviewer">Reviewer (Can approve sections)</option>
                  <option value="admin">Admin (Full project access)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => { setStep(1); setError(''); }} style={{ padding: '10px 20px' }}>Back</button>
                <button className="btn btn-primary" onClick={handleSend} disabled={sending} style={{ padding: '10px 20px' }}>
                  {sending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
