import React, { useState, useMemo } from 'react';
import { MessageSquare, Filter } from 'lucide-react';
import './finance.css';

const MOCK_COMMENTS = [
  { id: 1, section: '3.2 Capital Structure', author: 'Sanket Valunj', role: 'Promoter', time: '2 hours ago', content: 'Can we re-verify the pre-issue share capital numbers? They seem to be off by 10,000 shares.', status: 'open' },
  { id: 2, section: '5.1 Financial Statements', author: 'Vedant Karne', role: 'Merchant Banker', time: '1 day ago', content: 'The depreciation schedule for FY23 is missing from the annexures. Please upload.', status: 'resolved' },
  { id: 3, section: '7.4 Related Party Transactions', author: 'Rohan M.', role: 'Legal Advisor', time: '3 days ago', content: 'Need clarification on the rent paid to director\'s relative. Is there a registered lease agreement?', status: 'open' },
];

export default function FinanceComments() {
  const [filter, setFilter] = useState('open');

  const filteredComments = useMemo(() => {
    if (filter === 'all') return MOCK_COMMENTS;
    return MOCK_COMMENTS.filter(c => c.status === filter);
  }, [filter]);
  return (
    <div className="finance-page">
      <header className="finance-header">
        <h1 className="finance-title">Discussion & Comments</h1>
        <p className="finance-subtitle">Review queries and feedback from promoters and merchant bankers.</p>
      </header>

      <div className="finance-controls">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`finance-filter-btn ${filter === 'open' ? 'active' : ''}`} onClick={() => setFilter('open')}>Active</button>
          <button className={`finance-filter-btn ${filter === 'resolved' ? 'active' : ''}`} onClick={() => setFilter('resolved')}>Resolved</button>
          <button className={`finance-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
        {filteredComments.length > 0 ? filteredComments.map((comment) => (
          <div key={comment.id} className="finance-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--rule)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={16} color="var(--signal)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)' }}>{comment.section}</span>
              </div>
              <span className={`finance-badge ${comment.status}`}>
                {comment.status}
              </span>
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--ink)', lineHeight: '1.5' }}>
              {comment.content}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--ink-soft)', marginTop: '8px' }}>
              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{comment.author}</div>
              <div style={{ background: 'var(--paper)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--rule)' }}>{comment.role}</div>
              <div>•</div>
              <div>{comment.time}</div>
            </div>
          </div>
        )) : (
          <div className="finance-card" style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-faint)' }}>
            No comments found in this view.
          </div>
        )}
      </div>
    </div>
  );
}
