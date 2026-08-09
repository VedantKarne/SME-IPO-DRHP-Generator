import React, { useState, useMemo } from 'react';
import { Activity, Edit3, Upload, CheckCircle, FileText } from 'lucide-react';
import './finance.css';

const MOCK_ACTIVITY = [
  { id: 1, type: 'upload', icon: Upload, user: 'Vedant Karne', time: '1 hour ago', detail: 'Uploaded updated FY23 Balance Sheet (V2)' },
  { id: 2, type: 'edit', icon: Edit3, user: 'Sanket Valunj', time: '3 hours ago', detail: 'Modified values in Section 4.2 Restated Financials' },
  { id: 3, type: 'verify', icon: CheckCircle, user: 'Vedant Karne', time: '1 day ago', detail: 'Marked Section 5.1 Financial Statements as Verified' },
  { id: 4, type: 'comment', icon: FileText, user: 'Rohan M.', time: '2 days ago', detail: 'Added a comment on Capital Structure table' },
  { id: 5, type: 'upload', icon: Upload, user: 'Sanket Valunj', time: '3 days ago', detail: 'Uploaded initial drafts of Tax Returns' },
];

export default function FinanceActivity() {
  const [filter, setFilter] = useState('all');

  const filteredActivity = useMemo(() => {
    if (filter === 'all') return MOCK_ACTIVITY;
    return MOCK_ACTIVITY.filter(a => a.type === filter);
  }, [filter]);
  return (
    <div className="finance-page">
      <header className="finance-header">
        <h1 className="finance-title">Activity Log</h1>
        <p className="finance-subtitle">Recent actions, uploads, and edits made within the CA workspace.</p>
      </header>

      <div className="finance-controls">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`finance-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`finance-filter-btn ${filter === 'upload' ? 'active' : ''}`} onClick={() => setFilter('upload')}>Uploads</button>
          <button className={`finance-filter-btn ${filter === 'edit' ? 'active' : ''}`} onClick={() => setFilter('edit')}>Edits</button>
          <button className={`finance-filter-btn ${filter === 'verify' ? 'active' : ''}`} onClick={() => setFilter('verify')}>Reviews</button>
          <button className={`finance-filter-btn ${filter === 'comment' ? 'active' : ''}`} onClick={() => setFilter('comment')}>Comments</button>
        </div>
      </div>

      <div className="finance-card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredActivity.length > 0 ? filteredActivity.map((act, index) => {
            const Icon = act.icon;
            const isLast = index === filteredActivity.length - 1;
            return (
              <div key={act.id} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                {/* Timeline line */}
                {!isLast && (
                  <div style={{ position: 'absolute', left: '15px', top: '32px', bottom: '-16px', width: '2px', background: 'var(--rule)' }} />
                )}
                
                {/* Icon Circle */}
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--paper-sunken)', border: '1px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, flexShrink: 0 }}>
                  <Icon size={14} color="var(--ink-soft)" />
                </div>

                {/* Content */}
                <div style={{ paddingBottom: isLast ? '0' : '24px', paddingTop: '6px' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--ink)' }}>
                    <span style={{ fontWeight: 600 }}>{act.user}</span> {act.detail}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', marginTop: '4px' }}>
                    {act.time}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-faint)' }}>
              No activity found for this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
