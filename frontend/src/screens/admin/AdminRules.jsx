/**
 * AdminRules.jsx
 * 
 * System Admin Regulatory Rules page.
 * Provides a read-only inspection window into the Regulatory Intelligence
 * engine's SEBI ICDR 2018 rulesets, compliance checklists, and validation logic.
 * 
 * Read-only notice enforced: System Admin cannot alter SEBI regulations, only view
 * current ruleset versions and last synced timestamps.
 */
import { useState } from 'react';
import { BookOpen, ShieldAlert, Lock, Calendar, CheckCircle2, FileText, Info } from 'lucide-react';

export default function AdminRules() {
  const [rules] = useState([
    {
      id: 'reg-229-2a',
      regulation: 'SEBI ICDR Reg 229(2)(a)',
      title: 'Operating Profit & Track Record Requirement',
      description: 'Issuer must have operating profit (EBITDA) of at least ₹1 Crore in 2 out of 3 preceding fiscal years.',
      category: 'Financial Eligibility',
      status: 'Active Enforced',
      severity: 'Mandatory Gate',
    },
    {
      id: 'reg-229-1b',
      regulation: 'SEBI ICDR Reg 229(1)(b)',
      title: 'Positive Net Worth Requirement',
      description: 'Issuer must possess a positive net worth in the latest fiscal year audited financial statements.',
      category: 'Financial Eligibility',
      status: 'Active Enforced',
      severity: 'Mandatory Gate',
    },
    {
      id: 'reg-229-3',
      regulation: 'SEBI ICDR Reg 229(3)',
      title: 'Post-Issue Paid-Up Capital Limit',
      description: 'Post-issue paid-up capital of the issuer company shall not exceed ₹25 Crores for SME exchange listing.',
      category: 'Capital Structure',
      status: 'Active Enforced',
      severity: 'Cap Constraint',
    },
    {
      id: 'reg-229-1c',
      regulation: 'SEBI ICDR Reg 229(1)(c)',
      title: 'No Winding-Up Petition',
      description: 'No winding-up petition against the company has been admitted by NCLT or competent court.',
      category: 'Legal Clearance',
      status: 'Active Enforced',
      severity: 'Disqualification Risk',
    },
    {
      id: 'reg-mar-2025',
      regulation: 'SEBI Circular Mar 2025',
      title: 'KMP & Promoter Pending Litigation Disclosure',
      description: 'Full disclosure of all pending litigations involving Key Managerial Personnel and Promoters exceeding materiality threshold.',
      category: 'Legal Disclosures',
      status: 'Active Enforced',
      severity: 'Mandatory Disclosure',
    },
  ]);

  return (
    <div className="admin-page-container">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Regulatory Rules</h1>
        <p className="admin-page-subtitle">
          Inspection view of SEBI ICDR 2018 regulatory rulesets, validation thresholds, and compliance engine checks.
        </p>
      </header>

      {/* Read-Only Notice Banner */}
      <div className="admin-read-only-banner">
        <Lock size={16} className="banner-icon" />
        <div>
          <strong>Read-Only Regulatory Framework:</strong> SEBI ICDR regulations are maintained by Nirmaan AI's compliance rules engine.
          System Administrators can inspect active rulesets but cannot manually alter statutory SEBI provisions.
        </div>
      </div>

      {/* Rules Metadata Box */}
      <div className="admin-rules-meta-card">
        <div className="meta-item">
          <BookOpen size={16} className="icon" />
          <div>
            <div className="meta-label">Active Regulations Framework</div>
            <div className="meta-value">SEBI ICDR Regulations 2018 (as amended March 2025)</div>
          </div>
        </div>

        <div className="meta-item">
          <Calendar size={16} className="icon" />
          <div>
            <div className="meta-label">Last Ruleset Sync</div>
            <div className="meta-value">2026-03-01 10:00:00 IST</div>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="admin-table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Regulation Citation</th>
              <th>Rule Title & Description</th>
              <th>Category</th>
              <th>Severity</th>
              <th style={{ textAlign: 'right' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="admin-badge admin-badge-gray" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                    {r.regulation}
                  </span>
                </td>
                <td>
                  <div className="admin-rule-title">{r.title}</div>
                  <div className="admin-rule-desc">{r.description}</div>
                </td>
                <td className="admin-project-cell">{r.category}</td>
                <td>
                  <span className={`admin-badge ${r.severity === 'Disqualification Risk' ? 'admin-badge-red' : 'admin-badge-blue'}`}>
                    {r.severity}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className="admin-status-pill active" style={{ display: 'inline-flex' }}>
                    <span className="dot"></span>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
