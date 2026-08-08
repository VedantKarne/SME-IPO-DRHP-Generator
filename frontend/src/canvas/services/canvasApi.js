/**
 * canvasApi.js — All API service functions for the AI Authoring Canvas.
 *
 * Every function calls the real backend through `authedFetch` (which attaches the
 * JWT bearer token) and THROWS an ApiError on failure. There are no mock or
 * fallback responses: a failure must be visible to the user, never papered over
 * with fabricated content.
 *
 * This is a deliberate reversal of the original design, which returned canned
 * "demo mode" text on any non-2xx response. Because this module previously sent
 * no Authorization header, every auth-guarded endpoint returned 401 and the
 * fallback became the default path — the Canvas silently served fabricated DRHP
 * prose and invented confidence scores as if they were genuine model output.
 *
 * Call sites are responsible for catching ApiError and rendering an error state.
 */

import { authedFetch, getToken, isTokenExpired } from '../../utils/auth';

export const API_BASE = 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Error thrown by every function in this module when a request does not succeed.
 * Carries enough structure for call sites to distinguish "log back in" from
 * "the server is down" from "that section is locked".
 */
export class ApiError extends Error {
  constructor(message, { status = 0, kind = 'server', detail = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    /** @type {'auth'|'offline'|'forbidden'|'notfound'|'server'} */
    this.kind = kind;
    this.detail = detail;
  }
}

const KIND_BY_STATUS = {
  401: 'auth',
  403: 'forbidden',
  404: 'notfound',
};

const MESSAGE_BY_KIND = {
  auth: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to perform this action.',
  notfound: 'The requested content was not found.',
  offline: 'Cannot reach the backend. Check that the server is running.',
  server: 'The server could not complete this request.',
};

/**
 * Turn a non-2xx Response into an ApiError, pulling FastAPI's `detail` when present.
 */
async function toApiError(res) {
  const kind = KIND_BY_STATUS[res.status] ?? 'server';
  let detail = '';
  try {
    const body = await res.json();
    detail = typeof body?.detail === 'string' ? body.detail : '';
  } catch {
    // Non-JSON error body — the status alone is what we have.
  }
  // Auth and forbidden errors must always show the user-friendly message — the
  // raw backend detail ("Invalid token", "Not authenticated", etc.) is an
  // implementation detail that is meaningless to the user.
  const message = (kind === 'auth' || (kind === 'forbidden' && !detail))
    ? MESSAGE_BY_KIND[kind]
    : (detail || MESSAGE_BY_KIND[kind]);
  return new ApiError(message, {
    status: res.status,
    kind,
    detail,
  });
}

/**
 * Single choke point for every backend call in the Canvas.
 *
 * Fails fast on a missing/expired token rather than making a round trip that is
 * guaranteed to 401, and normalises network failures into ApiError so call sites
 * only ever handle one error type.
 *
 * @param {string} path        Path beginning with '/'
 * @param {RequestInit} opts
 * @param {'json'|'blob'} parse
 */
async function request(path, opts = {}, parse = 'json') {
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    throw new ApiError(MESSAGE_BY_KIND.auth, { status: 401, kind: 'auth' });
  }

  let res;
  try {
    res = await authedFetch(`${API_BASE}${path}`, opts);
  } catch (cause) {
    // fetch() rejects only on network-level failure (server down, DNS, CORS).
    throw new ApiError(MESSAGE_BY_KIND.offline, {
      kind: 'offline',
      detail: cause?.message ?? '',
    });
  }

  if (!res.ok) throw await toApiError(res);
  return parse === 'blob' ? res.blob() : res.json();
}

const jsonBody = (payload) => ({
  method: 'POST',
  body: JSON.stringify(payload),
});

// ---------------------------------------------------------------------------
// Canonical section list
// ---------------------------------------------------------------------------

/**
 * All 25 SEBI DRHP section names in canonical order.
 *
 * This is a genuine constant, not mock data — it is the section taxonomy the
 * backend also uses (`SECTIONS_25` in src/api/server.py). It is exported for
 * navigation/ordering only and must never be used to fabricate section content.
 *
 * NOTE: this list diverges from the structure of real SEBI filings (it omits
 * chapters present in 19/19 precedent DRHPs, such as Definitions and
 * Abbreviations and Financial Indebtedness). Realigning it is planned work;
 * until then it stays in sync with the backend constant.
 */
