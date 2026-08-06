import { useState, useEffect, useRef } from 'react';
import { authedFetch, decodeToken, getToken } from '../utils/auth';
import { FinancialsForm, DirectorsForm, OfferForm } from './onboardingForms.jsx';

const API = 'http://127.0.0.1:8000';

// The three fiscal years SEBI eligibility is assessed over, newest last.
const currentFY = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
const FISCAL_YEARS = [currentFY - 2, currentFY - 1, currentFY];

// The interview keeps its conversational opening, then switches to structured
// forms for the tabular data. Three years of financials and a board of directors
// cannot be captured reliably as chat answers, and previously they were not
// captured at all — financial_statement, director_kmp and offer_details each
// held zero rows, so generation had no company facts to draft from.
const INTERVIEW_SCRIPT = [
  { ai: "Hi! I'm Nirmaan AI. I'll help you prepare your SME IPO — one step at a time.\n\nFirst, what is your company's name?" },
  { ai: "Got it. And what does your company do?" },
  { ai: "How many years has your company been operating?" },
  { ai: "Thanks. Now the parts that need exact figures — these feed your eligibility assessment and the drafted sections directly.", action: 'form_financials' },
  { ai: "Next, your board and key managerial personnel.", action: 'form_directors' },
  { ai: "Last one — the offer you're planning.", action: 'form_offer' },
  { ai: null, action: 'eligibility_check' },
  { ai: "That's everything I need to start. Setting up your workspace…" },
];

export default function Landing({ onComplete }) {
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [done, setDone] = useState(false);
  const [userAnswers, setUserAnswers] = useState([]);
  const messagesEndRef = useRef(null);
  const hasInit = useRef(false);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;
    showAIMessage(0);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const showAIMessage = (scriptIndex, currentAnswers = userAnswers) => {
    const entry = INTERVIEW_SCRIPT[scriptIndex];
    if (!entry) return;

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
        setTimeout(() => showAIMessage(scriptIndex + 1, currentAnswers), 600);
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
    setStep(next);
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

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputVal.trim() || isTyping || isChecking) return;

    const userMsg = inputVal.trim();
    setInputVal('');
    setMessages(prev => [...prev, { type: 'user', text: userMsg }]);

    const newAnswers = [...userAnswers, userMsg];
    setUserAnswers(newAnswers);

    const nextStep = step + 1;
    setStep(nextStep);

    // The three free-text answers are complete at this point, so persist the
    // company name and context before the structured steps begin — the
    // eligibility check later in the script reads from the database.
    if (newAnswers.length === 3) {
      const [name, industry, years] = newAnswers;
      postWizard(`/api/companies/${companyId()}/setup`, {
        name: name || 'SME Company',
        industry: industry || '',
        years: years || '',
      }).catch(err => console.error('Company setup failed:', err));
    }

    if (nextStep >= INTERVIEW_SCRIPT.length) {
      setTimeout(() => {
        setDone(true);
        setTimeout(onComplete, 800);
      }, 500);
    } else {
      setTimeout(() => showAIMessage(nextStep, newAnswers), 400);
    }
  };

  // A form card takes over input while it is on screen; the text box would
  // otherwise sit there inviting an answer that goes nowhere.
  const awaitingForm = messages.some(m => m.type === 'form');
  const inputDisabled = isTyping || isChecking || done || awaitingForm;

  return (
    <div className="landing">
      <div className="landing-bg" />
      <div className="landing-grid" />

      <div className="landing-content">
        <div className="landing-logo">
          <div className="landing-logo-mark">N</div>
          <div className="landing-logo-text">Nirmaan AI</div>
        </div>
        <p className="landing-tagline">
          Build your IPO. Not your paperwork.
        </p>

        <div className="interview-window" style={{ width: '100%' }}>
          <div className="interview-header">
            <div className="interview-avatar">N</div>
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
                    <div className="interview-avatar" style={{ width: 28, height: 28, fontSize: '0.7rem', flexShrink: 0, marginTop: 2 }}>N</div>
                    <div className="interview-msg-ai-bubble" style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                  </div>
                )}
                {msg.type === 'user' && (
                  <div className="interview-msg-user-bubble">{msg.text}</div>
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
                  <div style={{ padding: '14px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12 }}>
                    {msg.error ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 600 }}>
                        ⚠️ Eligibility check {msg.error}. It will run again once your
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
                          fontSize: '0.8rem', fontWeight: 600, marginBottom: 10,
                          color: msg.report.eligible ? 'var(--success)' : 'var(--warning)',
                        }}>
                          {msg.report.eligible
                            ? '✅ Meets the SEBI checks we can evaluate'
                            : '⚠️ Some SEBI checks are not met yet'}
                        </div>
                        {msg.report.checks.map((c, i) => (
                          <div key={i} title={c.reason} style={{ fontSize: '0.8rem', padding: '3px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                              <span style={{ color: c.passed ? 'var(--success)' : 'var(--warning)' }}>
                                {c.passed ? '✓ Pass' : '⚠️ Not met'}
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
                <div className="interview-avatar" style={{ width: 28, height: 28, fontSize: '0.7rem', flexShrink: 0 }}>N</div>
                {isChecking ? (
                  <div className="interview-msg-ai-bubble" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <span className="spin" style={{ fontSize: '1rem' }}>⟳</span>
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

          <div className="interview-input-area">
            <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, width: '100%' }}>
              <input
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                placeholder={done ? 'Setting up your workspace...' : awaitingForm ? 'Complete the form above to continue…' : 'Type your answer...'}
                disabled={inputDisabled}
                style={{ flex: 1 }}
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={inputDisabled || !inputVal.trim()}>
                ↑
              </button>
            </form>
          </div>
        </div>

        {/* Skip link */}
        <button
          onClick={onComplete}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Skip to demo workspace →
        </button>
      </div>
    </div>
  );
}
