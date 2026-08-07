import { useState, useEffect } from 'react';
import { Loader2, Search, Package, AlertTriangle, SearchX, Brain } from 'lucide-react';
import { authedFetch } from '../utils/auth';

const API_BASE = 'http://127.0.0.1:8000';

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

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedCollection) return;
    setSearching(true);
    setError(null);
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

  const selectedInfo = collections.find(c => c.name === selectedCollection);

  return (
    <div className="fade-in">
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Knowledge Base</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
          Inspect and search ChromaDB vector collections used by the RAG pipeline.
        </p>
      </div>

      {/* Collection cards */}
      {loading ? (
        <div className="card" style={{ marginBottom: 24, color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={14} strokeWidth={2} className="spin" />Loading collections…
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {collections.length === 0 && (
            <div className="card card-sm" style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No collections found. Index documents first to populate ChromaDB.
            </div>
          )}
          {collections.map(col => (
            <div
              key={col.name}
              id={`kb-col-${col.name}`}
              onClick={() => { setSelectedCollection(col.name); setChunks([]); }}
              className="card card-sm"
              style={{
                cursor: 'pointer',
                minWidth: 160,
                transition: 'border-color 0.2s, background 0.2s',
                borderColor: selectedCollection === col.name
                  ? 'var(--accent)'
                  : 'var(--glass-border)',
                background: selectedCollection === col.name
                  ? 'var(--accent-dim)'
                  : 'var(--glass-bg)',
              }}
            >
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Collection
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 4 }}>
                {col.name}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                {col.count.toLocaleString()} chunks
              </div>
            </div>
          ))}
        </div>
      )}

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
          {collections.map(c => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.count.toLocaleString()})
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
          <Package size={13} strokeWidth={1.75} />
          <strong style={{ color: 'var(--text-secondary)' }}>{selectedInfo.name}</strong>
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
            <strong style={{ color: 'var(--accent)' }}>{selectedCollection}</strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chunks.map((chunk, i) => (
              <div
                key={i}
                id={`kb-result-${i}`}
                className="card card-sm fade-in"
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
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
            ))}
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
          <strong>{selectedCollection}</strong>.</div>
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
