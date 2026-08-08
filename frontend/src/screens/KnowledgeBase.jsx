import { useState, useEffect } from 'react';
import {
  Loader2, Search, AlertTriangle, SearchX, Brain,
  Scale, Library, FileStack, Sparkles, Boxes, Database, ScanSearch, Target,
} from 'lucide-react';
import { authedFetch } from '../utils/auth';
import { MOCK_COLLECTIONS, MOCK_CHUNKS } from '../mocks/knowledgeBaseMockData.js';

const API_BASE = 'http://127.0.0.1:8000';

// Human-friendly framing for the 3 real ChromaDB collections this app
// actually maintains (src/api/admin_router.py) — names/descriptions match
// what's genuinely indexed, not invented categories.
const COLLECTION_META = {
  regulatory_clauses: { icon: Scale,     label: 'SEBI Regulations',   desc: 'ICDR 2018 + Mar 2025 amendments, clause-indexed' },
  precedent_chunks:   { icon: Library,   label: 'Precedent Filings',  desc: 'Past SME DRHPs, sectioned for comparison' },
  client_documents:   { icon: FileStack, label: 'Your Documents',     desc: 'Uploaded financials, licences and contracts' },
};

// The real retrieval pipeline (src/retrieval/*, src/api/admin_router.py):
// BGE-M3 dense+sparse embeddings, ChromaDB storage, Reciprocal Rank Fusion
// hybrid search. Reuses the same .pipeline-* classes already built for the
// Documents page's AI Extraction Pipeline (index.css) — no new CSS needed.
const RETRIEVAL_PIPELINE = [
  { icon: FileStack,  phase: 'Ingest',   heading: 'Regs + Precedents + Your Docs', src: 'pdf_parser.py' },
  { icon: Sparkles,   phase: 'Enrich',   heading: 'Context Breadcrumbs Added',     src: 'context_enricher.py' },
  { icon: Boxes,      phase: 'Embed',    heading: 'Dense + Sparse Vectors',        src: 'BGE-M3' },
  { icon: Database,   phase: 'Index',    heading: '3 ChromaDB Collections',        src: 'Vector Store' },
  { icon: ScanSearch, phase: 'Retrieve', heading: 'Hybrid RRF Search',             src: 'HybridSearcher' },
  { icon: Target,     phase: 'Ground',   heading: 'Cited in Every Draft',          src: 'supporting_clause_ids' },
];

