import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, Scale, Users, ClipboardList, FileWarning, FileUp, FileEdit, CheckCircle2, XCircle, AlertTriangle, Search, MessageCircleQuestion } from 'lucide-react';
import { authedFetch } from '../utils/auth';
import ScoreRing from '../components/ScoreRing';

const API = 'http://127.0.0.1:8000';

// design-system.md: score rings use a single --signal stroke, not a
// per-category rainbow — the icon still varies per category, the color doesn't.
const SUBSCORES = [
  { key: 'financial_score',  label: 'Financials',  icon: Wallet },
  { key: 'legal_score',      label: 'Legal',        icon: Scale },
  { key: 'management_score', label: 'Management',   icon: Users },
  { key: 'overall_score',    label: 'Compliance',   icon: ClipboardList },
];

/**
 * Next actions, derived from the company's actual state.
 *
 * This was a fixed array rendered unconditionally — including an item naming a
 * fabricated individual ("Rahul Sharma — provide litigation details") and a
 * hardcoded "2 sections awaiting certification". Every user saw the same list
 * regardless of their data.
 */
function buildNextActions({ sections = [], readiness = {}, eligibility }) {
  const actions = [];

  const failed = (eligibility?.checks || []).filter((c) => !c.passed);
  failed.forEach((check) => {
    actions.push({
      icon: Scale,
      title: `Resolve: ${check.name}`,
      desc: check.reason || 'Eligibility condition not met.',
      urgent: true,
    });
  });

  const blocked = sections.filter((s) => s.sync_status === 'red' && (s.missing_docs || []).length);
  if (blocked.length) {
    const docs = [...new Set(blocked.flatMap((s) => s.missing_docs))].slice(0, 3);
    actions.push({
      icon: FileUp,
      title: `Upload ${docs.length > 1 ? 'missing documents' : docs[0]}`,
      desc: `${blocked.length} section${blocked.length > 1 ? 's are' : ' is'} blocked: ${docs.join(', ')}`,
      urgent: true,
    });
  }

  const undrafted = sections.filter((s) => !s.draft_text);
  if (undrafted.length) {
    actions.push({
      icon: FileEdit,
      title: `Generate ${undrafted.length} remaining section${undrafted.length > 1 ? 's' : ''}`,
      desc: `Starting with "${undrafted[0].name}" in the Document Workspace`,
      urgent: false,
    });
  }

  const awaiting = sections.filter((s) => s.draft_text && !s.locked);
  if (awaiting.length) {
    actions.push({
      icon: CheckCircle2,
      title: 'Get Merchant Banker approval',
      desc: `${awaiting.length} section${awaiting.length > 1 ? 's' : ''} awaiting intermediary certification`,
      urgent: false,
    });
  }

  if (readiness.total_open_gaps) {
    actions.push({
      icon: FileWarning,
      title: `Close ${readiness.total_open_gaps} flagged gap${readiness.total_open_gaps > 1 ? 's' : ''}`,
      desc: 'Open the flagged gaps panel in the Document Workspace',
      urgent: true,
    });
  }

  return actions;
}

