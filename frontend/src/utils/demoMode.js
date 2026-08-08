/**
 * demoMode.js — detects the backend-seeded demo account (demo@nirmaan.ai),
 * shared by any screen that needs to show data/assets specific to that
 * account (Profile field defaults, Documents checklist sample PDFs, etc.)
 * without affecting real accounts.
 *
 * The company name is the only reliable, synchronous signal available on
 * first render (decoded straight from the JWT) — see Profile.jsx for why
 * this matters more than it sounds like it should.
 */

export const DEMO_COMPANY_NAME = 'Nirmaan Technologies Ltd';

export function isDemoCompany(companyName) {
  return companyName === DEMO_COMPANY_NAME;
}
