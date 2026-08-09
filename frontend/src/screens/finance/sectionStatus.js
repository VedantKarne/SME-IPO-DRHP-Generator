// Derives a Finance/CA-facing review status for a DRHP section (as
// returned by GET /api/sections/{company_id}), so the Dashboard summary,
// Review Queue, and DRHP Sections pages never disagree about what
// "verified" / "pending" / "not reviewed" / "has issues" means for the
// same section.
export function deriveReviewStatus(section) {
  if (section.locked || section.status === 'finance_verified') return 'verified';
  if ((section.flagged_gaps || []).length > 0) return 'issues';
  if (section.draft_text) return 'pending';
  return 'not_reviewed';
}
