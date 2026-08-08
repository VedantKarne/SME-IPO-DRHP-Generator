import { useState } from 'react';
import { Building2, PencilLine, CheckCircle2 } from 'lucide-react';
import { getToken, decodeToken } from '../utils/auth';
import { isDemoMode } from '../utils/demoMode';
import { DEMO_PROFILE_ANSWERS } from '../data/demoSeed.js';
import { PROFILE_SECTIONS, PROFILE_QUESTIONS, getCompanyProfile, saveCompanyProfile, computeProfileCompletion } from '../utils/companyProfile.js';
import ProfileChatModal from '../components/ProfileChatModal.jsx';

function formatAnswer(question, value) {
  if (value === undefined || value === null || value === '') {
    return <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>Not answered yet</span>;
  }
  if (Array.isArray(value)) {
    return value.length ? value.join(', ') : <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>Not answered yet</span>;
  }
  if (question.type === 'date') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return value;
}

export default function Profile({ companyName }) {
  const token = getToken();
  const companyId = token ? decodeToken(token)?.company_id : null;
  const demo = isDemoMode();

  const [answers, setAnswers] = useState(() => (demo ? DEMO_PROFILE_ANSWERS : getCompanyProfile(companyId)));
  const [editing, setEditing] = useState(false);

  const { percent, answeredCount, totalCount } = computeProfileCompletion(answers);
  const complete = percent === 100;

  const handleComplete = (newAnswers) => {
    const merged = saveCompanyProfile(companyId, newAnswers);
    setAnswers(merged);
    setEditing(false);
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 'var(--radius-md)',
          background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Building2 size={26} strokeWidth={1.5} color="var(--signal)" />
        </div>
        <div>
          <h1 style={{ margin: 0 }}>{companyName || 'Company Profile'}</h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Company profile from your onboarding questionnaire.
          </p>
        </div>
      </div>

      {/* Completion */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {complete
              ? <CheckCircle2 size={18} strokeWidth={2} color="var(--success)" />
              : null}
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--ink)' }}>
              Profile {percent}% complete
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {answeredCount} / {totalCount} questions answered
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--paper-sunken)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: complete ? 0 : 14 }}>
          <div style={{
            height: '100%', width: `${percent}%`,
            background: complete ? 'var(--status-approved)' : 'var(--accent)',
            borderRadius: 'var(--radius-md)', transition: 'width 0.6s ease',
          }} />
        </div>
        {!complete && (
          <button className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
            <PencilLine size={13} strokeWidth={2} /> Complete Profile
          </button>
        )}
      </div>

      {/* Grouped read-only answers */}
      {PROFILE_SECTIONS.map((section) => (
        <div key={section.id} className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>{section.label}</h3>
            {complete && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEditing(true)}
                aria-label={`Edit ${section.label}`}
              >
                <PencilLine size={12} strokeWidth={2} /> Edit
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PROFILE_QUESTIONS.filter((q) => q.section === section.id).map((q) => (
              <div key={q.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--rule)' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '55%' }}>{q.label}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--ink)', textAlign: 'right' }}>
                  {formatAnswer(q, answers[q.key])}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Edit modal */}
      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Complete company profile"
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(28,27,25,0.35)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            padding: '5vh 16px', overflowY: 'auto',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditing(false); }}
        >
          <div style={{ width: '100%', maxWidth: 480 }}>
            <ProfileChatModal
              initialAnswers={answers}
              onComplete={handleComplete}
              onClose={() => setEditing(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