export const SECTIONS_25 = [
  'Cover Page & General Information',
  'Risk Factors',
  'Introduction',
  'General Information',
  'Capital Structure',
  'Objects of the Offer',
  'Basis of Issue Price',
  'Statement of Tax Benefits',
  'About the Company',
  'Industry Overview',
  'Our Business',
  'Key Industry Regulations',
  'History and Corporate Structure',
  'Management & Board of Directors',
  'Key Managerial Personnel (KMP)',
  'Our Promoters & Promoter Group',
  'Related Party Transactions',
  'Dividend Policy',
  'Financial Statements (3 Years)',
  'Management Discussion & Analysis',
  'Corporate Governance',
  'Terms of the Issue',
  'Other Regulatory & Statutory Disclosures',
  // Present in 14/20 real SEBI filings; added to match the backend SECTIONS_25.
  'Outstanding Litigation and Material Developments',
  'Material Contracts & Documents',
  'Declaration & Undertakings',
];

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/**
 * Fetch the list of DRHP sections for a company.
 *
 * @param {string} companyId
 * @returns {Promise<Array>}
 * @throws {ApiError}
 */
export async function getSections(companyId) {
  return request(`/api/sections/${encodeURIComponent(companyId)}`);
}

// ---------------------------------------------------------------------------
// AI editing
// ---------------------------------------------------------------------------

/**
 * Ask the AI to rewrite a selected passage with a given action.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} selectedText
 * @param {string} action  One of: rewrite | expand | simplify | professional | investor_friendly | custom
 * @param {string} [customInstruction]  Free-form instruction, used when action is 'custom'
 * @returns {Promise<{ proposed_text: string }>}
 * @throws {ApiError}
 */
export async function rewrite(companyId, sectionName, selectedText, action, customInstruction) {
  return request(
    '/api/canvas/rewrite',
    jsonBody({
      company_id: companyId,
      section_name: sectionName,
      selected_text: selectedText,
      action,
      ...(customInstruction ? { custom_instruction: customInstruction } : {}),
    })
  );
}

/**
 * Apply an AI instruction to the entire section text.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} promptText
 * @param {string} fullText  Current editor plain text (editor.getText())
 * @returns {Promise<{ proposed_text: string }>}
 * @throws {ApiError}
 */
export async function prompt(companyId, sectionName, promptText, fullText) {
  return request(
    '/api/canvas/prompt',
    jsonBody({
      company_id: companyId,
      section_name: sectionName,
      prompt: promptText,
      full_text: fullText,
    })
  );
}

/**
 * Execute an inline AI command at the cursor position.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} instruction  The instruction typed in the palette
 * @param {string} contextText  The paragraph text surrounding the cursor
 * @returns {Promise<{ proposed_text: string }>}
 * @throws {ApiError}
 */
export async function inlineAI(companyId, sectionName, instruction, contextText) {
  return request(
    '/api/canvas/inline-ai',
    jsonBody({
      company_id: companyId,
      section_name: sectionName,
      instruction,
      context_text: contextText,
    })
  );
}

/**
 * Send a question to the section-scoped AI Side Chat.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} question
 * @param {string} [context]  Current editor plaintext, so the answer is grounded in the draft
 * @returns {Promise<{ answer: string }>}
 * @throws {ApiError}
 */
export async function copilotAsk(companyId, sectionName, question, context) {
  return request(
    '/api/copilot/ask',
    jsonBody({
      company_id: companyId,
      current_section: sectionName,
      question,
      ...(context ? { context } : {}),
    })
  );
}

/**
 * Trigger the full LangGraph pipeline to generate a draft for a specific section.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @returns {Promise<{ draft_text: string, section_id: string, completeness_score: number, gap_count: number }>}
 * @throws {ApiError}
 */
export async function generateSection(companyId, sectionName) {
  return request(
    '/api/agent/run',
    jsonBody({
      company_id: companyId,
      section_name: sectionName,
    })
  );
}

/**
 * Trigger the full LangGraph pipeline and stream the result using SSE.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {function} onEvent Callback for each event (type, payload)
 */
