/**
 * AdminRoles.jsx
 * 
 * System Admin Roles & Permissions management page.
 * Displays authoritative role-to-permission summaries pulled directly from
 * the centralized permissions module (financeRolePermissions.js) so that
 * the UI can never drift out of sync with enforced backend rules.
 * 
 * Includes an interactive permissions inspector and shows structural regulatory
 * boundaries where permissions are fixed by SEBI ICDR compliance rules.
 */
import { useState } from 'react';
import { Shield, CheckCircle2, XCircle, Lock, AlertCircle, Info } from 'lucide-react';
import { getAllRolePermissionSummaries } from '../../permissions/financeRolePermissions';

export default function AdminRoles() {
  const roleSummaries = getAllRolePermissionSummaries();
  const [selectedRoleKey, setSelectedRoleKey] = useState('finance_ca');

  const selectedRole = roleSummaries.find((r) => r.key === selectedRoleKey) || roleSummaries[0];

  return (
    <div className="admin-page-container">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Roles & Permissions</h1>
        <p className="admin-page-subtitle">
          Centralized permission matrix and role boundaries enforced across DRHP drafting & review workflows.
        </p>
      </header>

      {/* Synchronized Module Banner */}
      <div className="admin-info-banner">
        <Info size={16} className="banner-icon" />
        <div>
          <strong>Authoritative Centralized Enforcement:</strong> Summaries below are loaded directly from the
          centralized permissions module (<code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>financeRolePermissions.js</code>).
          Backend API gates strictly mirror these definitions.
        </div>
      </div>

      {/* Role Selection Tabs */}
      <div className="admin-role-tabs">
        {roleSummaries.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`admin-role-tab ${selectedRoleKey === r.key ? 'active' : ''}`}
            onClick={() => setSelectedRoleKey(r.key)}
          >
            <Shield size={14} />
            <span>{r.label}</span>
          </button>
        ))}
      </div>

      {/* Selected Role Detail Card */}
      <div className="admin-role-detail-card">
        <div className="admin-role-header">
          <div>
            <h2 className="admin-role-title">{selectedRole.label}</h2>
            <p className="admin-role-desc">{selectedRole.description}</p>
          </div>
          <span className="admin-badge admin-badge-gray" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
            System Role: {selectedRole.key}
          </span>
        </div>

        <div className="admin-permissions-grid">
          {/* Allowed Actions */}
          <div className="admin-perm-column allowed">
            <div className="admin-perm-column-title">
              <CheckCircle2 size={16} color="#2D6A4F" />
              <span>Allowed Capabilities (CAN)</span>
            </div>
            <ul className="admin-perm-list">
              {selectedRole.can.map((item, idx) => (
                <li key={idx} className="admin-perm-item allowed">
                  <CheckCircle2 size={14} className="icon" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Restricted Actions */}
          <div className="admin-perm-column restricted">
            <div className="admin-perm-column-title">
              <XCircle size={16} color="#8A2E2E" />
              <span>Restricted Actions (CANNOT)</span>
            </div>
            <ul className="admin-perm-list">
              {selectedRole.cannot.map((item, idx) => (
                <li key={idx} className="admin-perm-item restricted">
                  <XCircle size={14} className="icon" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Structural Boundary Footnote */}
        <div className="admin-role-footnote">
          <Lock size={14} />
          <span>
            <strong>Regulatory Boundary:</strong> Section certification is strictly reserved for the Merchant Banker under SEBI ICDR 2018. Neither System Admin nor Finance/CA can override locked section states.
          </span>
        </div>
      </div>
    </div>
  );
}
