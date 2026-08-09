/**
 * adminMockData.js
 * 
 * Placeholder mock data for Admin Console pending real backend integration.
 * Provides system-wide statistics for Active Projects, Active Users,
 * Pending Reviews, System Alerts, and panel summary metrics.
 */

export const ADMIN_SUMMARY_METRICS = [
  {
    id: 'projects',
    label: 'Active Projects',
    value: '24',
    change: '+3 this week',
    status: 'neutral',
  },
  {
    id: 'users',
    label: 'Active Users',
    value: '86',
    change: '+12 this month',
    status: 'neutral',
  },
  {
    id: 'reviews',
    label: 'Pending Reviews',
    value: '14',
    change: '4 priority',
    status: 'warning',
  },
  {
    id: 'alerts',
    label: 'System Alerts',
    value: '2',
    change: '1 requires action',
    status: 'alert',
  },
];

export const ADMIN_USERS_SUMMARY = {
  totalActive: 86,
  title: 'Users Overview',
  subtitle: '86 active platform accounts across 5 system roles',
  roleBreakdown: [
    { role: 'Founders / Promoters', count: 42, color: 'var(--ink)' },
    { role: 'Merchant Bankers', count: 18, color: 'var(--status-approved)' },
    { role: 'Finance / CAs', count: 14, color: 'var(--status-draft)' },
    { role: 'Legal Advisors', count: 8, color: 'var(--ink-soft)' },
    { role: 'System Admins', count: 4, color: 'var(--signal)' },
  ],
};

export const ADMIN_PROJECTS_SUMMARY = {
  totalActive: 24,
  title: 'Projects Overview',
  subtitle: '24 active SME IPO DRHP filings in progress',
  stageBreakdown: [
    { stage: 'Data Collection & Extraction', count: 8, pct: 33 },
    { stage: 'LangGraph AI Drafting', count: 10, pct: 42 },
    { stage: 'CA & Intermediary Review', count: 4, pct: 17 },
    { stage: 'Certified & Export Ready', count: 2, pct: 8 },
  ],
};

export const ADMIN_AUDIT_SUMMARY = {
  totalEventsToday: '1,284',
  title: 'Audit Events Today',
  subtitle: '1,284 system-wide events logged in the past 24 hours',
  recentEvents: [
    { id: 1, type: 'RAG Retrieval Queries', count: 642, rate: '50%' },
    { id: 2, type: 'AI Section Draft Generation', count: 380, rate: '30%' },
    { id: 3, type: 'CA Financial Corrections', count: 182, rate: '14%' },
    { id: 4, type: 'Intermediary Section Certifications', count: 80, rate: '6%' },
  ],
};
