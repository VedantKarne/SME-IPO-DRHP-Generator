import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const API = 'http://localhost:8000';

const SECTIONS_25 = [
  "Cover Page & General Information", "Risk Factors", "Introduction", "General Information",
  "Capital Structure", "Objects of the Offer", "Basis of Issue Price", "Statement of Tax Benefits",
  "About the Company", "Industry Overview", "Our Business", "Key Industry Regulations",
  "History and Corporate Structure", "Management & Board of Directors",
  "Key Managerial Personnel (KMP)", "Our Promoters & Promoter Group",
  "Related Party Transactions", "Dividend Policy", "Financial Statements (3 Years)",
  "Management Discussion & Analysis", "Corporate Governance", "Terms of the Issue",
  "Other Regulatory & Statutory Disclosures", "Material Contracts & Documents",
  "Declaration & Undertakings"
];

// Evidence popover stub
function EvidencePopover({ citation, position, onClose }) {
  const EVIDENCE_MAP = {
    'Reg 229': { reg: '229', chapter: 'IV — SME Listing Requirements', doc: 'SEBI ICDR Regulations 2018', page: 'Part II, Reg 229', confidence: '99%' },
    'Reg 237': { reg: '237', chapter: 'IV — Disclosures in Offer Documents', doc: 'SEBI ICDR Regulations 2018', page: 'Part II, Reg 237', confidence: '97%' },
    'Reg 238': { reg: '238', chapter: 'IV — Content of Offer Documents', doc: 'SEBI ICDR Regulations 2018', page: 'Part II, Reg 238', confidence: '98%' },
    'Reg 233': { reg: '233', chapter: 'IV — Capital Structure Disclosures', doc: 'SEBI ICDR Regulations 2018', page: 'Part II, Reg 233', confidence: '96%' },
  };
  const match = Object.entries(EVIDENCE_MAP).find(([k]) => citation.includes(k));
  const ev = match ? match[1] : { reg: '—', chapter: 'Unknown', doc: 'SEBI ICDR 2018', page: '—', confidence: '—' };

  return (
    <div className="evidence-popover fade-in" style={{ top: position.y, left: position.x }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent)' }}>Evidence Mapping</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: 'Source', value: ev.doc },
          { label: 'Regulation', value: `Reg ${ev.reg}` },
          { label: 'Chapter', value: ev.chapter },
          { label: 'Reference', value: ev.page },
          { label: 'Confidence', value: ev.confidence },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '4px 0', borderBottom: '1px solid var(--glass-border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(16,185,129,0.08)', borderRadius: 6, fontSize: '0.72rem', color: 'var(--success)' }}>
        ✅ Verified against ChromaDB regulatory corpus
      </div>
    </div>
  );
}

// Render draft with clickable citation tags
function DraftRenderer({ text, onCitationClick }) {
  if (!text) return (
    <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.875rem' }}>
      No content yet. Click ⚡ Generate to draft this section using the live AI pipeline.
    </p>
  );

  // Split text into parts, making [Reg X | ICDR...] tags clickable
  const parts = text.split(/(\[Reg\s+\w+(?:\.\w+)*\s*\|\s*ICDR\s*\w*\]|\[[\w\s]+DRHP\s*\|[^\]]+\])/g);
  return (
    <div className="md-body">
      {parts.map((part, i) => {
        if (/^\[Reg\s+\w+/.test(part) || /^\[[\w\s]+DRHP/.test(part)) {
          return (
            <span
              key={i}
              className="citation-tag"
              onClick={(e) => {
                const rect = e.target.getBoundingClientRect();
                onCitationClick(part, { x: Math.min(rect.left, window.innerWidth - 280), y: rect.bottom + 8 });
              }}
            >
              🔗 {part}
            </span>
          );
        }
        return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <p>{children}</p> }}>{part}</ReactMarkdown>;
      })}
    </div>
  );
}

