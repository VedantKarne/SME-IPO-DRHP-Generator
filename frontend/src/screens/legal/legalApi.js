/**
 * legalApi.js
 *
 * Data-fetching layer for the Legal Advisor pages.
 *
 * Every function first tries the real backend endpoint. If the backend is
 * unavailable or the endpoint does not yet exist, it falls back to mock data
 * from legalMockData.js and logs a console warning.
 *
 * SWAP-IN RULE: when a real endpoint is ready, update only this file.
 * Page components never import from legalMockData.js directly — they always
 * go through legalApi.js so the UI layer remains unchanged.
 *
 * Functions exported:
 *   fetchDashboardSummary()        → { readinessScore, sectionsReviewed, pendingReview, issuesFound }
 *   fetchLegalFlags()              → LegalFlagItem[]
 *   fetchRecentActivity()          → ActivityEntry[]
 *   fetchLegalDraftSections()      → DraftSection[]
 *   fetchLegalSectionReviews(id)   → { notes: ReviewNote[] }
 *   approveLegalSection(id)        → { success, mock? }
 *   submitReview(id, note, reqChg) → { success, mock? }
 *   fetchLegalDocuments()          → LegalDocument[]
 *   uploadLegalDocument(file,meta) → { success, id, filename }
 *   fetchComplianceItems()         → ComplianceItem[]
 *   fetchReviewQueue()             → ReviewQueueItem[]
 *   fetchLegalComments()           → Comment[]
 *   fetchLegalActivity()           → ActivityEntry[]
 */

import { authedFetch } from '../../utils/auth';
import {
  LEGAL_READINESS_SCORE,
  LEGAL_SUMMARY_STATS,
  LEGAL_PRIORITY_ITEMS,
  LEGAL_RECENT_ACTIVITY,
  LEGAL_DRAFT_SECTIONS,
  LEGAL_DOCUMENTS,
  LEGAL_COMPLIANCE_ITEMS,
  LEGAL_REVIEW_QUEUE,
  LEGAL_COMMENTS,
  LEGAL_ACTIVITY_LOG,
} from './legalMockData';

const API_BASE = 'http://127.0.0.1:8000';

// Legal section names as stored in GeneratedSection.section_name.
// Used to filter /api/session/restore response to legal sections only.
const LEGAL_SECTION_KEYWORDS = [
  'risk factor',
  'legal proceeding',
  'outstanding litigation',
  'material contract',
  'government',
  'regulatory matter',
  'other legal',
  'other regulatory',
];

