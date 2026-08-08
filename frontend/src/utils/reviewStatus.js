/**
 * reviewStatus.js — shared section-status derivation for the Merchant Banker
 * pages (BankerOverview, ReviewQueue, Approvals, BankerSidebar's queue badge).
 *
 * All four states are derived from real GeneratedSection fields already
 * returned by GET /api/sections/{company_id} — `locked` and `status`
 * ('draft' | 'promoter_reviewed' | 'intermediary_certified' | 'revision_requested').
 * No separate "review state" is stored anywhere; this is just one place to
 * name the four buckets consistently instead of re-deriving them per screen.
 */

export function getSectionReviewState(section) {
  if (section.locked) return 'approved';
  if (section.status === 'revision_requested') return 'changes_requested';
  if (section.draft_text) return 'under_review';
  return 'not_started';
}

export function countReviewStatuses(sections = []) {
  const counts = { approved: 0, under_review: 0, changes_requested: 0, not_started: 0 };
  sections.forEach((s) => { counts[getSectionReviewState(s)] += 1; });
  return counts;
}

/** Sections the banker still needs to look at — same definition Review.jsx originally used. */
export function needsReview(section) {
  return !section.locked && !!section.draft_text && section.status !== 'revision_requested';
}
