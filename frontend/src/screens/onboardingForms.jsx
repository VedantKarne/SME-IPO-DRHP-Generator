/**
 * onboardingForms.jsx — structured capture steps for the onboarding interview.
 *
 * WHY THIS EXISTS
 * ---------------
 * Onboarding collected five free-text chat answers and posted them to
 * /api/companies/{id}/setup. The `wizard.py` endpoints that accept financials,
 * directors and offer details had no caller anywhere in the frontend, so
 * `financial_statement`, `director_kmp` and `offer_details` stayed empty — all
 * three had zero rows. Generation then had no company facts to draft from,
 * which is why sections came back with low completeness and long gap lists, and
 * why the eligibility engine could not evaluate its financial checks at all.
 *
 * Tabular data (three years of figures, a board of directors) is a poor fit for
 * a chat transcript, so these render as inline form cards inside the message
 * stream and post to the existing wizard endpoints. No new backend.
 */

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

const cellStyle = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--glass-border)',
  background: 'var(--paper-raised)',
  color: 'var(--text-primary)',
  fontSize: '0.8rem',
};

const labelStyle = {
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

function Card({ title, hint, children, onSubmit, onSkip, busy, error, submitLabel = 'Continue' }) {
  return (
    <div className="card" style={{ margin: '10px 0', padding: 16 }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 2 }}>{title}</div>
      {hint && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          {hint}
        </div>
      )}
      {children}
      {error && (
        <div className="canvas-error" role="alert" style={{ marginTop: 10 }}>
          <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" /> {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={onSubmit} disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
        {/* Skipping is honest and recoverable: the data can be added later from
            the Documents screen. Forcing invented numbers here would be worse. */}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onSkip} disabled={busy}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Financials — three fiscal years, which is what SEBI eligibility looks at
// ---------------------------------------------------------------------------

const FIN_FIELDS = [
  ['revenue_lakhs', 'Revenue'],
  ['ebitda_lakhs', 'EBITDA'],
  ['pat_lakhs', 'PAT'],
  ['net_worth_lakhs', 'Net worth'],
  ['paid_up_capital_lakhs', 'Paid-up capital'],
];

export function FinancialsForm({ years, onSave, onSkip }) {
  const [rows, setRows] = useState(
    years.map((y) => ({
      fiscal_year: y,
      revenue_lakhs: '', ebitda_lakhs: '', pat_lakhs: '',
      net_worth_lakhs: '', paid_up_capital_lakhs: '',
    }))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const update = (idx, key, value) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

  const submit = async () => {
    // Only send years the user actually filled in. Sending zeros would assert
    // figures that were never provided, and the eligibility engine would then
    // fail a company on numbers it invented.
    const payload = rows
      .filter((r) => FIN_FIELDS.some(([k]) => String(r[k]).trim() !== ''))
      .map((r) => {
        const out = { fiscal_year: r.fiscal_year };
        FIN_FIELDS.forEach(([k]) => {
          const v = String(r[k]).trim();
          if (v !== '') out[k] = Number(v);
        });
        return out;
      });

    if (!payload.length) { setError('Enter at least one year, or skip for now.'); return; }
    const bad = payload.find((r) => FIN_FIELDS.some(([k]) => k in r && Number.isNaN(r[k])));
    if (bad) { setError(`FY${bad.fiscal_year} has a value that is not a number.`); return; }

    setBusy(true); setError(null);
    try { await onSave(payload); }
    catch (e) { setError(e.message || 'Could not save financials.'); }
    finally { setBusy(false); }
  };

  return (
    <Card
      title="Audited financials"
      hint="All figures in ₹ lakhs. SEBI eligibility is assessed on the last three years — leave a year blank if it is not available."
      onSubmit={submit} onSkip={onSkip} busy={busy} error={error}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '6px 4px' }}>
          <thead>
            <tr>
              <th style={{ ...labelStyle, textAlign: 'left' }}>Year</th>
              {FIN_FIELDS.map(([k, label]) => (
                <th key={k} style={{ ...labelStyle, textAlign: 'left' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.fiscal_year}>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  FY{row.fiscal_year}
                </td>
                {FIN_FIELDS.map(([k]) => (
                  <td key={k}>
                    <input
                      style={cellStyle}
                      inputMode="decimal"
                      placeholder="—"
                      value={row[k]}
                      onChange={(e) => update(i, k, e.target.value)}
                      aria-label={`FY${row.fiscal_year} ${k}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Directors and KMP
// ---------------------------------------------------------------------------

const emptyDirector = () => ({
  name: '', din: '', designation: '',
  pending_litigation: false, litigation_details: '',
});

export function DirectorsForm({ onSave, onSkip }) {
  const [rows, setRows] = useState([emptyDirector()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const update = (idx, key, value) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

  const submit = async () => {
    const payload = rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        din: r.din.trim() || null,
        designation: r.designation.trim() || null,
        pending_litigation: !!r.pending_litigation,
        litigation_details: r.pending_litigation ? (r.litigation_details.trim() || null) : null,
      }));

    if (!payload.length) { setError('Add at least one director, or skip for now.'); return; }
    const badDin = payload.find((d) => d.din && !/^\d{8}$/.test(d.din));
    if (badDin) { setError(`DIN for ${badDin.name} should be 8 digits.`); return; }
    const missingDetail = payload.find((d) => d.pending_litigation && !d.litigation_details);
    if (missingDetail) {
      setError(`Describe the pending litigation for ${missingDetail.name} — it is a mandatory disclosure.`);
      return;
    }

    setBusy(true); setError(null);
    try { await onSave(payload); }
    catch (e) { setError(e.message || 'Could not save directors.'); }
    finally { setBusy(false); }
  };

  return (
    <Card
      title="Directors and key managerial personnel"
      hint="Pending litigation against a director is a mandatory DRHP disclosure and is checked by the eligibility engine."
      onSubmit={submit} onSkip={onSkip} busy={busy} error={error}
    >
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1.4fr', gap: 8,
          marginBottom: 10, paddingBottom: 10,
          borderBottom: i < rows.length - 1 ? '1px solid var(--glass-border)' : 'none',
        }}>
          <input style={cellStyle} placeholder="Full name" value={row.name}
                 onChange={(e) => update(i, 'name', e.target.value)} aria-label={`Director ${i + 1} name`} />
          <input style={cellStyle} placeholder="DIN (8 digits)" value={row.din}
                 onChange={(e) => update(i, 'din', e.target.value)} aria-label={`Director ${i + 1} DIN`} />
          <input style={cellStyle} placeholder="Designation" value={row.designation}
                 onChange={(e) => update(i, 'designation', e.target.value)} aria-label={`Director ${i + 1} designation`} />

          <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={row.pending_litigation}
                   onChange={(e) => update(i, 'pending_litigation', e.target.checked)} />
            Pending litigation against this person
          </label>
          {row.pending_litigation && (
            <input style={{ ...cellStyle, gridColumn: '1 / -1' }}
                   placeholder="Nature of the litigation (required for disclosure)"
                   value={row.litigation_details}
                   onChange={(e) => update(i, 'litigation_details', e.target.value)} />
          )}
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm"
              onClick={() => setRows((p) => [...p, emptyDirector()])} disabled={busy}>
        + Add another
      </button>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Offer details
// ---------------------------------------------------------------------------

export function OfferForm({ onSave, onSkip }) {
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [objects, setObjects] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const sharesNum = Number(String(shares).replace(/,/g, ''));
  const priceNum = Number(price);
  const sizeLakhs =
    shares && price && !Number.isNaN(sharesNum) && !Number.isNaN(priceNum)
      ? (sharesNum * priceNum) / 100000
      : null;

  const submit = async () => {
    if (!shares || !price) { setError('Enter both the number of shares and the price, or skip for now.'); return; }
    if (Number.isNaN(sharesNum) || Number.isNaN(priceNum)) { setError('Shares and price must be numbers.'); return; }
    if (sharesNum <= 0 || priceNum <= 0) { setError('Shares and price must be greater than zero.'); return; }

    setBusy(true); setError(null);
    try {
      await onSave({
        total_shares_offered: Math.round(sharesNum),
        price_per_share: priceNum,
        objects_of_offer: objects.split('\n').map((o) => o.trim()).filter(Boolean),
      });
    } catch (e) { setError(e.message || 'Could not save offer details.'); }
    finally { setBusy(false); }
  };

  return (
    <Card
      title="Proposed offer"
      hint="Used for the Capital Structure and Objects of the Offer sections. Estimates are fine — you can revise them later."
      onSubmit={submit} onSkip={onSkip} busy={busy} error={error}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={labelStyle}>Equity shares offered</div>
          <input style={cellStyle} inputMode="numeric" placeholder="e.g. 4000000"
                 value={shares} onChange={(e) => setShares(e.target.value)} aria-label="Shares offered" />
        </div>
        <div>
          <div style={labelStyle}>Price per share (₹)</div>
          <input style={cellStyle} inputMode="decimal" placeholder="e.g. 125"
                 value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price per share" />
        </div>
      </div>

      {sizeLakhs !== null && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 8 }}>
          Total issue size: <strong>₹{sizeLakhs.toLocaleString(undefined, { maximumFractionDigits: 2 })} lakhs</strong>
          {' '}(₹{(sizeLakhs / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} crore)
        </div>
      )}

      <div style={{ marginTop: 10 }}>
        <div style={labelStyle}>Objects of the offer — one per line</div>
        <textarea style={{ ...cellStyle, minHeight: 64, resize: 'vertical' }}
                  placeholder={'Funding capital expenditure\nWorking capital requirements\nGeneral corporate purposes'}
                  value={objects} onChange={(e) => setObjects(e.target.value)} aria-label="Objects of the offer" />
      </div>
    </Card>
  );
}
