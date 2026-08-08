import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { authedFetch, decodeToken, getToken } from '../utils/auth';
import { FinancialsForm, DirectorsForm, OfferForm } from './onboardingForms.jsx';
import { saveCompanyProfile, PROFILE_QUESTIONS } from '../utils/companyProfile.js';
import ProfileQuestionInput from '../components/ProfileQuestionInput.jsx';

const API = 'http://127.0.0.1:8000';

// The three fiscal years SEBI eligibility is assessed over, newest last.
const currentFY = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
const FISCAL_YEARS = [currentFY - 2, currentFY - 1, currentFY];

// The company profile step (org type, industry, business model, size, IPO
// plans) is asked one question at a time in the chat itself — see
// askProfileQuestion below and components/ProfileQuestionInput.jsx.
// The tabular steps that follow (three years of financials, a board of
// directors, offer terms) stay as structured form cards: that data doesn't
// fit a chat exchange, and previously it wasn't captured at all —
// financial_statement, director_kmp and offer_details each held zero rows,
// so generation had no company facts to draft from.
const INTERVIEW_SCRIPT = [
  { ai: "Hi! I'm Nirmaan AI. I'll help you prepare your SME IPO — one step at a time.\n\nFirst, let's set up your company profile.", action: 'form_profile' },
  { ai: "Thanks. Now the parts that need exact figures — these feed your eligibility assessment and the drafted sections directly.", action: 'form_financials' },
  { ai: "Next, your board and key managerial personnel.", action: 'form_directors' },
  { ai: "Last one — the offer you're planning.", action: 'form_offer' },
  { ai: null, action: 'eligibility_check' },
  { ai: "That's everything I need to start. Setting up your workspace…" },
];

