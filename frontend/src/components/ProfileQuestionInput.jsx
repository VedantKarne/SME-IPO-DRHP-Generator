import { useState } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * ProfileQuestionInput — the answer control for a single question from
 * utils/companyProfile.js's PROFILE_QUESTIONS, rendered as a chat "quick
 * reply" area. Shared between Onboarding.jsx (inline in the interview chat)
 * and ProfileChatModal.jsx (the standalone "Complete Profile" dialog) so the
 * two never drift apart.
 *
 * - text/date  → input + send button, Enter submits
 * - select     → one tap on an option submits immediately
 * - multiselect→ toggle chips (+ exclusive "None yet") + a Continue button
 */
export default function ProfileQuestionInput({ question, initialValue, onSubmit, onSkip }) {
  const { type, options, noneOption } = question;
  const [text, setText] = useState(type === 'text' || type === 'date' ? (initialValue || '') : '');
  const [selected, setSelected] = useState(() => (type === 'multiselect' && Array.isArray(initialValue) ? initialValue : []));

  if (type === 'text' || type === 'date') {
    const submit = (e) => {
      e?.preventDefault();
      if (!text.trim()) return;
      onSubmit(text.trim());
    };
    return (
      <div className="interview-input-area">
        <form onSubmit={submit} style={{ display: 'flex', gap: 10, width: '100%' }}>
          <input
            type={type === 'date' ? 'date' : 'text'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={type === 'date' ? undefined : 'Type your answer...'}
            style={{ flex: 1 }}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={!text.trim()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </form>
        <div className="chat-quick-actions">
          <button type="button" className="chat-skip-link" onClick={onSkip}>
            {question.optional ? 'Skip' : 'Skip for now'}
          </button>
        </div>
      </div>
    );
  }

  if (type === 'select') {
    return (
      <div className="interview-input-area" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <div className="chat-quick-replies">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              className={`chat-quick-reply${o === initialValue ? ' chat-quick-reply--active' : ''}`}
              onClick={() => onSubmit(o)}
            >
              {o}
            </button>
          ))}
        </div>
        <div className="chat-quick-actions">
          <button type="button" className="chat-skip-link" onClick={onSkip}>Skip for now</button>
        </div>
      </div>
    );
  }

  // multiselect
  const toggle = (o) => {
    setSelected((prev) => (prev.includes(o) ? prev.filter((v) => v !== o) : [...prev, o]));
  };
  const pickNone = () => setSelected([noneOption]);
  const confirm = () => { if (selected.length) onSubmit(selected); };

  return (
    <div className="interview-input-area" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div className="chat-quick-replies">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={`chat-quick-reply${selected.includes(o) ? ' chat-quick-reply--active' : ''}`}
            onClick={() => toggle(o)}
          >
            {o}
          </button>
        ))}
        {noneOption && (
          <button
            type="button"
            className={`chat-quick-reply${selected.length === 1 && selected[0] === noneOption ? ' chat-quick-reply--active' : ''}`}
            onClick={pickNone}
          >
            {noneOption}
          </button>
        )}
      </div>
      <div className="chat-quick-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={confirm} disabled={!selected.length}>
          Continue
        </button>
        <button type="button" className="chat-skip-link" onClick={onSkip}>Skip for now</button>
      </div>
    </div>
  );
}
