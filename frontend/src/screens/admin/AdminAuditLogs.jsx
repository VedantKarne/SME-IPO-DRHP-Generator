/**
 * AdminAuditLogs.jsx
 * 
 * System Admin Audit Logs page.
 * Displays a chronological stream of platform activities, user actions,
 * financial corrections, section certifications, and AI draft generations.
 * 
 * Wires to real AuditLog database events with client-side filter controls.
 */
import { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, Search, Filter, Calendar, Activity, CheckCircle, FileText, Upload, AlertCircle } from 'lucide-react';
import { fetchAdminAuditLogs } from './api';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const data = await fetchAdminAuditLogs();
    setLogs(data);
    setLoading(false);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      const matchesSearch = !searchQuery ||
        (l.actor || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.action || l.query || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.project || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || l.category === categoryFilter || l.event_type === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [logs, searchQuery, categoryFilter]);

  const getEventIcon = (category) => {
    switch (category) {
      case 'financial_correction': return <AlertCircle size={15} color="#B45309" />;
      case 'section_approved': return <CheckCircle size={15} color="#2D6A4F" />;
      case 'ai_draft': return <FileText size={15} color="#3B82F6" />;
      case 'document_upload': return <Upload size={15} color="#6B7280" />;
      default: return <Activity size={15} color="#1C1B19" />;
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'Just now';
    try {
      const d = new Date(ts);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return ts;
    }
  };

  return (
    <div className="admin-page-container">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Audit Logs</h1>
        <p className="admin-page-subtitle">
          Chronological audit trail of user actions, section sign-offs, financial corrections, and RAG operations.
        </p>
      </header>

      {/* Filter Bar */}
      <div className="admin-filter-bar">
        <div className="admin-search-box">
          <Search size={15} className="admin-search-icon" />
          <input
            type="text"
            placeholder="Filter logs by actor, action description, or project name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-search-input"
          />
        </div>

        <div className="admin-filter-dropdowns">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="admin-select"
          >
            <option value="all">All Event Types</option>
            <option value="financial_correction">Financial Corrections</option>
            <option value="section_approved">Section Certifications</option>
            <option value="ai_draft">AI Generation</option>
            <option value="document_upload">Document Uploads</option>
            <option value="legal_review">Legal Reviews</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="admin-table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '180px' }}>Timestamp</th>
              <th>Actor</th>
              <th>Action / System Event</th>
              <th>Project</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="4" className="admin-empty-table">
                  No audit log entries matching your criteria.
                </td>
              </tr>
            ) : (
              filteredLogs.map((l) => (
                <tr key={l.id}>
                  <td className="admin-timestamp-cell">
                    <Calendar size={13} style={{ marginRight: 6, color: 'var(--ink-faint)' }} />
                    {formatTimestamp(l.timestamp)}
                  </td>
                  <td className="admin-actor-cell">{l.actor || 'System Engine'}</td>
                  <td>
                    <div className="admin-action-flex">
                      {getEventIcon(l.category || l.event_type)}
                      <span>{l.action || l.query || 'Platform activity recorded'}</span>
                    </div>
                  </td>
                  <td className="admin-project-cell">{l.project || 'TechServ Solutions Ltd'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
