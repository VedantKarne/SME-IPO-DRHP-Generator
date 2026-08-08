import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PROFILE_QUESTIONS } from '../utils/companyProfile.js';
import ProfileQuestionInput from './ProfileQuestionInput.jsx';

/**
 * ProfileChatModal — the standalone "Complete Profile" / "Edit" dialog
 * opened from Profile.jsx. Same one-question-at-a-time chat mechanics as
 * the profile step in Onboarding.jsx (see askProfileQuestion there), just
 * self-contained in its own small chat window instead of appended to the
 * onboarding transcript. Existing answers are pre-filled so re-confirming
 * an already-complete profile is a handful of quick taps, not a redo.
 */
export default function ProfileChatModal({ initialAnswers = {}, onComplete, onClose }) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const answersRef = useRef({ ...initialAnswers });
  const messagesEndRef = useRef(null);
  const hasInit = useRef(false);

  useEffect(() => {
    if (hasInit.current) return;
    hasInit.current = true;
    askQuestion(0);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const askQuestion = (qIdx) => {
    const question = PROFILE_QUESTIONS[qIdx];
    if (!question) {
      onComplete(answersRef.current);
      return;
    }
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { type: 'ai', text: question.label },
        { type: 'active', questionIdx: qIdx },
      ]);
    }, 400);
  };

  const handleAnswer = (qIdx, value) => {
    const question = PROFILE_QUESTIONS[qIdx];
    answersRef.current = { ...answersRef.current, [question.key]: value };
    setMessages((prev) => [
      ...prev.filter((m) => !(m.type === 'active' && m.questionIdx === qIdx)),
      { type: 'user', text: Array.isArray(value) ? value.join(', ') : value },
    ]);
    askQuestion(qIdx + 1);
  };

  const handleSkip = (qIdx) => {
    setMessages((prev) => [
      ...prev.filter((m) => !(m.type === 'active' && m.questionIdx === qIdx)),
      { type: 'user', text: 'Skipped' },
    ]);
    askQuestion(qIdx + 1);
  };

  return (
    <div className="interview-window" style={{ width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <div className="interview-header">
        <img src="/nirmaan-mark.svg" alt="" className="interview-avatar" />
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>Company Profile</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nirmaan AI</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: 4,
          }}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="interview-messages" style={{ flex: 1 }}>
        {messages.map((msg, i) => (
          <div key={i} className="fade-in">
            {msg.type === 'ai' && (
              <div className="interview-msg-ai">
                <img src="/nirmaan-mark.svg" alt="" className="interview-avatar" style={{ width: 24, height: 28, flexShrink: 0, marginTop: 2 }} />
                <div className="interview-msg-ai-bubble">{msg.text}</div>
              </div>
            )}
            {msg.type === 'user' && (
              <div className="interview-msg-user-bubble">{msg.text}</div>
            )}
            {msg.type === 'active' && (
              <ProfileQuestionInput
                question={PROFILE_QUESTIONS[msg.questionIdx]}
                initialValue={initialAnswers[PROFILE_QUESTIONS[msg.questionIdx].key]}
                onSubmit={(value) => handleAnswer(msg.questionIdx, value)}
                onSkip={() => handleSkip(msg.questionIdx)}
              />
            )}
          </div>
        ))}

        {isTyping && (
          <div className="interview-msg-ai fade-in">
            <img src="/nirmaan-mark.svg" alt="" className="interview-avatar" style={{ width: 24, height: 28, flexShrink: 0 }} />
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
