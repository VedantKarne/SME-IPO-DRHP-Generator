/**
 * permissions.js
 *
 * Centralised role-permission map for the Nirmaan platform.
 *
 * Usage:
 *   import { can, isLegalSection } from '../../utils/permissions';
 *   if (can('legal_advisor', 'approve_legal_section')) { ... }
 *
 * Adding a new role:
 *   1. Add a new Set under PERMISSIONS with the role's allowed actions.
 *   2. No other file needs to change.
 *
 * Adding a new action:
 *   1. Add the action string to the relevant role Set(s).
 *   2. Reference the same string literal in the component guard.
 *
 * RULE: component code must call can() before rendering any gated control.
 * If can() returns false, the control must NOT render at all — not be
 * disabled, not be hidden via CSS — absent from the DOM entirely.
 */

// ---------------------------------------------------------------------------
// Legal section IDs that a Legal Advisor is authorised to act on.
// Used by isLegalSection() to suppress Approve / Request-Changes on
// financial sections and on Merchant-Banker-certified sections.
// ---------------------------------------------------------------------------
export const LEGAL_SECTION_IDS = new Set([
  'risk-factors',
  'legal-proceedings',
  'outstanding-litigation',
  'material-contracts',
  'govt-regulatory',
  'other-disclosures',
]);

// ---------------------------------------------------------------------------
// Role → allowed-actions map.
// Every entry is a Set of action strings. Absence = not permitted.
// ---------------------------------------------------------------------------
const PERMISSIONS = {
  legal_advisor: new Set([
    'view_legal_sections',
    'approve_legal_section',
    'request_changes_legal_section',
    'comment_legal_section',
    'upload_legal_document',
    'view_evidence',
    'view_compliance',
    'view_review_queue',
    'view_comments',
    'view_activity',
    // Explicitly absent (these must NEVER appear for legal_advisor):
    // 'approve_financial_section'
    // 'finalize_drhp'
    // 'modify_sebi_rules'
    // 'unlock_certified_section'
  ]),

  // Founder and other roles — listed here only as documentation of what they
  // do NOT share with legal_advisor. Their actual permission checks are in
  // their own flows; this file is the single source of truth.
  founder: new Set([
    'view_dashboard',
    'upload_document',
    'edit_section',
    'view_workspace',
  ]),
};

/**
 * Check whether the given role is allowed to perform the given action.
 *
 * @param {string} role   — 'legal_advisor' | 'founder' | …
 * @param {string} action — e.g. 'approve_legal_section'
 * @returns {boolean}
 */
export function can(role, action) {
  return PERMISSIONS[role]?.has(action) ?? false;
}

/**
 * Check whether a section ID is in the Legal Advisor's authorised section
 * list. Call this before rendering Approve / Request-Changes on any section
 * to prevent those controls appearing on financial or other non-legal content.
 *
 * @param {string} sectionId — e.g. 'risk-factors'
 * @returns {boolean}
 */
export function isLegalSection(sectionId) {
  return LEGAL_SECTION_IDS.has(sectionId);
}
