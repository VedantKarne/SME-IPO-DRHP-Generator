// Finance/CA's Financial Data page — the core of the review workflow:
// view the KPIs already produced by the extraction pipeline
// (src/extraction/kpi_extractor.py / document_upload_router.py's
// auto-populate step) for each fiscal year, correct any that are wrong,
// and mark a year verified once checked. Reads/writes only the
// FinancialStatement rows already in the DB — never re-extracts.
//
// Correct/Verify controls are permission-gated and hidden (not
// disabled-then-403'd) for any role other than Finance/CA.
import { useState, useEffect, useCallback } from 'react';
import { Pencil, CheckCircle2, Save, X } from 'lucide-react';
import { getCurrentRole } from '../../utils/auth';
import { can } from '../../permissions/financeRolePermissions';
import { getFinancials, correctFinancialStatement, verifyFinancialStatement, getFinancialStatus } from './api';

const FIELDS = [
  { key: 'revenue_lakhs', label: 'Revenue (₹L)' },
  { key: 'ebitda_lakhs', label: 'EBITDA (₹L)' },
  { key: 'pat_lakhs', label: 'PAT (₹L)' },
  { key: 'net_worth_lakhs', label: 'Net Worth (₹L)' },
  { key: 'paid_up_capital_lakhs', label: 'Paid-up Capital (₹L)' },
];

// Mirrors FinancialStatement.source values used across the codebase
// (document_upload_router.py, db_session.py's demo seed, this page's own
// corrections) — see HARDCODED_DATA_LOG.md for the full provenance note.
const SOURCE_LABELS = {
  ai_extracted: 'AI-extracted',
  promoter_input: 'Promoter input',
  finance_corrected: 'Finance/CA corrected',
  demo_seed: 'Seed data',
};

function StatementRow({ companyId, statement, canCorrect, canVerify, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(statement);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { setDraft(statement); }, [statement]);

  useEffect(() => {
    let cancelled = false;
    getFinancialStatus(companyId, statement.fiscal_year)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [companyId, statement.fiscal_year]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const changes = {};
      FIELDS.forEach(({ key }) => {
        if (String(draft[key] ?? '') !== String(statement[key] ?? '')) {
          changes[key] = draft[key] === '' || draft[key] == null ? null : Number(draft[key]);
        }
      });
      const updated = await correctFinancialStatement(companyId, statement.fiscal_year, changes);
      setEditing(false);
      onChanged(updated);
      setStatus(await getFinancialStatus(companyId, statement.fiscal_year));
    } catch (err) {
      setError('Could not save that correction.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setError(null);
    try {
      await verifyFinancialStatement(companyId, statement.fiscal_year);
      setStatus(await getFinancialStatus(companyId, statement.fiscal_year));
    } catch (err) {
      setError('Could not mark this year verified.');
    }
  };

  return (
    <div className="card finance-fy-card">
      <div className="finance-fy-header">
        <div>
          <div className="finance-fy-year">FY{statement.fiscal_year}</div>
          <div className="finance-fy-source">{SOURCE_LABELS[statement.source] || statement.source || 'Unknown source'}</div>
        </div>
        <div className="finance-fy-actions">
          {status?.verified && (
            <span className="badge badge-success"><CheckCircle2 size={12} strokeWidth={2} /> Verified</span>
          )}
          {canVerify && !status?.verified && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleVerify}>Mark Verified</button>
          )}
          {canCorrect && !editing && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              <Pencil size={13} strokeWidth={2} /> Correct
            </button>
          )}
          {editing && (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                <Save size={13} strokeWidth={2} /> Save
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setDraft(statement); }}>
                <X size={13} strokeWidth={2} />
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="canvas-error" role="alert" style={{ marginTop: 10 }}>{error}</div>}

      <div className="finance-fy-grid">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="finance-fy-field">
            <div className="finance-fy-field-label">{label}</div>
            {editing ? (
              <input
                type="number" value={draft[key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
              />
            ) : (
              <div className="finance-fy-field-value">
                {statement[key] != null ? statement[key].toLocaleString('en-IN') : '—'}
              </div>
            )}
          </div>
        ))}
      </div>

      {status?.corrections?.length > 0 && (
        <div className="finance-fy-history">
          <div className="finance-fy-history-title">Correction history</div>
          {status.corrections.map((c, i) => (
            <div key={i} className="finance-fy-history-item">{c.note}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FinanceFinancialData({ companyId }) {
  const role = getCurrentRole();
  const canCorrect = can(role, 'correctFinancialData');
  const canVerify = can(role, 'verifyFinancialData');

  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!companyId) return;
    getFinancials(companyId)
      .then((data) => setStatements(data.statements || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleChanged = (updated) => {
    setStatements((prev) => prev.map((s) => (s.fiscal_year === updated.fiscal_year ? updated : s)));
  };

  return (
    <div className="fade-in">
      <div className="dashboard-greeting">Financial Data</div>
      <div className="dashboard-company">Extracted KPIs by fiscal year</div>

      {loading ? (
        <p style={{ color: 'var(--ink-faint)' }}>Loading…</p>
      ) : statements.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--ink-faint)' }}>No financial statements on file yet. Upload one from the Documents page.</p>
        </div>
      ) : (
        statements.map((s) => (
          <StatementRow
            key={s.fiscal_year}
            companyId={companyId}
            statement={s}
            canCorrect={canCorrect}
            canVerify={canVerify}
            onChanged={handleChanged}
          />
        ))
      )}
    </div>
  );
}
