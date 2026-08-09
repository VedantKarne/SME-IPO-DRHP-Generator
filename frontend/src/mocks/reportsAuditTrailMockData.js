/**
 * reportsAuditTrailMockData.js
 *
 * MOCK DATA
 * Replace with real events once AuditLog (src/extraction/schema.py) gains an
 * actor/role column. Today it only has event_type/section_name/query/
 * timestamp — no reliable per-row "who did this" beyond a free-text
 * `approved_by=` fragment locking_router.py embeds in `query` for approval
 * events only, not every event type. Real rows are already surfaced
 * (event_type/section_name/timestamp only) in banker/Activity.jsx via
 * canvasApi.getAuditLog() — that stays untouched.
 *
 * Shape is fixed on purpose: { timestamp, actor, role, action } is the
 * agreed cross-team merge format so CA/Legal Advisor approval events can
 * combine into one list here later without rework.
 */

export const mockAuditTrail = [
  { timestamp: '2026-08-05 14:32', actor: 'Vedant Karne', role: 'Merchant Banker', action: "Approved 'Risk Factors' section" },
  { timestamp: '2026-08-05 11:10', actor: 'Founder', role: 'Founder', action: 'Uploaded Annual Report FY23' },
  { timestamp: '2026-08-04 17:05', actor: 'Vedant Karne', role: 'Merchant Banker', action: "Requested changes on 'Capital Structure'" },
  { timestamp: '2026-08-04 09:48', actor: 'Founder', role: 'Founder', action: "Generated draft for 'Our Business'" },
];
