// Finance/CA's DRHP Sections page — comment on, request clarification on,
// or finance-verify the financial-related DRHP sections. Scoped to
// FINANCE_APPROVABLE_SECTIONS only; a section already certified by the
// Merchant Banker (locked) renders read-only — mirroring how
// screens/Review.jsx already splits pending vs. certified sections.
//
// Receives `sections`/`setSections` as the same shared App.jsx state
// screens/Dashboard.jsx and screens/Review.jsx use, and updates it the
// same way Review.jsx's certify button does, so every page stays in sync
// without each maintaining its own copy.
import { useState } from 'react';
import { MessageSquare, HelpCircle, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';
import { getCurrentRole } from '../../utils/auth';
import { can, FINANCE_APPROVABLE_SECTIONS } from '../../permissions/financeRolePermissions';
import { addFinanceComment, financeReviewSection } from './api';

function SectionCard({ role, section, onApproved }) {
  const [activeInput, setActiveInput] = useState(null); // 'comment' | 'clarify' | null
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const canComment = can(role, 'commentOnSection', section.name, section);
  const canApprove = can(role, 'approveSection', section.name, section);
  const financeVerified = section.status === 'finance_verified';

  const submitNote = async (requestClarification) => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await addFinanceComment(section.id, note.trim(), requestClarification);
      setStatus(requestClarification ? 'Clarification requested — visible on the Founder’s dashboard.' : 'Comment saved.');
      setNote('');
      setActiveInput(null);
    } catch (err) {
      setStatus('Could not save that — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      await financeReviewSection(section.id);
      onApproved(section.id);
    } catch (err) {
      setStatus('Could not approve — please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="finance-card" style={{ marginBottom: 20 }}>
      <div className="finance-section-head">
        <div>
          <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--ink)' }}>{section.name}</h3>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', marginTop: 2 }}>
            Completeness: {Math.round((section.score || 0) * 100)}%
          </div>
        </div>
        <div className="finance-section-actions">
          {section.locked && <span className="badge badge-success"><Lock size={11} strokeWidth={2} /> Certified</span>}
          {!section.locked && financeVerified && (
            <span className="badge badge-success"><CheckCircle2 size={11} strokeWidth={2} /> Finance Verified</span>
          )}
          {canComment && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveInput(activeInput === 'comment' ? null : 'comment')}>
                <MessageSquare size={13} strokeWidth={2} /> Comment
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveInput(activeInput === 'clarify' ? null : 'clarify')}>
                <HelpCircle size={13} strokeWidth={2} /> Request Clarification
              </button>
            </>
          )}
          {canApprove && !financeVerified && (
            <button type="button" className="btn btn-success btn-sm" onClick={handleApprove} disabled={busy}>
              <CheckCircle2 size={13} strokeWidth={2} /> Approve
            </button>
          )}
        </div>
      </div>

      <div className="finance-section-preview">
        {(section.draft_text || 'No draft yet.').slice(0, 400)}
        {section.draft_text?.length > 400 ? '…' : ''}
      </div>

      {activeInput && (
        <div className="fade-in" style={{ marginTop: 12 }}>
          <input
            type="text" autoFocus
            placeholder={activeInput === 'clarify' ? 'Describe what you need clarified and press Enter…' : 'Type your comment and press Enter…'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitNote(activeInput === 'clarify'); }}
          />
        </div>
      )}

      {status && <div className="finance-section-status">{status}</div>}

      {section.flagged_gaps?.length > 0 && (
        <div className="finance-section-gaps">
          <AlertTriangle size={13} strokeWidth={2} /> {section.flagged_gaps.length} unresolved gap(s).
        </div>
      )}
    </div>
  );
}

export default function FinanceSections({ sections = [], setSections }) {
  const role = getCurrentRole();
  const financialSections = sections.filter((s) => FINANCE_APPROVABLE_SECTIONS.includes(s.name));

  const handleApproved = (sectionId) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, status: 'finance_verified' } : s)));
  };

  return (
    <div className="finance-page">
      <header className="finance-header">
        <h1 className="finance-title">DRHP Sections</h1>
        <p className="finance-subtitle">Review, comment on, and certify financial sections of the DRHP.</p>
      </header>

      {financialSections.length === 0 ? (
        <div className="finance-card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--ink-faint)' }}>No financial sections drafted yet.</p>
        </div>
      ) : (
        financialSections.map((s) => (
          <SectionCard key={s.id || s.name} role={role} section={s} onApproved={handleApproved} />
        ))
      )}
    </div>
  );
}