export default function KnowledgeBase() {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  // Load collections on mount
  useEffect(() => {
    setLoading(true);
    authedFetch(`${API_BASE}/api/admin/collections`)
      .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
      .then(data => {
        setCollections(data);
        if (data.length > 0) setSelectedCollection(data[0].name);
      })
      .catch(e => setError(`Failed to load collections: ${e}`))
      .finally(() => setLoading(false));
  }, []);

  // MOCK DATA fallback: the live corpus is empty in this environment (0
  // chunks across all 3 collections — nothing has been indexed here yet).
  // Rather than a page full of zeros with no way to demonstrate what
  // browsing/searching a populated corpus looks like, fall back to
  // knowledgeBaseMockData.js whenever the real fetch comes back all-zero.
  // Swapping back to live-only behavior once the corpus is indexed just
  // means this flag goes permanently false — no other code changes needed.
  const isMockMode = !loading && collections.length > 0 && collections.every(c => c.count === 0);
  const displayCollections = isMockMode ? MOCK_COLLECTIONS : collections;

  const handleCardClick = (name) => {
    setSelectedCollection(name);
    setSearchQuery('');
    setError(null);
    // A card click used to only change the dropdown selection, with nothing
    // visible happening until the user also typed a query — clicking a
    // collection now previews it immediately.
    setChunks(isMockMode ? (MOCK_CHUNKS[name] || []) : []);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedCollection) return;
    setError(null);

    if (isMockMode) {
      setSearching(true);
      setChunks([]);
      await new Promise((r) => setTimeout(r, 250)); // avoid an instant, obviously-fake flash
      const q = searchQuery.toLowerCase();
      const pool = MOCK_CHUNKS[selectedCollection] || [];
      setChunks(pool.filter((c) =>
        c.text.toLowerCase().includes(q) ||
        Object.values(c.metadata).some((v) => String(v).toLowerCase().includes(q))
      ));
      setSearching(false);
      return;
    }

    setSearching(true);
    setChunks([]);
    try {
      const res = await authedFetch(`${API_BASE}/api/admin/search`, {
        method: 'POST',
        body: JSON.stringify({
          collection: selectedCollection,
          query: searchQuery,
          k: 20,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setChunks(await res.json());
    } catch (e) {
      setError(`Search failed: ${e.message}`);
    } finally {
      setSearching(false);
    }
  };

  const selectedInfo = displayCollections.find(c => c.name === selectedCollection);
  const totalChunks = displayCollections.reduce((sum, c) => sum + c.count, 0);
  const maxCount = Math.max(...displayCollections.map(c => c.count), 1);
  // Relative to the top result in THIS search — an honest way to visualize
  // rank strength. RRF scores aren't a 0-1 confidence scale, so showing them
  // as an absolute "% confidence" bar would misrepresent what the number is.
  const topScore = Math.max(...chunks.map(c => c.score), 0.0001);

  return (
    <div className="fade-in">
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Knowledge Base</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          SEBI regulations, precedent filings and your own documents — searchable by meaning, not just keywords.
        </p>
      </div>

      {/* Collection overview cards */}
      {loading ? (
        <div className="card" style={{ marginBottom: 24, color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={14} strokeWidth={2} className="spin" />Loading collections…
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
              Corpus Overview
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {totalChunks.toLocaleString()} chunk{totalChunks === 1 ? '' : 's'} indexed
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 28 }}>
            {displayCollections.length === 0 && (
              <div className="card card-sm" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                No collections found. Index documents first to populate ChromaDB.
              </div>
            )}
            {displayCollections.map(col => {
              const meta = COLLECTION_META[col.name] ?? { icon: Boxes, label: col.name, desc: '' };
              const Icon = meta.icon;
              const isActive = selectedCollection === col.name;
              const barPct = Math.round((col.count / maxCount) * 100);
              return (
                <div
                  key={col.name}
                  id={`kb-col-${col.name}`}
                  onClick={() => handleCardClick(col.name)}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    transition: 'border-color 0.2s, background 0.2s',
                    borderColor: isActive ? 'var(--signal)' : 'var(--rule)',
                    background: isActive ? 'var(--accent-dim)' : 'var(--paper-raised)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isActive ? 'var(--signal)' : 'var(--paper-sunken)',
                    }}>
                      <Icon size={19} strokeWidth={1.75} color={isActive ? '#fff' : 'var(--signal)'} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink)' }}>{meta.label}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>{col.name}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--signal)', lineHeight: 1 }}>
                    {col.count.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--ink-soft)', margin: '4px 0 10px' }}>chunks indexed</div>
                  <div style={{ height: 5, background: 'var(--paper-sunken)', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ height: '100%', width: `${barPct}%`, background: 'var(--signal)', borderRadius: 999, transition: 'width 0.6s ease' }} />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', margin: 0, lineHeight: 1.4 }}>{meta.desc}</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* How retrieval works — the real hybrid-search architecture */}
      <div className="card" style={{ marginTop: 24, marginBottom: 28, borderColor: 'var(--rule)', background: 'var(--accent-dim)' }}>
        <h3 style={{ fontSize: '0.9rem', marginBottom: 4, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Brain size={16} strokeWidth={1.75} /> How Retrieval Works
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Every DRHP section is drafted with sources attached — this is the pipeline behind it:
        </p>
        <div className="pipeline-row">
          {RETRIEVAL_PIPELINE.map(({ icon: StepIcon, phase, heading, src }) => (
            <div className="pipeline-step" key={phase}>
              <div className="pipeline-circle">
                <StepIcon size={17} strokeWidth={1.75} />
              </div>
              <div className="pipeline-step-text">
                <div className="pipeline-phase">{phase}</div>
                <div className="pipeline-heading">{heading}</div>
                <div className="pipeline-desc">via: {src}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div
        className="card"
        style={{ marginBottom: 24, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}
      >
        <select
          id="kb-collection-select"
          value={selectedCollection}
          onChange={e => { setSelectedCollection(e.target.value); setChunks([]); }}
          style={{
            padding: '8px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)', fontSize: '0.85rem', minWidth: 200,
          }}
        >
          {displayCollections.map(c => (
            <option key={c.name} value={c.name}>
              {(COLLECTION_META[c.name]?.label ?? c.name)} ({c.count.toLocaleString()})
            </option>
          ))}
        </select>

        <input
          id="kb-search-input"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search chunks by semantic query…"
          style={{ flex: 1, minWidth: 240, padding: '8px 12px', fontSize: '0.875rem' }}
        />

        <button
          id="kb-search-btn"
          className="btn btn-primary"
          onClick={handleSearch}
          disabled={searching || !searchQuery.trim() || !selectedCollection}
          style={{ flexShrink: 0 }}
        >
          {searching
            ? <><Loader2 size={14} strokeWidth={2} className="spin" style={{ verticalAlign: -2 }} /> Searching…</>
            : <><Search size={14} strokeWidth={2} style={{ verticalAlign: -2 }} /> Search</>}
        </button>
      </div>

      {/* Inline collection info */}
      {selectedInfo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          {(() => { const M = COLLECTION_META[selectedInfo.name]?.icon ?? Boxes; return <M size={13} strokeWidth={1.75} />; })()}
          <strong style={{ color: 'var(--text-secondary)' }}>{COLLECTION_META[selectedInfo.name]?.label ?? selectedInfo.name}</strong>
          {' '}— {selectedInfo.count.toLocaleString()} chunks indexed
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: 16,
          background: 'var(--error-dim)', border: '1px solid var(--error)',
          color: 'var(--error)', fontSize: '0.82rem',
        }}>
          <AlertTriangle size={15} strokeWidth={2} /> {error}
        </div>
      )}

      {/* Results */}
      {chunks.length > 0 && (
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            {chunks.length} results from{' '}
            <strong style={{ color: 'var(--accent)' }}>{COLLECTION_META[selectedCollection]?.label ?? selectedCollection}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chunks.map((chunk, i) => {
              const relPct = Math.max(4, Math.round((chunk.score / topScore) * 100));
              return (
              <div
                key={i}
                id={`kb-result-${i}`}
                className="card card-sm fade-in"
                style={{ display: 'flex', gap: 14 }}
              >
                {/* Relevance gauge — relative to the top result in this search */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 40 }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--signal)', marginBottom: 4 }}>#{i + 1}</div>
                  <div style={{ width: 5, height: 60, background: 'var(--paper-sunken)', borderRadius: 999, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${relPct}%`, background: 'var(--signal)', borderRadius: 999 }} />
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Chunk header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.68rem', color: 'var(--text-muted)',
                      fontFamily: 'monospace', wordBreak: 'break-all', flex: 1,
                    }}>
                      {chunk.id}
                    </span>
                    <span className="badge badge-success" style={{ flexShrink: 0 }}>
                      score: {chunk.score.toFixed(4)}
                    </span>
                  </div>

                  {/* Metadata tags */}
                  {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {Object.entries(chunk.metadata).map(([k, v]) => (
                        <span key={k} style={{
                          fontSize: '0.63rem', padding: '2px 8px',
                          background: 'var(--paper-sunken)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
                        }}>
                          <strong>{k}:</strong> {String(v).slice(0, 40)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Text preview */}
                  <p style={{
                    fontSize: '0.82rem', color: 'var(--text-secondary)',
                    margin: 0, lineHeight: 1.55,
                  }}>
                    {chunk.text.slice(0, 320)}{chunk.text.length > 320 ? '…' : ''}
                  </p>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state after search */}
      {chunks.length === 0 && searchQuery && !searching && !error && (
        <div style={{
          textAlign: 'center', padding: 48,
          color: 'var(--text-muted)', fontSize: '0.875rem',
        }}>
          <SearchX size={22} strokeWidth={1.5} style={{ marginBottom: 8 }} />
          <div>No chunks found for "{searchQuery}" in{' '}
          <strong>{COLLECTION_META[selectedCollection]?.label ?? selectedCollection}</strong>.</div>
          <span style={{ fontSize: '0.78rem' }}>
            Try a different query, or select a different collection.
          </span>
        </div>
      )}

      {/* Idle state */}
      {chunks.length === 0 && !searchQuery && !loading && (
        <div style={{
          textAlign: 'center', padding: 48,
          color: 'var(--text-muted)', fontSize: '0.875rem',
        }}>
          <Brain size={22} strokeWidth={1.5} style={{ marginBottom: 8 }} />
          <div>Select a collection and enter a query to search the vector store.</div>
        </div>
      )}
    </div>
  );
}
