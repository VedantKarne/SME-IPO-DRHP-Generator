/**
 * AISideChat.jsx — Section-scoped AI Side Chat panel for the AI Authoring Canvas.
 *
 * Renders a scrollable message thread with user and AI bubbles, four quick-prompt
 * chips, a text input, and a typing indicator during in-flight requests.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import * as canvasApi from '../services/canvasApi.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_AI_MESSAGE = {
  id: 'init-0',
  role: 'ai',
  text: 'Select a section and ask me to refine it...',
};

const QUICK_PROMPTS = [
  'Make this more professional',
  'Shorter and punchier',
  'Add investor-friendly language',
  'Explain the regulations for this section',
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single chat message bubble (user or AI). */
function ChatBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div
      className={`chat-msg ${isUser ? 'chat-msg-user' : 'chat-msg-ai'}`}
      role="listitem"
    >
      <span className="chat-sender">{isUser ? 'You' : 'AI'}</span>
      <div className="chat-bubble-content">
        {message.text}
      </div>
    </div>
  );
}

/** Three-dot animated typing indicator shown while the AI is responding. */
function TypingIndicator() {
  return (
    <div className="chat-msg chat-msg-ai" role="status" aria-label="AI is typing">
      <span className="chat-sender">AI</span>
      <div className="typing-indicator">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AISideChat
// ---------------------------------------------------------------------------

/**
 * @param {object}  props
 * @param {string}  props.companyId    — Active company identifier
 * @param {string}  props.sectionName  — Currently active DRHP section name
 */
export default function AISideChat({ companyId, sectionName }) {
  const [messages, setMessages] = useState([INITIAL_AI_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const [mode, setMode] = useState('chat'); // 'chat' or 'edit'

  // Auto-scroll to the bottom whenever the message list changes or loading state changes
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ---------------------------------------------------------------------------
  // Submit a message
  // ---------------------------------------------------------------------------

  const submitMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      // Append user bubble
      const userMsg = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      try {
        if (mode === 'chat') {
          const response = await canvasApi.copilotAsk(companyId, sectionName, trimmed);
          const aiMsg = {
            id: `ai-${Date.now()}`,
            role: 'ai',
            text: response.answer,
          };
          setMessages((prev) => [...prev, aiMsg]);
        } else {
          // Edit Mode
          const response = await canvasApi.chatEditSection(companyId, sectionName, trimmed);
          const aiMsg = {
            id: `ai-${Date.now()}`,
            role: 'ai',
            text: 'I have updated the document based on your instructions.',
          };
          setMessages((prev) => [...prev, aiMsg]);
          
          // Let the parent/global state handle the editor update
          // DocumentCanvas is already subscribed to useCanvasStore changes, but to force TipTap update:
          // We can dispatch a custom event if we want, or rely on activeEditor (which CopilotPanel has)
          const event = new CustomEvent('ai-section-edited', {
            detail: { sectionName, newText: response.new_draft_text }
          });
          window.dispatchEvent(event);
        }
      } finally {
        setLoading(false);
      }
    },
    [companyId, sectionName, loading, mode]
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitMessage(input);
    }
  };

  const handleChipClick = (chipText) => {
    // Set input visually then submit immediately
    setInput(chipText);
    submitMessage(chipText);
  };

  const handleSubmitClick = () => {
    submitMessage(input);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <section
      className="ai-side-chat"
      aria-label="AI Section Chat"
      style={styles.container}
    >
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerIcon} aria-hidden="true">✦</div>
        <div>
          <div style={styles.headerTitle}>AI Copilot</div>
          {sectionName && (
            <div style={styles.headerSub} title={sectionName}>
              {sectionName.length > 32 ? `${sectionName.slice(0, 32)}…` : sectionName}
            </div>
          )}
        </div>
      </header>

      {/* Message thread */}
      <div
        className="copilot-messages"
        style={styles.messageList}
        role="list"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {/* Typing indicator */}
        {loading && <TypingIndicator />}

        {/* Invisible anchor for auto-scroll */}
        <div ref={chatEndRef} aria-hidden="true" />
      </div>

      {/* Quick-prompt chips */}
      <div style={styles.chipsRow} role="list" aria-label="Quick prompts">
        {QUICK_PROMPTS.map((chip) => (
          <button
            key={chip}
            type="button"
            role="listitem"
            style={styles.chip}
            onClick={() => handleChipClick(chip)}
            disabled={loading}
            aria-label={`Quick prompt: ${chip}`}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'var(--accent-dim)';
                e.currentTarget.style.borderColor = 'rgba(79,126,255,0.3)';
                e.currentTarget.style.color = 'var(--accent)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--glass-bg)';
              e.currentTarget.style.borderColor = 'var(--glass-border)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: '10px', padding: '6px 14px', background: 'var(--bg-surface)', borderTop: '1px solid var(--glass-border)' }}>
        <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: mode === 'chat' ? 'var(--accent)' : 'var(--text-secondary)' }}>
          <input type="radio" name="chatMode" value="chat" checked={mode === 'chat'} onChange={() => setMode('chat')} style={{ cursor: 'pointer' }} />
          Q&A
        </label>
        <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: mode === 'edit' ? 'var(--accent)' : 'var(--text-secondary)' }}>
          <input type="radio" name="chatMode" value="edit" checked={mode === 'edit'} onChange={() => setMode('edit')} style={{ cursor: 'pointer' }} />
          Edit Document
        </label>
      </div>

      {/* Input area */}
      <div
        className="copilot-input-area"
        style={styles.inputArea}
        role="form"
        aria-label="Chat input"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Ask about this section…"
          disabled={loading}
          aria-label="Chat message input"
          style={styles.input}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={handleSubmitClick}
          disabled={loading || !input.trim()}
          aria-label="Send message"
          style={styles.sendBtn}
        >
          {loading ? (
            <span className="spin" aria-hidden="true" style={styles.spinner}>⟳</span>
          ) : (
            <span aria-hidden="true">→</span>
          )}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Inline styles (uses project CSS variables where possible)
// ---------------------------------------------------------------------------

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg-surface)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px 12px',
    borderBottom: '1px solid var(--glass-border)',
    flexShrink: 0,
  },
  headerIcon: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, var(--accent), #7c3aed)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    color: 'white',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    lineHeight: 1.2,
  },
  headerSub: {
    fontSize: '0.68rem',
    color: 'var(--text-muted)',
    marginTop: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '200px',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '8px 14px 6px',
    borderTop: '1px solid var(--glass-border)',
    flexShrink: 0,
  },
  chip: {
    padding: '4px 10px',
    borderRadius: '999px',
    border: '1px solid var(--glass-border)',
    background: 'var(--glass-bg)',
    color: 'var(--text-secondary)',
    fontSize: '0.72rem',
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  },
  inputArea: {
    display: 'flex',
    gap: '8px',
    padding: '12px 14px',
    borderTop: '1px solid var(--glass-border)',
    flexShrink: 0,
  },
  input: {
    flex: 1,
    fontSize: '0.85rem',
    padding: '9px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--glass-border)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-primary)',
    fontFamily: "'Outfit', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  },
  sendBtn: {
    flexShrink: 0,
    minWidth: '36px',
    padding: '9px 12px',
    fontSize: '1rem',
    lineHeight: 1,
  },
  spinner: {
    display: 'inline-block',
    fontSize: '1rem',
  },
};
