import React, { useState, useMemo } from 'react';
import { Search, FileText, CheckCircle, Clock, AlertCircle, Download } from 'lucide-react';
import './finance.css';

const MOCK_EVIDENCE = [
  { id: 1, name: 'Q3_Bank_Statement.pdf', type: 'Bank Statement', uploadedBy: 'Sanket V.', date: 'Oct 24, 2023', status: 'verified', size: '2.4 MB' },
  { id: 2, name: 'FY22_23_Audit_Report.pdf', type: 'Audit Report', uploadedBy: 'Vedant K.', date: 'Oct 22, 2023', status: 'verified', size: '5.1 MB' },
  { id: 3, name: 'Invoice_TechCorp_Sep.pdf', type: 'Invoice', uploadedBy: 'Rohan M.', date: 'Oct 20, 2023', status: 'pending', size: '1.2 MB' },
  { id: 4, name: 'Tax_Returns_2022.pdf', type: 'Tax Return', uploadedBy: 'Sanket V.', date: 'Oct 15, 2023', status: 'rejected', size: '4.7 MB' },
  { id: 5, name: 'Asset_Valuation_Report.pdf', type: 'Valuation', uploadedBy: 'Vedant K.', date: 'Oct 12, 2023', status: 'verified', size: '3.3 MB' },
];

export default function FinanceEvidence() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filteredEvidence = useMemo(() => {
    return MOCK_EVIDENCE.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filter === 'all' || item.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, filter]);
  return (
    <div className="finance-page">
      <header className="finance-header">
        <h1 className="finance-title">Supporting Evidence</h1>
        <p className="finance-subtitle">Review and verify uploaded financial documents and proofs.</p>
      </header>

      <div className="finance-controls">
        <div className="finance-search-bar">
          <Search size={16} color="var(--ink-soft)" />
          <input 
            type="text" 
            placeholder="Search evidence..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className={`finance-filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`finance-filter-btn ${filter === 'verified' ? 'active' : ''}`} onClick={() => setFilter('verified')}>Verified</button>
          <button className={`finance-filter-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pending</button>
          <button className={`finance-filter-btn ${filter === 'rejected' ? 'active' : ''}`} onClick={() => setFilter('rejected')}>Rejected</button>
        </div>
      </div>

      <div className="finance-card">
        <table className="finance-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--rule)', textAlign: 'left' }}>
              <th style={{ padding: '12px', fontSize: '0.875rem', color: 'var(--ink-soft)', fontWeight: 500 }}>Document Name</th>
              <th style={{ padding: '12px', fontSize: '0.875rem', color: 'var(--ink-soft)', fontWeight: 500 }}>Type</th>
              <th style={{ padding: '12px', fontSize: '0.875rem', color: 'var(--ink-soft)', fontWeight: 500 }}>Uploaded By</th>
              <th style={{ padding: '12px', fontSize: '0.875rem', color: 'var(--ink-soft)', fontWeight: 500 }}>Date</th>
              <th style={{ padding: '12px', fontSize: '0.875rem', color: 'var(--ink-soft)', fontWeight: 500 }}>Status</th>
              <th style={{ padding: '12px', fontSize: '0.875rem', color: 'var(--ink-soft)', fontWeight: 500 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvidence.length > 0 ? (
              filteredEvidence.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FileText size={18} color="var(--ink-soft)" />
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                    </div>
                  </td>
                  <td>{item.type}</td>
                  <td>{item.uploadedBy}</td>
                  <td>{item.date}</td>
                  <td>
                    {item.status === 'verified' && <span className="finance-badge verified"><CheckCircle size={12} /> Verified</span>}
                    {item.status === 'pending' && <span className="finance-badge pending"><Clock size={12} /> Pending</span>}
                    {item.status === 'rejected' && <span className="finance-badge rejected"><AlertCircle size={12} /> Rejected</span>}
                  </td>
                  <td>
                    <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--signal)', padding: '8px', borderRadius: '4px' }} title="Download">
                      <Download size={18} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--ink-soft)' }}>
                  No evidence documents match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
