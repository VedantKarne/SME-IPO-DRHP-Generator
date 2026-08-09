import { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import { buildMockRegistryData } from '../mocks/publicVerificationMockData.js';

const FIELD_LABELS = {
  companyName: 'Company Name',
  cin: 'CIN',
  pan: 'PAN',
  gst: 'GSTIN',
};

const FIELD_ORDER = ['companyName', 'cin', 'pan', 'gst'];

export default function PublicVerification({ companyName, cin, readOnly = false }) {
  const [data, setData] = useState(() => buildMockRegistryData({ companyName, cin }));
  const [reverifying, setReverifying] = useState(false);

  // companyName/cin arrive asynchronously (cin isn't in the JWT, so Documents.jsx
  // fetches it after mount) — resync once the real values land.
  useEffect(() => {
    setData(buildMockRegistryData({ companyName, cin }));
  }, [companyName, cin]);

  const verifiedCount = FIELD_ORDER.filter((key) => data[key].status === 'matched').length;
  const allVerified = verifiedCount === FIELD_ORDER.length;

  const handleReverify = async () => {
    if (reverifying) return;
    setReverifying(true);
    // MOCK: no real registry call exists to re-run — this simulates the
    // round trip and re-settles on the same result, rather than pretending
    // a live check happened.
    await new Promise((r) => setTimeout(r, 1500));
    setData(buildMockRegistryData({ companyName, cin }));
    setReverifying(false);
  };

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={17} strokeWidth={1.75} color="var(--signal)" />
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>Public Registry Verification</h3>
        </div>
        <span
          className={`badge ${allVerified ? 'badge-success' : 'badge-warning'}`}
          title="Fields matching MCA / GST / PAN registry records"
        >
          {verifiedCount}/{FIELD_ORDER.length} Verified
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: readOnly ? 0 : 14 }}>
        {FIELD_ORDER.map((key) => {
          const field = data[key];
          const isMatched = field.status === 'matched';
          return (
            <div
              key={key}
              className="card card-sm"
              style={{
                borderColor: isMatched ? 'var(--rule)' : 'var(--status-gap)',
                background: isMatched ? 'var(--paper-raised)' : 'var(--status-gap-soft)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-faint)' }}>
                  {FIELD_LABELS[key]}
                </span>
                {isMatched
                  ? <CheckCircle2 size={15} strokeWidth={2} color="var(--status-approved)" style={{ flexShrink: 0 }} />
                  : <AlertTriangle size={15} strokeWidth={2} color="var(--status-gap)" style={{ flexShrink: 0 }} />}
              </div>
              <div style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', color: 'var(--ink)', wordBreak: 'break-all' }}>
                {field.submitted}
              </div>
              {!isMatched && (
                <div style={{ fontSize: '0.72rem', color: 'var(--status-gap)', marginTop: 4 }}>
                  Registry has: <span style={{ fontFamily: 'var(--font-mono)' }}>{field.registry}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <button className="btn btn-secondary btn-sm" onClick={handleReverify} disabled={reverifying} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} strokeWidth={2} className={reverifying ? 'spin' : undefined} />
          {reverifying ? 'Re-verifying…' : 'Re-verify'}
        </button>
      )}
    </div>
  );
}
