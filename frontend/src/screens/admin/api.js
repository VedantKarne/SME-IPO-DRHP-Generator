/**
 * api.js
 * 
 * Data-fetching layer for the System Admin Console.
 * Interacts with backend /api/admin/* endpoints for users, projects, audit logs,
 * system monitoring, and regulatory rules.
 * 
 * Falls back to structured mock data when offline or when backend endpoints
 * are unreachable, keeping UI components clean and decoupled.
 */
import { authedFetch } from '../../utils/auth';

const API = 'http://127.0.0.1:8000';

// Fallback seed users if backend returns empty list or fails
export const FALLBACK_USERS = [
  { id: 'usr-1', name: 'Vedant Karne', email: 'vedant@techserv.com', role: 'promoter', company_name: 'TechServ Solutions Ltd', is_active: true },
  { id: 'usr-2', name: 'Shruti Joshi', email: 'shruti.ca@auditfirm.in', role: 'finance_ca', company_name: 'TechServ Solutions Ltd', is_active: true },
  { id: 'usr-3', name: 'Rajesh Malhotra', email: 'rajesh@leadmanagers.com', role: 'merchant_banker', company_name: 'TechServ Solutions Ltd', is_active: true },
  { id: 'usr-4', name: 'Ananya Roy', email: 'ananya.legal@chambers.in', role: 'legal_advisor', company_name: 'TechServ Solutions Ltd', is_active: true },
  { id: 'usr-5', name: 'System Admin', email: 'admin@nirmaan.ai', role: 'admin', company_name: 'Nirmaan AI System', is_active: true },
  { id: 'usr-6', name: 'Priya Sharma', email: 'priya@apexhealth.com', role: 'promoter', company_name: 'Apex Healthcare Ltd', is_active: true },
  { id: 'usr-7', name: 'Amit Patel', email: 'amit@greenenergy.in', role: 'promoter', company_name: 'GreenEnergy Infra Pvt Ltd', is_active: true },
  { id: 'usr-8', name: 'Vikram Singh', email: 'vikram@zenithlogistics.com', role: 'promoter', company_name: 'Zenith Logistics Ltd', is_active: false },
];

export const FALLBACK_PROJECTS = [
  { id: 'prj-1', name: 'TechServ Solutions Ltd', cin: 'U72900MH2018PLC312456', stage: 'CA & Intermediary Review', status: 'Active', assigned_users: ['Vedant Karne', 'Shruti Joshi', 'Rajesh Malhotra'] },
  { id: 'prj-2', name: 'Apex Healthcare Ltd', cin: 'U85110DL2019PLC234890', stage: 'LangGraph AI Drafting', status: 'Active', assigned_users: ['Priya Sharma', 'Ananya Roy'] },
  { id: 'prj-3', name: 'GreenEnergy Infra Pvt Ltd', cin: 'U40106KA2020PTC145678', stage: 'Data Collection', status: 'Active', assigned_users: ['Amit Patel'] },
  { id: 'prj-4', name: 'Zenith Logistics Ltd', cin: 'U60231TN2017PLC089123', stage: 'Certified & Export Ready', status: 'Completed', assigned_users: ['Vikram Singh'] },
];

export const FALLBACK_AUDIT_LOGS = [
  { id: 'log-1', timestamp: '2026-03-09T11:42:00Z', actor: 'Shruti Joshi (Finance/CA)', action: 'Corrected FY2024 EBITDA figure to ₹240 Lakhs', project: 'TechServ Solutions Ltd', category: 'financial_correction' },
  { id: 'log-2', timestamp: '2026-03-09T10:15:00Z', actor: 'Rajesh Malhotra (Merchant Banker)', action: 'Certified & locked Capital Structure section', project: 'TechServ Solutions Ltd', category: 'section_approved' },
  { id: 'log-3', timestamp: '2026-03-09T09:30:00Z', actor: 'AI Drafting Engine (LangGraph)', action: 'Generated section draft: Management Discussion & Analysis', project: 'Apex Healthcare Ltd', category: 'ai_draft' },
  { id: 'log-4', timestamp: '2026-03-09T08:50:00Z', actor: 'Vedant Karne (Founder)', action: 'Uploaded Audited Balance Sheet PDF (FY2022-24)', project: 'TechServ Solutions Ltd', category: 'document_upload' },
  { id: 'log-5', timestamp: '2026-03-08T16:20:00Z', actor: 'Ananya Roy (Legal Advisor)', action: 'Flagged KMP litigation disclosure note in Risk Factors', project: 'Apex Healthcare Ltd', category: 'legal_review' },
];

export const fetchAdminUsers = async () => {
  try {
    const res = await authedFetch(`${API}/api/admin/users`);
    if (res.ok) {
      const data = await res.json();
      if (data.users && data.users.length > 0) return data.users;
    }
  } catch (e) {
    console.warn('Admin users fetch error, using fallback mock users:', e);
  }
  return FALLBACK_USERS;
};

export const createAdminUserApi = async (userData) => {
  try {
    const res = await authedFetch(`${API}/api/admin/users`, {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Create user API error:', e);
  }
  return { id: 'usr-' + Date.now(), ...userData, is_active: true };
};

export const updateAdminUserApi = async (userId, updateData) => {
  try {
    const res = await authedFetch(`${API}/api/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Update user API error:', e);
  }
  return { id: userId, ...updateData };
};

export const deleteAdminUserApi = async (userId) => {
  try {
    const res = await authedFetch(`${API}/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('Delete user API error:', e);
  }
  return { success: true };
};

export const fetchAdminProjects = async () => {
  try {
    const res = await authedFetch(`${API}/api/admin/projects`);
    if (res.ok) {
      const data = await res.json();
      if (data.projects && data.projects.length > 0) return data.projects;
    }
  } catch (e) {
    console.warn('Admin projects fetch error, using fallback mock projects:', e);
  }
  return FALLBACK_PROJECTS;
};

export const fetchAdminAuditLogs = async () => {
  try {
    const res = await authedFetch(`${API}/api/admin/audit-logs`);
    if (res.ok) {
      const data = await res.json();
      if (data.audit_logs && data.audit_logs.length > 0) return data.audit_logs;
    }
  } catch (e) {
    console.warn('Admin audit logs fetch error, using fallback mock audit logs:', e);
  }
  return FALLBACK_AUDIT_LOGS;
};