export async function generateSectionStream(companyId, sectionName, onEvent) {
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    throw new ApiError('Your session has expired. Please sign in again.', { status: 401, kind: 'auth' });
  }

  const response = await authedFetch(`${API_BASE}/api/agent/run`, {
    method: 'POST',
    body: JSON.stringify({ company_id: companyId, section_name: sectionName })
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    
    // Process SSE lines
    let lineEnd = buffer.indexOf('\n\n');
    while (lineEnd !== -1) {
      const chunk = buffer.slice(0, lineEnd);
      buffer = buffer.slice(lineEnd + 2);
      
      if (chunk.startsWith('data: ')) {
        const dataStr = chunk.slice(6);
        try {
          const data = JSON.parse(dataStr);
          if (data.type === 'error') {
            throw new Error(data.content);
          }
          onEvent(data.type, data.content || data.metadata);
        } catch (e) {
          console.error("Error parsing SSE data", e, chunk);
        }
      }
      lineEnd = buffer.indexOf('\n\n');
    }
  }
}

/**
 * Edit a generated section via the section-scoped chat endpoint.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} promptText
 * @returns {Promise<{ new_draft_text: string }>}
 * @throws {ApiError}
 */
export async function chatEditSection(companyId, sectionName, promptText) {
  return request(
    '/api/canvas/chat-edit',
    jsonBody({
      company_id: companyId,
      section_name: sectionName,
      prompt: promptText,
    })
  );
}

// ---------------------------------------------------------------------------
// Evidence & suggestions
// ---------------------------------------------------------------------------

/**
 * Fetch regulatory citation cards for the active section.
 *
 * Returns whatever the retrieval layer actually found — an empty array is a
 * truthful answer meaning "no citations retrieved", and must be rendered as an
 * empty state rather than backfilled with example regulations.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @returns {Promise<Array>}
 * @throws {ApiError}
 */
export async function getEvidence(companyId, sectionName) {
  return request(
    `/api/canvas/evidence/${encodeURIComponent(companyId)}/${encodeURIComponent(sectionName)}`
  );
}

/**
 * Fetch smart suggestions / gap analysis for the active section.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @returns {Promise<Array>}
 * @throws {ApiError}
 */
