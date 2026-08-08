/**
 * bankerHandoff.js — tracks whether the founder has sent their uploaded
 * documents to the Merchant Banker for drafting.
 *
 * MOCK DATA / PERSISTENCE NOTICE
 * -------------------------------
 * The backend has no "handoff" concept — no endpoint or column models a
 * founder notifying their banker. Kept client-side in localStorage,
 * namespaced per company_id, matching the pattern in companyProfile.js.
 * Replace with a real endpoint (e.g. POST /api/companies/{id}/send-to-banker)
 * once one exists — every read/write goes through the two functions below.
 */

const STORAGE_PREFIX = 'nirmaan_sent_to_banker_';

export function isSentToBanker(companyId) {
  if (!companyId) return false;
  try {
    return localStorage.getItem(STORAGE_PREFIX + companyId) === 'true';
  } catch {
    return false;
  }
}

export function markSentToBanker(companyId) {
  if (!companyId) return;
  try {
    localStorage.setItem(STORAGE_PREFIX + companyId, 'true');
  } catch {
    // ignore — non-critical UI state
  }
}