function isLegalSectionName(name) {
  const lower = (name || '').toLowerCase();
  return LEGAL_SECTION_KEYWORDS.some((kw) => lower.includes(kw));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/**
 * Fetch dashboard summary stats.
 * Real: derives from /api/session/restore sections + readiness.legal_readiness
 * Mock: LEGAL_READINESS_SCORE + LEGAL_SUMMARY_STATS
 */
export async function fetchDashboardSummary() {
  try {
    const res = await authedFetch(`${API_BASE}/api/session/restore`);
    if (res.ok) {
      const data = await res.json();
      const sections = (data.sections || []).filter((s) =>
        isLegalSectionName(s.section_name || s.name)
      );
      const withIssues = sections.filter(
        (s) => (s.flagged_gaps || []).length > 0
      ).length;
      const locked = sections.filter((s) => s.is_locked || s.locked).length;
      const pending = sections.filter(
        (s) => !s.is_locked && !s.locked && (s.flagged_gaps || []).length === 0
      ).length;
      const rawScore =
        data.readiness?.legal_readiness ??
        data.readiness?.legal_score ??
        null;
      return {
        readinessScore:  rawScore !== null ? Math.round(rawScore) : LEGAL_READINESS_SCORE,
        sectionsReviewed: `${locked}/${sections.length || 6}`,
        pendingReview:    pending,
        issuesFound:      withIssues,
      };
    }
  } catch (e) {
    console.warn('[legalApi] fetchDashboardSummary → mock:', e.message);
  }
  return {
    readinessScore:   LEGAL_READINESS_SCORE,
    sectionsReviewed: LEGAL_SUMMARY_STATS[0].value,
    pendingReview:    LEGAL_SUMMARY_STATS[1].value,
    issuesFound:      LEGAL_SUMMARY_STATS[2].value,
  };
}

/**
 * Fetch priority flags for the dashboard panel.
 * Real: GET /api/legal/flags — reads GeneratedSection.flagged_gaps
 * Mock: LEGAL_PRIORITY_ITEMS
 */
export async function fetchLegalFlags() {
  try {
    const res = await authedFetch(`${API_BASE}/api/legal/flags`);
    if (res.ok) {
      const data = await res.json();
      const flags = (data.flags || []);
      if (flags.length > 0) {
        return flags.map((f) => ({
          id:     f.section_id,
          label:  f.section_name,
          status: f.status,
          note:   `${f.flag_count} gap${f.flag_count !== 1 ? 's' : ''} flagged by Gap Detection engine.`,
        }));
      }
    }
  } catch (e) {
    console.warn('[legalApi] fetchLegalFlags → mock:', e.message);
  }
  return LEGAL_PRIORITY_ITEMS;
}

/**
 * Fetch recent activity for the dashboard panel (last N entries).
 * Real: GET /api/legal/activity?limit=4 (not yet implemented)
 * Mock: LEGAL_RECENT_ACTIVITY
 */
export async function fetchRecentActivity(limit = 4) {
  // Real endpoint not yet implemented — falls through to mock.
  return LEGAL_RECENT_ACTIVITY.slice(0, limit);
}

// ---------------------------------------------------------------------------
// DRHP Sections
// ---------------------------------------------------------------------------

/**
 * Fetch draft text and metadata for each legal DRHP section.
 * Real: /api/session/restore sections[] filtered by name + /api/legal/flags merged
 * Mock: LEGAL_DRAFT_SECTIONS
 */
export async function fetchLegalDraftSections() {
  try {
    const res = await authedFetch(`${API_BASE}/api/session/restore`);
    if (res.ok) {
      const data = await res.json();
      const sections = (data.sections || []).filter((s) =>
        isLegalSectionName(s.section_name || s.name)
      );
      if (sections.length > 0) {
        return sections.map((s) => ({
          id:             s.id,
          title:          s.section_name || s.name,
          section:        s.section_name || s.name,
          status:         s.status || 'draft',
          lockedByBanker: s.is_locked || s.locked || false,
          approvedBy:     null,
          approvedAt:     null,
          draftText:      s.draft_text || '',
          aiFlags: (s.flagged_gaps || []).map((g, i) => ({
            id:              `flag-${s.id}-${i}`,
            description:     typeof g === 'string' ? g : (g.description || JSON.stringify(g)),
            severity:        g.is_critical ? 'critical' : 'warning',
            engine:          'gap_detector',
            suggestedAction: '',
          })),
          comments:     [],
          evidenceDocs: [],
        }));
      }
    }
  } catch (e) {
    console.warn('[legalApi] fetchLegalDraftSections → mock:', e.message);
  }
  return LEGAL_DRAFT_SECTIONS;
}

/**
 * Fetch legal reviewer notes for a specific section.
 * Real: GET /api/legal/sections/{id}/review
 * Mock: empty notes (comments are in the section's mock data directly)
 */
export async function fetchLegalSectionReviews(sectionId) {
  try {
    const res = await authedFetch(`${API_BASE}/api/legal/sections/${sectionId}/review`);
    if (res.ok) return res.json();
  } catch (e) {
    console.warn('[legalApi] fetchLegalSectionReviews → mock:', e.message);
  }
  return { section_id: sectionId, status: 'draft', notes: [] };
}

// ---------------------------------------------------------------------------
// Section actions
// ---------------------------------------------------------------------------

/**
 * Approve a legal section as Legal Advisor.
 * Real: POST /api/legal/sections/{id}/approve
 * Mock: returns { success: true, mock: true }
 */
export async function approveLegalSection(sectionId) {
  try {
    const res = await authedFetch(
      `${API_BASE}/api/legal/sections/${sectionId}/approve`,
      { method: 'POST' }
    );
    if (res.ok) return { success: true };
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.detail || `HTTP ${res.status}` };
  } catch (e) {
    console.warn('[legalApi] approveLegalSection → mock:', e.message);
  }
  return { success: true, mock: true };
}

