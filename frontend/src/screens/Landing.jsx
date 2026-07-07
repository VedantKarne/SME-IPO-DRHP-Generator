import { useState, useEffect, useRef } from 'react';

const INTERVIEW_SCRIPT = [
  { ai: "Hi! I'm Nirmaan AI. I'll help you prepare your SME IPO — one step at a time.\n\nWhat does your company do?" },
  { ai: "Great. How many years has your company been operating?" },
  { ai: "And what's your approximate annual revenue for FY 2024?" },
  { ai: "Are there any pending litigations against your directors or KMPs?" },
  { ai: null, action: 'eligibility_check' }, // triggers animation
  { ai: "Your company looks like a strong SME IPO candidate! 🎉\n\nLet me set up your personalized workspace..." },
];

export default function Landing({ onComplete }) {
  const [step, setStep] = useState(0);
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [done, setDone] = useState(false);
  const messagesEndRef = useRef(null);
  const hasInit = useRef(false);  // ← guards against StrictMode double-fire

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

    if (entry.action === 'eligibility_check') {
      setIsChecking(true);
      setTimeout(() => {
        setIsChecking(false);
        setMessages(prev => [...prev, { type: 'eligibility' }]);
        setTimeout(() => showAIMessage(scriptIndex + 1), 600);
      }, 2200);
      return;
    }

    setIsTyping(true);
    const delay = 700 + entry.ai.length * 6;
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { type: 'ai', text: entry.ai }]);
      
      // If this is the last message, automatically trigger completion
      if (scriptIndex === INTERVIEW_SCRIPT.length - 1) {
        setTimeout(() => {
          setDone(true);
          setTimeout(onComplete, 1200);
        }, 800);
      }
    }, Math.min(delay, 1800));
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputVal.trim() || isTyping || isChecking) return;

    const userMsg = inputVal.trim();
    setInputVal('');
    setMessages(prev => [...prev, { type: 'user', text: userMsg }]);

    const nextStep = step + 1;
    setStep(nextStep);

    if (nextStep >= INTERVIEW_SCRIPT.length) {
      // Done — navigate
      setTimeout(() => {
        setDone(true);
        setTimeout(onComplete, 800);
      }, 500);
    } else {
      setTimeout(() => showAIMessage(nextStep), 400);
    }
  };

  const inputDisabled = isTyping || isChecking || done;

  return (
    <div className="landing">
      <div className="landing-bg" />
      <div className="landing-grid" />

      <div className="landing-content">
        {/* Brand */}
        <div className="landing-logo">
          <div className="landing-logo-mark">N</div>
          <div className="landing-logo-text">Nirmaan AI</div>
        </div>
        <p className="landing-tagline">
          Build your IPO. Not your paperwork.
        </p>

        {/* Interview window */}
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
                {msg.type === 'eligibility' && (
                  <div style={{ padding: '14px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, marginBottom: 10 }}>
                      ✅ Eligibility Check Complete
                    </div>
                    {[
                      { label: 'EBITDA Track Record', pass: true },
                      { label: 'Positive Net Worth', pass: true },
                      { label: 'Post-Issue Capital Limit', pass: true },
                      { label: 'KMP Litigation', pass: false, note: '⚠️ Disclosure required' },
                    ].map((c, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '3px 0' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
                        <span style={{ color: c.pass ? 'var(--success)' : 'var(--warning)' }}>
                          {c.pass ? '✓ Pass' : c.note}
                        </span>
                      </div>
                    ))}
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
                placeholder={done ? 'Setting up your workspace...' : 'Type your answer...'}
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