export async function getSuggestions(companyId, sectionName) {
  return request(
    `/api/canvas/suggestions/${encodeURIComponent(companyId)}/${encodeURIComponent(sectionName)}`
  );
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

/**
 * Upload an image file to the backend and receive a hosted URL.
 *
 * `authedFetch` omits Content-Type for FormData bodies so the browser can set
 * the multipart boundary itself.
 *
 * @param {FormData} formData  Must contain a field named "file" with the image blob
 * @returns {Promise<{ url: string }>}
 * @throws {ApiError}
 */
export async function uploadImage(formData) {
  return request('/api/canvas/upload-image', { method: 'POST', body: formData });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Export a single section as DOCX or PDF.
 *
 * @param {string} companyId
 * @param {string} sectionName
 * @param {string} content     Editor HTML (editor.getHTML())
 * @param {string} fmt         'docx' | 'pdf'
 * @returns {Promise<Blob>}
 * @throws {ApiError}
 */
export async function exportSection(companyId, sectionName, content, fmt) {
  return request(
    `/api/export/section/${encodeURIComponent(fmt)}`,
    jsonBody({
      company_id: companyId,
      section_name: sectionName,
      content,
    }),
    'blob'
  );
}

/**
 * Export the full DRHP document as DOCX or PDF.
 *
 * @param {string} companyId
 * @param {string} fmt  'docx' | 'pdf'
 * @returns {Promise<Blob>}
 * @throws {ApiError}
 */
export async function exportFull(companyId, fmt) {
  return request(
    `/api/export/full/${encodeURIComponent(fmt)}`,
    jsonBody({ company_id: companyId }),
    'blob'
  );
}

// ---------------------------------------------------------------------------
// Human-in-the-loop review
// ---------------------------------------------------------------------------

/**
 * Fetch the pending HITL interrupt payload for a section.
 *
 * The backend pauses the LangGraph run at `hitl_review_interrupt` when a draft
 * scores below threshold. These endpoints have existed since Phase 9 with no
 * caller anywhere in the frontend, so the pause was never surfaced to anyone.
 *
 * @param {string} sectionId  GeneratedSection UUID (not the section name)
 * @returns {Promise<{status: string, payload?: object}>}
 *   status is one of: pending_review | completed_or_not_paused | no_interrupts_found
 * @throws {ApiError}
 */
export async function getHitlPending(sectionId) {
  return request(`/api/hitl/pending/${encodeURIComponent(sectionId)}`);
}

/**
 * Resume a paused review with the human's decision.
 *
 * @param {string} sectionId
 * @param {'approve'|'revise'|'reject'} action
 * @param {string} [feedback]  Required in practice for 'revise'
 * @throws {ApiError}
 */
export async function submitHitlFeedback(sectionId, action, feedback) {
  return request(
    `/api/hitl/submit/${encodeURIComponent(sectionId)}`,
    jsonBody({ action, feedback: feedback || null })
  );
}

// ---------------------------------------------------------------------------
// Version History
// ---------------------------------------------------------------------------

/**
 * @param {string} companyId
 * @param {string} sectionName
 * @returns {Promise<Array>}
 * @throws {ApiError}
 */
export async function getVersions(companyId, sectionName) {
  return request(
    `/api/sections/${encodeURIComponent(companyId)}/${encodeURIComponent(sectionName)}/versions`
  );
}

/**
 * @param {string} companyId
 * @param {string} sectionName
 * @param {{ label: string, source: string, content: object, authorLabel: string }} entry
 * @throws {ApiError}
 */
export async function saveVersion(companyId, sectionName, entry) {
  return request(
    `/api/sections/${encodeURIComponent(companyId)}/${encodeURIComponent(sectionName)}/versions`,
    jsonBody({
      label: entry.label,
      source: entry.source,
      content: entry.content,
      author_label: entry.authorLabel,
    })
  );
}

// ---------------------------------------------------------------------------
// Merchant Banker review — src/api/locking_router.py (mounted at /api/sections)
// ---------------------------------------------------------------------------

/**
 * Reviewer notes left on a section (comment thread). Stored as ChatMessage
 * rows with role='reviewer' — there is no separate comments table.
 *
 * @param {string} sectionId  GeneratedSection.id (a section's real DB row id,
 *                             not its name — read it off the section object
 *                             the sections list already returns as `id`)
 * @returns {Promise<{ section_id: string, status: string, notes: Array }>}
 * @throws {ApiError}
 */
export async function getSectionReviewNotes(sectionId) {
  return request(`/api/sections/${encodeURIComponent(sectionId)}/review`);
}

/**
 * Leave a reviewer note, optionally requesting changes (sets the section's
 * status to 'revision_requested'). There is no assignee/priority field in
 * the backend — only `note` and `request_changes` are persisted.
 *
 * @param {string} sectionId
 * @param {string} note
 * @param {boolean} [requestChanges=false]
 * @throws {ApiError}
 */
export async function postSectionReview(sectionId, note, requestChanges = false) {
  return request(
    `/api/sections/${encodeURIComponent(sectionId)}/review`,
    jsonBody({ note, request_changes: requestChanges })
  );
}

/**
 * Approve and lock a section. Sets is_locked=true, status='intermediary_certified',
 * and writes an AuditLog row. Irreversible from the UI — there is no unlock endpoint.
 *
 * @param {string} sectionId
 * @throws {ApiError}
 */
export async function approveSection(sectionId) {
  return request(`/api/sections/${encodeURIComponent(sectionId)}/approve`, jsonBody({}));
}

// ---------------------------------------------------------------------------
// Data dependency / impact map — src/api/impact_router.py
// ---------------------------------------------------------------------------

/**
 * A static, deterministic lookup — not live regulation-change monitoring.
 * Only 4 keys exist server-side: total_issue_size_lakhs, ebitda_lakhs,
 * litigation, registered_office. Unknown keys return an empty list.
 *
 * @param {string} changedField
 * @returns {Promise<{ changed_field: string, affected_sections: string[] }>}
 * @throws {ApiError}
 */
export async function getImpact(changedField) {
  return request(`/api/impact/${encodeURIComponent(changedField)}`);
}

// ---------------------------------------------------------------------------
// Activity & Audit log — GET /api/audit/{company_id} (src/api/server.py)
// ---------------------------------------------------------------------------

/**
 * Real AuditLog rows (generation, approval, review/comment, upload, export),
 * newest first, capped at 200.
 *
 * @param {string} companyId
 * @returns {Promise<Array<{ id, event_type, section_name, query, source_file, timestamp }>>}
 * @throws {ApiError}
 */
export async function getAuditLog(companyId) {
  return request(`/api/audit/${encodeURIComponent(companyId)}`);
}