/**
 * Submit a comment or change request on a legal section.
 * Real: POST /api/legal/sections/{id}/review
 * Mock: returns { success: true, mock: true }
 *
 * @param {string} sectionId
 * @param {string} note
 * @param {boolean} requestChanges — true = change request, false = comment
 */
export async function submitReview(sectionId, note, requestChanges = false) {
  try {
    const res = await authedFetch(
      `${API_BASE}/api/legal/sections/${sectionId}/review`,
      {
        method: 'POST',
        body:   JSON.stringify({ note, request_changes: requestChanges }),
      }
    );
    if (res.ok) return { success: true };
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.detail || `HTTP ${res.status}` };
  } catch (e) {
    console.warn('[legalApi] submitReview → mock:', e.message);
  }
  return { success: true, mock: true };
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * Fetch legal-category documents.
 * Real: GET /api/legal/documents
 * Mock: LEGAL_DOCUMENTS
 */
export async function fetchLegalDocuments() {
  try {
    const res = await authedFetch(`${API_BASE}/api/legal/documents`);
    if (res.ok) {
      const data = await res.json();
      if ((data.documents || []).length > 0) return data.documents;
    }
  } catch (e) {
    console.warn('[legalApi] fetchLegalDocuments → mock:', e.message);
  }
  return LEGAL_DOCUMENTS;
}

/**
 * Upload a legal document.
 * Real: POST /api/legal/documents/upload (multipart form)
 * Mock: returns a fake success response
 *
 * @param {File} file
 * @param {{ docType: string, supportedSection: string }} meta
 */
export async function uploadLegalDocument(file, meta = {}) {
  try {
    const form = new FormData();
    form.append('file', file);
    form.append('doc_type', meta.docType || 'legal_other');
    form.append('supported_section', meta.supportedSection || '');

    const res = await authedFetch(`${API_BASE}/api/legal/documents/upload`, {
      method: 'POST',
      body:   form,
    });
    if (res.ok) return { success: true, ...(await res.json()) };
    const err = await res.json().catch(() => ({}));
    return { success: false, error: err.detail || `HTTP ${res.status}` };
  } catch (e) {
    console.warn('[legalApi] uploadLegalDocument → mock:', e.message);
  }
  return {
    success:  true,
    mock:     true,
    id:       `doc-mock-${Date.now()}`,
    filename: file.name,
  };
}

// ---------------------------------------------------------------------------
// Compliance
// ---------------------------------------------------------------------------

/**
 * Fetch compliance matrix items for legal-category requirements.
 * Real: Compliance Engine endpoint (not yet implemented) — falls through to mock.
 * Mock: LEGAL_COMPLIANCE_ITEMS
 */
export async function fetchComplianceItems() {
  // Real endpoint not yet implemented.
  return LEGAL_COMPLIANCE_ITEMS;
}

// ---------------------------------------------------------------------------
// Review Queue
// ---------------------------------------------------------------------------

/**
 * Fetch the aggregated legal review queue.
 * Real: Aggregate from /api/legal/flags + /api/legal/documents + compliance matrix.
 * Mock: LEGAL_REVIEW_QUEUE
 */
export async function fetchReviewQueue() {
  // Real aggregation not yet implemented.
  return LEGAL_REVIEW_QUEUE;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

/**
 * Fetch threaded legal comments.
 * Real: /api/legal/sections — retrieve ChatMessage rows with role='legal_reviewer'
 * Mock: LEGAL_COMMENTS
 */
export async function fetchLegalComments() {
  return LEGAL_COMMENTS;
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

/**
 * Fetch the legal activity log.
 * Real: AuditLog filtered to legal event_types (not yet exposed via API)
 * Mock: LEGAL_ACTIVITY_LOG
 */
export async function fetchLegalActivity() {
  return LEGAL_ACTIVITY_LOG;
}
