import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './index.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('workspace'); // 'wizard', 'knowledge', 'eligibility', 'monitor', 'workspace'
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [draftText, setDraftText] = useState("");
  const [isEditingSource, setIsEditingSource] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'ai', text: 'How would you like to revise this section?' }
  ]);
  const [companyId, setCompanyId] = useState("");
  
  // Wizard State
  const [wizardCin, setWizardCin] = useState('');
  const [wizardName, setWizardName] = useState('');
  const [wizardStatus, setWizardStatus] = useState('');

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
        const res = await fetch('http://localhost:8000/api/demo/company');
        if (res.ok) {
            const data = await res.json();
            if (data.company_id) {
                setCompanyId(data.company_id);
                fetchSections(data.company_id);
            }
        }
    } catch (e) {
        console.error("Could not fetch demo company", e);
    }
  };

  const fetchSections = async (compId) => {
      try {
          const res = await fetch(`http://localhost:8000/api/sections/${compId}`);
          if (res.ok) {
              const data = await res.json();
              setSections(data);
              if (data.length > 0) {
                  setSelectedSection(data[0]);
                  setDraftText(data[0].draft_text);
              }
          }
      } catch (e) {
          console.error("Could not fetch sections", e);
      }
  };

  const handleWizardSubmit = async (e) => {
      e.preventDefault();
      setWizardStatus("Submitting...");
      try {
          // This is hitting the actual Phase 3 Wizard API!
          const res = await fetch('http://localhost:8000/api/wizard/company', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  cin: wizardCin,
                  name: wizardName,
                  business_activity_nic: "72900"
              })
          });
          if (res.ok) {
              const data = await res.json();
              setWizardStatus(`Success! Company ID: ${data.id}`);
              setCompanyId(data.id);
          } else {
              const err = await res.json();
              setWizardStatus(`Error: ${err.detail}`);
          }
      } catch (e) {
          setWizardStatus("Network error occurred.");
      }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedSection) return;
    
    const newHistory = [...chatHistory, { role: 'user', text: chatInput }];
    setChatHistory(newHistory);
    const input = chatInput;
    setChatInput('');
    
    if (selectedSection.locked) {
        try {
            const res = await fetch('http://localhost:8000/api/copilot/ask', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_id: companyId,
                    current_section: selectedSection.name,
                    question: input
                })
            });
            const data = await res.json();
            setChatHistory(prev => [...prev, { role: 'ai', text: data.answer }]);
        } catch (e) {
            console.error(e);
        }
    } else {
        try {
            const res = await fetch(`http://localhost:8000/api/sections/${selectedSection.id}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: input })
            });
            if (res.ok) {
                const data = await res.json();
                setDraftText(data.new_draft_text);
                setChatHistory(prev => [...prev, { role: 'ai', text: 'I have updated the document as requested.' }]);
                setSections(sections.map(s => 
                    s.id === selectedSection.id ? { ...s, draft_text: data.new_draft_text } : s
                ));
            } else {
                const err = await res.json();
                setChatHistory(prev => [...prev, { role: 'ai', text: `Error: ${err.detail}` }]);
            }
        } catch (e) {
            console.error(e);
        }
    }
  };

  const handleApprove = async () => {
      try {
          const res = await fetch(`http://localhost:8000/api/sections/${selectedSection.id}/approve`, {
              method: 'POST'
          });
          if (res.ok) {
              const updatedSection = { ...selectedSection, locked: true };
              setSelectedSection(updatedSection);
              setSections(sections.map(s => s.id === selectedSection.id ? updatedSection : s));
              setIsEditingSource(false);
          }
      } catch(e) {
          console.error(e);
      }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderBottom: 'none', borderLeft: 'none' }}>
        <h2>SME Copilot</h2>
        
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px' }}>
          <button 
            className={`btn ${activeTab === 'wizard' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setActiveTab('wizard')}
          >
            Promoter Setup
          </button>
          <button 
            className={`btn ${activeTab === 'knowledge' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setActiveTab('knowledge')}
          >
            Knowledge Base
          </button>
          <button 
            className={`btn ${activeTab === 'eligibility' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setActiveTab('eligibility')}
          >
            Eligibility Engine
          </button>
          <button 
            className={`btn ${activeTab === 'monitor' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setActiveTab('monitor')}
          >
            LangGraph Monitor
          </button>
          <button 
            className={`btn ${activeTab === 'workspace' ? 'btn-primary' : 'btn-glass'}`}
            onClick={() => setActiveTab('workspace')}
          >
            Document Workspace
          </button>
        </nav>
        
        <div style={{ marginTop: 'auto' }}>
          <div className="status-badge status-success" style={{ display: 'inline-block', marginBottom: '8px' }}>
            System Online
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Connected to Groq Llama 3.3</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        
        {/* WIZARD TAB */}
        {activeTab === 'wizard' && (
          <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h1>Promoter Onboarding</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Phase 3 Integration: Capture business particulars without relying on intermediaries.
            </p>
            <form onSubmit={handleWizardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Company CIN</label>
                    <input 
                        type="text" 
                        required 
                        value={wizardCin} 
                        onChange={(e) => setWizardCin(e.target.value)}
                        placeholder="e.g. U72900MH2018PTC123456"
                    />
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Company Name</label>
                    <input 
                        type="text" 
                        required 
                        value={wizardName} 
                        onChange={(e) => setWizardName(e.target.value)}
                        placeholder="e.g. Acme Tech Solutions Ltd"
                    />
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '12px' }}>Initialize Company Profile</button>
            </form>
            {wizardStatus && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px' }}>
                    {wizardStatus}
                </div>
            )}
          </div>
        )}

        {/* KNOWLEDGE BASE TAB */}
        {activeTab === 'knowledge' && (
          <div className="glass-panel">
            <h1>Regulatory Knowledge Base</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Phase 1 & 2 Integration: Parsed & Chunked Documents in Qdrant Vector DB.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h3>SEBI ICDR 2018</h3>
                        <span className="status-badge status-success">Embedded</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Parsed using LlamaParse. Chunked at 512 tokens with 10% overlap.</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '12px', opacity: 0.6 }}>Vector Count: 1,245</p>
                </div>
                <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h3>LODR Regulations</h3>
                        <span className="status-badge status-success">Embedded</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Parsed using LlamaParse. Extracted complex compliance tables.</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '12px', opacity: 0.6 }}>Vector Count: 890</p>
                </div>
                <div className="glass-panel" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <h3>Companies Act 2013</h3>
                        <span className="status-badge status-pending">Indexing...</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Processing legal schedules and penal provisions.</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '12px', opacity: 0.6 }}>Vector Count: 3,100</p>
                </div>
            </div>
          </div>
        )}

        {/* ELIGIBILITY TAB */}
        {activeTab === 'eligibility' && (
          <div className="glass-panel">
            <h1>Eligibility Engine (Phase 7)</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Real-time evaluation of SME IPO requirements based on Postgres metadata.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="glass-panel" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'var(--success)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h3>EBITDA Requirement</h3>
                  <span className="status-badge status-success">Passed</span>
                </div>
                <p>Company has EBITDA ≥ ₹1 Crore in 2 of the last 3 financial years.</p>
                <p style={{ fontSize: '0.75rem', marginTop: '8px', color: 'var(--text-secondary)' }}>Citation: ICDR_2018_Reg229_2_a</p>
              </div>
              
              <div className="glass-panel" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: '#fbbf24' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <h3>KMP Litigation Check</h3>
                  <span className="status-badge status-pending">Warning</span>
                </div>
                <p>Managing Director has pending civil litigation. Will trigger mandatory disclosure in Risk Factors.</p>
                <p style={{ fontSize: '0.75rem', marginTop: '8px', color: 'var(--text-secondary)' }}>Citation: ICDR_2018_Reg229_3</p>
              </div>
            </div>
          </div>
        )}

        {/* MONITOR TAB */}
        {activeTab === 'monitor' && (
          <div className="glass-panel">
            <h1>LangGraph Execution Monitor</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Live visualization of the AI Agent pipeline.</p>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '20px' }}>
              <div className="glass-panel" style={{ textAlign: 'center' }}>
                <h3 style={{ margin: 0 }}>RAG Retriever</h3>
                <small style={{ color: 'var(--success)' }}>Completed 1.2s</small>
              </div>
              <div style={{ color: 'var(--accent-color)' }}>➔</div>
              <div className="glass-panel node-active" style={{ textAlign: 'center' }}>
                <h3 style={{ margin: 0 }}>Drafting LLM</h3>
                <small style={{ color: '#fbbf24' }}>Generating...</small>
              </div>
              <div style={{ color: 'var(--accent-color)' }}>➔</div>
              <div className="glass-panel" style={{ textAlign: 'center' }}>
                <h3 style={{ margin: 0 }}>Gap Validator</h3>
                <small style={{ color: 'var(--text-secondary)' }}>Waiting</small>
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE TAB */}
        {activeTab === 'workspace' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h1 style={{ marginBottom: '8px' }}>Interactive Workspace</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Phase 8 & 9 Integration: Review AI-generated markdown, resolve gaps, and lock sections.</p>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              {sections.map(sec => (
                <button 
                  key={sec.id}
                  className={`btn ${selectedSection?.id === sec.id ? 'btn-primary' : 'btn-glass'}`}
                  onClick={() => {
                      setSelectedSection(sec);
                      setDraftText(sec.draft_text);
                      setIsEditingSource(false);
                  }}
                >
                  {sec.name} {sec.locked && '🔒'}
                </button>
              ))}
              {sections.length === 0 && <p>No sections found. Start demo script!</p>}
            </div>

            {selectedSection && (
            <div className="workspace-grid">
              {/* Document Editor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* GAP VALIDATOR ALERT */}
                  {(selectedSection.flagged_gaps && selectedSection.flagged_gaps.length > 0) ? (
                      <div className="glass-panel" style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'var(--error)' }}>
                          <h4 style={{ color: 'var(--error)', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              ⚠️ Phase 8 Gap Validator Flags
                          </h4>
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.875rem' }}>
                              {selectedSection.flagged_gaps.map((gap, i) => (
                                  <li key={i}><strong>{gap.clause}:</strong> {gap.gap}</li>
                              ))}
                          </ul>
                      </div>
                  ) : null}

                  <div className="glass-panel draft-editor" style={{ flexGrow: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{ margin: 0 }}>{selectedSection.name}</h2>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span className="status-badge" style={{ background: 'rgba(255,255,255,0.1)' }}>
                          Score: {Math.round((selectedSection.score || 0.85) * 100)}%
                        </span>
                        
                        {!selectedSection.locked && (
                            <button 
                                className="btn btn-glass" 
                                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                onClick={() => setIsEditingSource(!isEditingSource)}
                            >
                                {isEditingSource ? 'View Rendered' : 'Edit Markdown'}
                            </button>
                        )}
                        
                        {selectedSection.locked ? (
                          <span className="status-badge status-success">🔒 Approved</span>
                        ) : (
                          <button className="btn btn-primary" onClick={handleApprove}>
                            Approve Section
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '16px', minHeight: '300px', overflowY: 'auto', border: '1px solid var(--glass-border)' }}>
                        {isEditingSource ? (
                            <textarea 
                              value={draftText}
                              onChange={(e) => setDraftText(e.target.value)}
                              style={{ width: '100%', height: '100%', minHeight: '280px', resize: 'vertical', background: 'transparent', border: 'none', color: 'inherit' }}
                            />
                        ) : (
                            <div className="markdown-body">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{draftText}</ReactMarkdown>
                            </div>
                        )}
                    </div>
                  </div>
              </div>

              {/* Copilot Chat */}
              <div className="glass-panel copilot-panel">
                <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '12px' }}>
                  {selectedSection.locked ? "Regulatory Copilot" : "AI Copilot Edit"}
                </h3>
                
                <div className="chat-history">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'chat-user' : 'chat-ai'} markdown-body`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    </div>
                  ))}
                </div>
                
                <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={selectedSection.locked ? "Ask a regulatory question..." : "E.g., Format this as a table"}
                  />
                  <button type="submit" className="btn btn-primary">
                    Send
                  </button>
                </form>
              </div>
            </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
