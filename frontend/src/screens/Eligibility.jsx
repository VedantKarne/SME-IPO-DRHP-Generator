import { CheckCircle2, XCircle, Paperclip } from 'lucide-react';

export default function Eligibility({ eligibility }) {
  if (!eligibility) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <p style={{ color: 'var(--text-muted)' }}>Loading eligibility data...</p>
    </div>
  );

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: 4 }}>Eligibility Engine</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.875rem' }}>
        Live SEBI ICDR eligibility analysis — powered by the Mar-2025 amended criteria.
      </p>

      {/* Overall verdict */}
      <div className="card" style={{
        marginBottom: 20,
        background: eligibility.eligible ? 'var(--success-dim)' : 'var(--error-dim)',
        borderColor: eligibility.eligible ? 'var(--success)' : 'var(--error)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 }}>{eligibility.company_name}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>CIN: {eligibility.company_id?.slice(0, 8)}...</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
              fontSize: '1.1rem', fontWeight: 700,
              color: eligibility.eligible ? 'var(--success)' : 'var(--error)',
              marginBottom: 4
            }}>
              {eligibility.eligible
                ? <><CheckCircle2 size={18} strokeWidth={2} /> Eligible for SME IPO</>
                : <><XCircle size={18} strokeWidth={2} /> Not Currently Eligible</>}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {eligibility.checks.filter(c => c.passed).length} / {eligibility.checks.length} criteria met
            </div>
          </div>
        </div>
      </div>

      {/* Individual checks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {eligibility.checks.map((check, i) => (
          <div key={i} className="card card-sm fade-in" style={{
            borderColor: check.passed ? 'var(--success)' : 'var(--error)',
            background: check.passed ? 'var(--success-dim)' : 'var(--error-dim)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  {check.passed
                    ? <CheckCircle2 size={18} strokeWidth={2} color="var(--success)" />
                    : <XCircle size={18} strokeWidth={2} color="var(--error)" />}
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{check.name}</span>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{check.reason}</p>
              </div>
              <span className={`badge ${check.passed ? 'badge-success' : 'badge-error'}`} style={{ flexShrink: 0 }}>
                {check.passed ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--accent-dim)', borderRadius: 'var(--radius-md)', fontSize: '0.72rem', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Paperclip size={12} strokeWidth={2} /> {check.clause_id}
            </div>
          </div>
        ))}
      </div>

      {/* Citations footer */}
      <div className="card card-sm">
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Regulatory Citations
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {eligibility.regulatory_citations.map((c, i) => (
            <span key={i} className="citation-tag">{c}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