export default function Onboarding({ onComplete }) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [done, setDone] = useState(false);
  const messagesEndRef = useRef(null);
  const hasInit = useRef(false);
  // Accumulated across the 11 profile questions as they're answered. A ref,
  // not state — it's only ever read once, at the end, to persist the whole
  // set in one call; each individual answer is already visible as its own
  // chat bubble the moment it's given.
  const profileAnswersRef = useRef({});

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;
    showAIMessage(0);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const showAIMessage = (scriptIndex) => {
    const entry = INTERVIEW_SCRIPT[scriptIndex];
    if (!entry) return;

    // The profile step is a real back-and-forth: one question, one answer,
    // repeated — not a card dropped into the transcript.
    if (entry.action === 'form_profile') {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [
          ...prev,
          ...(entry.ai ? [{ type: 'ai', text: entry.ai }] : []),
        ]);
        askProfileQuestion(0, scriptIndex);
      }, 500);
      return;
    }

    // Structured capture steps render a form card instead of asking for text.
    if (entry.action && entry.action.startsWith('form_')) {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [
          ...prev,
          ...(entry.ai ? [{ type: 'ai', text: entry.ai }] : []),
          { type: 'form', form: entry.action, scriptIndex },
        ]);
      }, 500);
      return;
    }

    if (entry.action === 'eligibility_check') {
      setIsChecking(true);

      const token = getToken();
      if (!token) return;
      const { company_id } = decodeToken(token);

      // Run the real EligibilityEngine rather than displaying a fixed result.
      // Three of the four checks shown here used to be hardcoded `pass: true`
      // under an "Eligibility Check Complete" heading, so a founder was told
      // they met SEBI thresholds that had never been evaluated.
      (async () => {
        let report = null;
        let error = null;
        try {
          const res = await authedFetch(`http://127.0.0.1:8000/api/eligibility/${company_id}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          report = await res.json();
        } catch (e) {
          console.error('Eligibility check failed:', e);
          error = e.message || 'could not be completed';
        }
        setIsChecking(false);
        setMessages(prev => [...prev, { type: 'eligibility', report, error }]);
        setTimeout(() => showAIMessage(scriptIndex + 1), 600);
      })();
      return;
    }

    setIsTyping(true);
    const delay = 700 + entry.ai.length * 6;
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { type: 'ai', text: entry.ai }]);

      if (scriptIndex === INTERVIEW_SCRIPT.length - 1) {
        setTimeout(() => {
          setDone(true);
          setTimeout(onComplete, 1200);
        }, 800);
      }
    }, Math.min(delay, 1800));
  };

  /** Ask PROFILE_QUESTIONS[qIdx], or wrap up the profile step if it's past the end. */
  const askProfileQuestion = (qIdx, scriptIndex) => {
    const question = PROFILE_QUESTIONS[qIdx];
    if (!question) {
      // Mock persistence — see utils/companyProfile.js for why (no backend
      // schema exists for these fields yet). This is what makes the survey
      // resumable from the Profile page if a user skips it here.
      saveCompanyProfile(companyId(), profileAnswersRef.current);
      setTimeout(() => showAIMessage(scriptIndex + 1), 400);
      return;
    }
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        { type: 'ai', text: question.label },
        { type: 'profile_active', questionIdx: qIdx, scriptIndex },
      ]);
    }, 500);
  };

  const handleProfileAnswer = (qIdx, scriptIndex, value) => {
    const question = PROFILE_QUESTIONS[qIdx];
    profileAnswersRef.current = { ...profileAnswersRef.current, [question.key]: value };
    setMessages(prev => [
      ...prev.filter(m => !(m.type === 'profile_active' && m.questionIdx === qIdx)),
      { type: 'user', text: Array.isArray(value) ? value.join(', ') : value },
    ]);
    askProfileQuestion(qIdx + 1, scriptIndex);
  };

  const handleProfileSkip = (qIdx, scriptIndex) => {
    setMessages(prev => [
      ...prev.filter(m => !(m.type === 'profile_active' && m.questionIdx === qIdx)),
      { type: 'user', text: 'Skipped' },
    ]);
    askProfileQuestion(qIdx + 1, scriptIndex);
  };

  const companyId = () => {
    const token = getToken();
    return token ? decodeToken(token)?.company_id : null;
  };

  /** POST to a wizard endpoint, surfacing the server's own error text. */
  const postWizard = async (path, body) => {
    const res = await authedFetch(`${API}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      throw new Error(detail.detail || `HTTP ${res.status}`);
    }
    return res.json();
  };

  /** Advance past a form card, recording what was actually saved. */
  const finishForm = (scriptIndex, summary) => {
    setMessages(prev => [
      ...prev.filter(m => !(m.type === 'form' && m.scriptIndex === scriptIndex)),
      { type: 'user', text: summary },
    ]);
    const next = scriptIndex + 1;
    setTimeout(() => showAIMessage(next), 400);
  };

  const formHandlers = {
    form_financials: {
      save: async (rows) => {
        // replace=false is implicit: financials upsert by fiscal year.
        await postWizard(`/api/wizard/financials/${companyId()}`, rows);
        return `Added financials for ${rows.length} year${rows.length > 1 ? 's' : ''}`;
      },
    },
    form_directors: {
      save: async (rows) => {
        await postWizard(`/api/wizard/directors/${companyId()}?replace=true`, rows);
        const flagged = rows.filter(r => r.pending_litigation).length;
        return `Added ${rows.length} director${rows.length > 1 ? 's' : ''}`
          + (flagged ? ` (${flagged} with pending litigation)` : '');
      },
    },
    form_offer: {
      save: async (offer) => {
        await postWizard(`/api/wizard/offer/${companyId()}?replace=true`, offer);
        const lakhs = (offer.total_shares_offered * offer.price_per_share) / 100000;
        return `Offer: ${offer.total_shares_offered.toLocaleString()} shares at ₹${offer.price_per_share} `
          + `(₹${lakhs.toLocaleString(undefined, { maximumFractionDigits: 2 })} lakhs)`;
      },
    },
  };

  return (
    <div className="landing">
      <div className="landing-bg" />
      <div className="landing-grid" />

      <div className="landing-content">
        <div className="landing-logo">
          <img src="/nirmaan-mark.svg" alt="" className="landing-logo-mark" />
          <div className="landing-logo-text">Nirmaan AI</div>
        </div>
        <p className="landing-tagline">
          Build your IPO. Not your paperwork.
        </p>

        <div className="interview-window" style={{ width: '100%' }}>
          <div className="interview-header">
            <img src="/nirmaan-mark.svg" alt="" className="interview-avatar" />
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Nirmaan AI</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>IPO Preparation Assistant</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="status-dot" />
              <span style={{ fontSize: '0.7rem', color: 'var(--success)' }}>Online</span>
            </div>
          </div>

          <div className="interview-messages">
            {messages.map((msg, i) => (
              <div key={i} className="fade-in">
                {msg.type === 'ai' && (
                  <div className="interview-msg-ai">
                    <img src="/nirmaan-mark.svg" alt="" className="interview-avatar" style={{ width: 24, height: 28, flexShrink: 0, marginTop: 2 }} />
                    <div className="interview-msg-ai-bubble" style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                  </div>
                )}
                {msg.type === 'user' && (
                  <div className="interview-msg-user-bubble">{msg.text}</div>
                )}
                {msg.type === 'profile_active' && (
                  <ProfileQuestionInput
                    question={PROFILE_QUESTIONS[msg.questionIdx]}
                    onSubmit={(value) => handleProfileAnswer(msg.questionIdx, msg.scriptIndex, value)}
                    onSkip={() => handleProfileSkip(msg.questionIdx, msg.scriptIndex)}
                  />
                )}

                {msg.type === 'form' && (
                  <>
                    {msg.form === 'form_financials' && (
                      <FinancialsForm
                        years={FISCAL_YEARS}
                        onSave={async (rows) => {
                          const summary = await formHandlers.form_financials.save(rows);
                          finishForm(msg.scriptIndex, summary);
                        }}
                        onSkip={() => finishForm(msg.scriptIndex, 'Skipped financials for now')}
                      />
                    )}
                    {msg.form === 'form_directors' && (
                      <DirectorsForm
                        onSave={async (rows) => {
                          const summary = await formHandlers.form_directors.save(rows);
                          finishForm(msg.scriptIndex, summary);
                        }}
                        onSkip={() => finishForm(msg.scriptIndex, 'Skipped directors for now')}
                      />
                    )}
                    {msg.form === 'form_offer' && (
                      <OfferForm
                        onSave={async (offer) => {
                          const summary = await formHandlers.form_offer.save(offer);
                          finishForm(msg.scriptIndex, summary);
                        }}
                        onSkip={() => finishForm(msg.scriptIndex, 'Skipped offer details for now')}
                      />
                    )}
                  </>
                )}

                {msg.type === 'eligibility' && (
                  <div style={{ padding: '14px 16px', background: 'var(--success-dim)', border: '1px solid var(--success)', borderRadius: 'var(--radius-lg)' }}>
                    {msg.error ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 600 }}>
                        <AlertTriangle size={14} strokeWidth={2} /> Eligibility check {msg.error}. It will run again once your
                        financials and director details are on file.
                      </div>
                    ) : !msg.report?.checks?.length ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Not enough data yet to assess eligibility. Upload audited
                        financials and add director details to run the SEBI checks.
                      </div>
                    ) : (
                      <>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: '0.8rem', fontWeight: 600, marginBottom: 10,
                          color: msg.report.eligible ? 'var(--success)' : 'var(--warning)',
                        }}>
                          {msg.report.eligible
                            ? <><CheckCircle2 size={14} strokeWidth={2} /> Meets the SEBI checks we can evaluate</>
                            : <><AlertTriangle size={14} strokeWidth={2} /> Some SEBI checks are not met yet</>}
                        </div>
                        {msg.report.checks.map((c, i) => (
                          <div key={i} title={c.reason} style={{ fontSize: '0.8rem', padding: '3px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: c.passed ? 'var(--success)' : 'var(--warning)' }}>
                                {c.passed
                                  ? <><CheckCircle2 size={12} strokeWidth={2} /> Pass</>
                                  : <><AlertTriangle size={12} strokeWidth={2} /> Not met</>}
                              </span>
                            </div>
                            {!c.passed && c.reason && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                {c.reason}
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {(isTyping || isChecking) && (
              <div className="interview-msg-ai fade-in">
                <img src="/nirmaan-mark.svg" alt="" className="interview-avatar" style={{ width: 24, height: 28, flexShrink: 0 }} />
                {isChecking ? (
                  <div className="interview-msg-ai-bubble" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <Loader2 size={15} strokeWidth={2} className="spin" />
                    Running eligibility check...
                  </div>
                ) : (
                  <div className="typing-indicator">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Skip link — bypasses whatever's left of onboarding; a real user's
            profile just stays incomplete, resumable later from /profile. */}
        {!done && (
          <button
            onClick={onComplete}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Skip to workspace <ArrowRight size={12} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
}