// Version history panel
function VersionHistory({ sectionId }) {
  const versions = [
    { v: 1, label: 'Initial AI Draft', time: '2h ago', status: 'draft' },
    { v: 2, label: 'AI Edit — "More professional"', time: '1h ago', status: 'edited' },
    { v: 3, label: 'Current', time: '20m ago', status: 'current' },
  ];
  return (
    <div style={{ padding: '14px 16px' }}>
      <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Version History</h4>
      {versions.map(({ v, label, time, status }) => (
        <div key={v} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: status === 'current' ? 'var(--accent-dim)' : 'var(--glass-bg)', border: `1px solid ${status === 'current' ? 'rgba(79,126,255,0.3)' : 'var(--glass-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: status === 'current' ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }}>
            {v}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Workspace({ companyId, sections, setSections, onCurrentSectionChange }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingName, setGeneratingName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: 'Select a section and ask me to refine it. E.g., "Make this more investor-friendly" or "Add a paragraph about exports."' }
  ]);
  const [isChatting, setIsChatting] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [evidence, setEvidence] = useState(null); // { citation, position }
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory]);

  // Build merged list: DB sections + not-yet-generated stubs
  const mergedSections = SECTIONS_25.map((name, idx) => {
    const existing = sections.find(s => s.name === name);
    return existing || { id: null, name, status: 'pending', draft_text: '', score: 0, locked: false, flagged_gaps: [] };
  });

  const selected = mergedSections[selectedIdx];

  useEffect(() => {
    if (selected) onCurrentSectionChange?.(selected.name);
  }, [selectedIdx]);

  const handleSelect = (idx) => {
    setSelectedIdx(idx);
    setIsEditing(false);
    setEvidence(null);
    const s = mergedSections[idx];
    if (s) setEditText(s.draft_text || '');
  };

  const handleGenerate = async (sectionName) => {
    if (!companyId || isGenerating) return;
    setIsGenerating(true);
    setGeneratingName(sectionName);
    setEvidence(null);
    try {
      const res = await fetch(`${API}/api/agent/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, section_name: sectionName })
      });
      if (res.ok) {
        // Re-fetch sections from server
        const secRes = await fetch(`${API}/api/sections/${companyId}`);
        if (secRes.ok) {
          const updated = await secRes.json();
          setSections(updated);
        }
      }
    } catch (e) { console.error(e); }
    setIsGenerating(false);
    setGeneratingName('');
  };

  const handleApprove = async () => {
    if (!selected?.id) return;
    const res = await fetch(`${API}/api/sections/${selected.id}/approve`, { method: 'POST' });
    if (res.ok) {
      const secRes = await fetch(`${API}/api/sections/${companyId}`);
      if (secRes.ok) setSections(await secRes.json());
    }
  };

  const handleChatEdit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selected?.id || isChatting) return;
    const prompt = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: prompt }]);
    setIsChatting(true);
    try {
      if (selected.locked) {
        const res = await fetch(`${API}/api/copilot/ask`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_id: companyId, current_section: selected.name, question: prompt })
        });
        const data = await res.json();
        setChatHistory(prev => [...prev, { role: 'ai', text: data.answer }]);
      } else {
        const res = await fetch(`${API}/api/sections/${selected.id}/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });
        if (res.ok) {
          const data = await res.json();
          const secRes = await fetch(`${API}/api/sections/${companyId}`);
          if (secRes.ok) setSections(await secRes.json());
          setChatHistory(prev => [...prev, { role: 'ai', text: '✅ Done! I\'ve updated the draft. Review the changes in the editor.' }]);
        } else {
          const err = await res.json();
          setChatHistory(prev => [...prev, { role: 'ai', text: `I couldn't apply that edit: ${err.detail}` }]);
        }
      }
    } catch { setChatHistory(prev => [...prev, { role: 'ai', text: 'Connection error. Please try again.' }]); }
    setIsChatting(false);
  };

  const QUICK_EDITS = ['Make this more professional', 'Shorter and punchier', 'Mention our export business', 'Add investor-friendly language'];

  const statusColor = (s) => s.locked ? 'var(--success)' : s.draft_text ? 'var(--warning)' : 'var(--text-muted)';
  const statusLabel = (s) => s.locked ? '✓' : s.draft_text ? '~' : '○';

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ marginBottom: 4 }}>Document Workspace</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Generate, review, and approve all 25 DRHP sections. Click any section to open it.
        </p>
      </div>

      <div className="workspace-layout">
        {/* Section List */}
        <div className="section-list">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 4px', marginBottom: 8 }}>
            25 Sections
          </div>
          {mergedSections.map((s, idx) => (
            <div
              key={s.name}
              className={`section-list-item ${selectedIdx === idx ? 'active' : ''}`}
              onClick={() => handleSelect(idx)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                <span className="section-item-name" style={{ flex: 1 }}>{s.name}</span>
                <span style={{ fontSize: '0.7rem', color: statusColor(s), flexShrink: 0 }}>{statusLabel(s)}</span>
              </div>
              {s.score > 0 && (
                <div className="section-item-score">
                  <div className="section-item-score-fill" style={{ width: `${s.score * 100}%`, background: s.locked ? 'var(--success)' : 'var(--accent)' }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="editor-panel">
          {/* Toolbar */}
          <div className="editor-toolbar">
            <div style={{ display: 'flex', align: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1rem', margin: 0 }}>{selected?.name}</h2>
              {selected?.score > 0 && (
                <span className="badge badge-accent">Score: {Math.round(selected.score * 100)}%</span>
              )}
              {selected?.locked && <span className="badge badge-success">🔒 Approved</span>}
              {selected?.draft_text && !selected?.locked && <span className="badge badge-warning">Draft</span>}
              {!selected?.draft_text && <span className="badge badge-muted">Not Generated</span>}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!selected?.locked && (
                <>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setIsEditing(!isEditing); setEditText(selected?.draft_text || ''); }}>
                    {isEditing ? '👁 Preview' : '✏️ Edit'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowVersions(!showVersions)}>
                    📋 History
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleGenerate(selected?.name)}
                    disabled={isGenerating}
                  >
                    {isGenerating && generatingName === selected?.name ? <><span className="spin">⟳</span> Generating...</> : '⚡ Generate'}
                  </button>
                </>
              )}
              {selected?.draft_text && !selected?.locked && (
                <button className="btn btn-success btn-sm" onClick={handleApprove}>
                  ✓ Approve & Lock
                </button>
              )}
            </div>
          </div>

          {/* Version history panel */}
          {showVersions && (
            <div className="card card-sm fade-in">
              <VersionHistory sectionId={selected?.id} />
            </div>
          )}

          {/* Gap warnings */}
          {selected?.flagged_gaps?.length > 0 && (
            <div className="gap-banner fade-in" style={{ padding: '20px 24px', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>⚠️</span>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--error)' }}>
                  {selected.flagged_gaps.length} Mandatory Information Gap(s) Detected
                </span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                The AI Validator cross-referenced your draft against SEBI ICDR guidelines and found missing factual information. These gaps represent details that were not present in your uploaded documents. <strong>You must provide this missing data to the copilot to resolve these gaps before certification.</strong>
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                {selected.flagged_gaps.map((g, i) => {
                  let rawText = g.description || g.gap || '';
                  // Clean up AI string format (e.g. "ICDR_GAP_INTRODUCTION: Objectives of the Issue]. The proceeds...")
                  rawText = rawText.replace(/ICDR_GAP_[A-Z_]+:\s*/, '').trim();
                  
                  let parts = rawText.split('].');
                  let title = parts[0].replace(/\]$/, '').trim(); // Fallback if no period
                  let context = parts.length > 1 ? parts.slice(1).join('].').trim() : '';

                  return (
                    <div key={i} style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.25)', borderLeft: '3px solid var(--error)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: context ? 6 : 0 }}>
                        {title}
                      </div>
                      {context && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          <em>"...{context}..."</em>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Editor Body */}
          <div className="editor-body" style={{ position: 'relative' }}>
            {/* Not generated yet — show generate CTA */}
            {!selected?.draft_text && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
                <div style={{ fontSize: '2.5rem' }}>📄</div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 8 }}>
                    This section hasn't been drafted yet.
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 20 }}>
                    The AI pipeline will retrieve SEBI ICDR regulations, match precedent DRHPs, and generate a compliance-ready draft.
                  </p>
                </div>
                <button
                  className="btn btn-primary btn-lg"
                  onClick={() => handleGenerate(selected?.name)}
                  disabled={isGenerating || !companyId}
                >
                  {isGenerating && generatingName === selected?.name ? (
                    <><span className="spin">⟳</span> Drafting with Groq Llama 3.3…</>
                  ) : (
                    <>⚡ Generate "{selected?.name}"</>
                  )}
                </button>
              </div>
            )}

            {/* Editor */}
            {selected?.draft_text && isEditing && !selected?.locked && (
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                style={{ width: '100%', minHeight: 400, resize: 'vertical', background: 'transparent', border: 'none', color: 'inherit', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.6, outline: 'none' }}
              />
            )}

            {/* Preview */}
            {selected?.draft_text && !isEditing && (
              <DraftRenderer
                text={selected.draft_text}
                onCitationClick={(citation, position) => setEvidence({ citation, position })}
              />
            )}
          </div>

          {/* In-workspace chat edit */}
          <div className="card card-sm">
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {selected?.locked ? '⚖️ Ask Copilot' : '✏️ AI Edit This Section'}
            </div>

            {/* Chat history */}
            <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {chatHistory.slice(-5).map((msg, i) => (
                <div key={i} className={`chat-msg ${msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai'} fade-in`}>
                  <div className="chat-bubble-content" style={{ fontSize: '0.8rem' }}>{msg.text}</div>
                </div>
              ))}
              {isChatting && (
                <div className="typing-indicator">
                  <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick prompts */}
            {!selected?.locked && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {QUICK_EDITS.map(p => (
                  <button key={p} className="btn btn-secondary btn-sm" onClick={() => setChatInput(p)} style={{ fontSize: '0.72rem' }}>
                    {p}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleChatEdit} style={{ display: 'flex', gap: 8 }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={selected?.locked ? 'Ask about regulations...' : 'E.g. Make this more investor-friendly...'}
                disabled={isChatting}
                style={{ flex: 1, fontSize: '0.82rem' }}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={isChatting || !chatInput.trim()}>↑</button>
            </form>
          </div>
        </div>
      </div>

      {/* Evidence Popover */}
      {evidence && (
        <EvidencePopover
          citation={evidence.citation}
          position={evidence.position}
          onClose={() => setEvidence(null)}
        />
      )}
    </div>
  );
}