export default function Dashboard({ companyId, companyName, sections, readiness, eligibility: propEligibility, consistency: propConsistency }) {
  const navigate = useNavigate();
  const [eligibilityData, setEligibilityData] = useState(propEligibility || null);
  const [consistencyData, setConsistencyData] = useState(propConsistency || null);
  const [clarifications, setClarifications] = useState([]);

  useEffect(() => {
    if (propEligibility) setEligibilityData(propEligibility);
    if (propConsistency) setConsistencyData(propConsistency);
  }, [propEligibility, propConsistency]);

  useEffect(() => {
    if (!companyId) return;

    // Fetch eligibility if not present
    authedFetch(`${API}/api/eligibility/${companyId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setEligibilityData(data); })
      .catch(err => console.error('Eligibility fetch error:', err));

    // Fetch consistency if not present
    authedFetch(`${API}/api/consistency/${companyId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setConsistencyData(data); })
      .catch(err => console.error('Consistency fetch error:', err));

    // Finance/CA's flagged clarification requests (src/api/finance_router.py).
    // No existing Founder-facing comment feed exists to reuse — this is the
    // first one, so it's additive here rather than replacing anything.
    authedFetch(`${API}/api/finance/${companyId}/clarifications`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setClarifications(data.clarifications || []); })
      .catch(err => console.error('Clarifications fetch error:', err));
  }, [companyId]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  // Was hardcoded to a single first name for every account.
  const promoterName = (companyName || '').trim() || 'there';

  const eligibility = eligibilityData;
  const consistency = consistencyData;

  const r = readiness || {};
  const overall = r.overall_score || 0;
  // `?? 22` invented a section count before readiness had loaded.
  const pending = r.sections_pending ?? 0;
  const approved = r.sections_approved ?? 0;
  const openGaps = r.total_open_gaps ?? 0;

  const nextActions = buildNextActions({
    sections: sections || [],
    readiness: r,
    eligibility,
  });

  // Estimate days based on pending sections
  const estimatedDays = pending * 2;

  return (
    <div className="fade-in">
      {/* Greeting */}
      <div className="dashboard-greeting">
        {greeting}, {promoterName}
      </div>
      <div className="dashboard-company">{companyName || 'Loading company...'}</div>

      {/* Hero — Readiness + Stats */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="readiness-hero">
          <ScoreRing score={overall} />
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4, color: 'var(--ink)' }}>
              IPO Readiness Score
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginBottom: 20, maxWidth: 380 }}>
              Your DRHP preparation is {overall}% complete. {pending > 0 ? `${pending} sections still need to be generated and reviewed.` : 'All sections generated — final review pending.'}
            </p>
            <div className="readiness-stats">
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--status-draft)' }}>{estimatedDays}</div>
                <div className="stat-label">Est. Days Remaining</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--status-gap)' }}>{openGaps + (eligibility?.checks?.filter(c => !c.passed).length || 0)}</div>
                <div className="stat-label">Open Issues</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--status-approved)' }}>{approved}</div>
                <div className="stat-label">Sections Approved</div>
              </div>
            </div>
          </div>
        </div>

        <button className="btn btn-primary btn-lg" style={{ marginTop: 8 }} onClick={() => navigate('/workspace')}>
          Continue Preparation →
        </button>
      </div>

      {/* Sub-score rings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {SUBSCORES.map(({ key, label, icon: Icon }) => (
          <div key={key} className="card card-sm" style={{ textAlign: 'center' }}>
            <Icon size={20} strokeWidth={1.5} color="var(--signal)" style={{ marginBottom: 6 }} />
            <ScoreRing score={r[key] || 0} size={100} stroke={8} />
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-soft)', marginTop: 12 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Section quick overview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Sections status */}
        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: '0.95rem', color: 'var(--ink)' }}>Section Pipeline</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Approved & Locked', count: approved, color: 'var(--status-approved)' },
              { label: 'In Draft', count: r.sections_in_draft || 0, color: 'var(--status-draft)' },
              { label: 'Not Started', count: pending, color: 'var(--ink-faint)' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--paper-sunken)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>{label}</span>
                <span style={{ fontWeight: 700, color }}>{count}</span>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/workspace')}>
              Open Workspace →
            </button>
          </div>
        </div>

        {/* Eligibility quick status */}
        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: '0.95rem', color: 'var(--ink)' }}>Eligibility Checks</h3>
          {eligibility ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {eligibility.checks.slice(0, 4).map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', padding: '6px 0', borderBottom: '1px solid var(--rule)' }}>
                  <span style={{ color: 'var(--ink-soft)' }}>{c.name}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: c.passed ? 'var(--status-approved)' : 'var(--status-gap)' }}>
                    {c.passed ? <CheckCircle2 size={14} strokeWidth={2} /> : <XCircle size={14} strokeWidth={2} />}
                    {c.passed ? 'Pass' : 'Fail'}
                  </span>
                </div>
              ))}
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => navigate('/eligibility')}>
                Full Report →
              </button>
            </div>
          ) : (
            <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>Loading...</p>
          )}
        </div>
        </div>

        {/* Data Consistency Checks */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Search size={16} strokeWidth={1.5} color="var(--ink-soft)" />
            <h3 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--ink)' }}>Data Consistency Checks</h3>
            {consistency && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: '0.72rem', fontWeight: 600,
                color: consistency.has_issues ? 'var(--status-gap)' : 'var(--status-approved)',
              }}>
                {consistency.has_issues
                  ? `${consistency.issue_count} Issue${consistency.issue_count > 1 ? 's' : ''} Found`
                  : 'All Clear'}
              </span>
            )}
          </div>

          {!consistency ? (
            <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>Loading...</p>
          ) : !consistency.has_issues ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--status-approved-soft)', border: '1px solid rgba(61,107,79,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <CheckCircle2 size={18} strokeWidth={1.5} color="var(--status-approved)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
                All financial figures, capital structure components, and turnover data are internally consistent.
              </span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              {consistency.checks.map((check, i) => {
                const isCritical = check.severity === 'critical';
                return (
                  <div key={i} style={{
                    padding: '12px 14px',
                    background: isCritical ? 'var(--status-gap-soft)' : 'var(--status-draft-soft)',
                    border: `1px solid ${isCritical ? 'rgba(118,45,63,0.25)' : 'rgba(148,111,46,0.25)'}`,
                    borderLeft: `3px solid ${isCritical ? 'var(--status-gap)' : 'var(--status-draft)'}`,
                    borderRadius: 'var(--radius-sm)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
                        {check.field.replace(/_/g, ' ')}
                      </span>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
                        fontSize: '0.68rem', fontWeight: 600,
                        color: isCritical ? 'var(--status-gap)' : 'var(--status-draft)',
                      }}>
                        <AlertTriangle size={12} strokeWidth={2} />
                        {isCritical ? 'Critical' : 'Warning'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', lineHeight: 1.55, margin: 0 }}>
                      {check.fix}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Finance/CA clarification requests — only shown when there are any,
          so this doesn't add clutter for companies with no Finance/CA
          reviewer yet. */}
      {clarifications.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 14, fontSize: '0.95rem', color: 'var(--ink)' }}>Clarification Requests</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {clarifications.map((c) => (
              <div key={c.id} style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                padding: '12px 14px',
                background: 'var(--status-draft-soft)',
                border: '1px solid rgba(148,111,46,0.2)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <MessageCircleQuestion size={18} strokeWidth={1.5} color="var(--status-draft)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2, color: 'var(--ink)' }}>
                    Finance/CA needs input on "{c.section_name}"
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>{c.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Actions */}
      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: '0.95rem', color: 'var(--ink)' }}>Next Actions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nextActions.length === 0 && (
            <div style={{ fontSize: '0.82rem', color: 'var(--ink-faint)' }}>
              Nothing outstanding right now.
            </div>
          )}
          {nextActions.map((a, i) => (
            <div key={i} style={{
              display: 'flex', gap: 14, alignItems: 'flex-start',
              padding: '12px 14px',
              background: a.urgent ? 'var(--status-gap-soft)' : 'var(--paper-sunken)',
              border: `1px solid ${a.urgent ? 'rgba(118,45,63,0.2)' : 'var(--rule)'}`,
              borderRadius: 'var(--radius-sm)',
            }}>
              <a.icon size={18} strokeWidth={1.5} color={a.urgent ? 'var(--status-gap)' : 'var(--ink-soft)'} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 2, color: 'var(--ink)' }}>{a.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>{a.desc}</div>
              </div>
              {a.urgent && <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--status-gap)' }}>Urgent</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
