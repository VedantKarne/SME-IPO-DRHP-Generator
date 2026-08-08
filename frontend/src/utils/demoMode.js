/**
 * demoMode.js — "one-click demo access" / "continue with sample data".
 *
 * There is no real backend account behind the demo — it's a frontend-only
 * walkthrough of a fully-populated company (see data/demoSeed.js). Rather
 * than teach every screen and ProtectedRoute a second "is this a demo"
 * branch, a well-formed (but unsigned) JWT-shaped token is stored the same
 * way a real login token is. `decodeToken`/`isTokenExpired`/`getToken` in
 * utils/auth.js only ever read the payload client-side — they never verify
 * the signature — so this passes every existing auth check unchanged. Any
 * *real* backend call made with this token (e.g. Documents/KnowledgeBase,
 * which aren't seeded here) will simply 401, which those screens already
 * handle gracefully.
 */

import { setToken, decodeToken, getToken } from './auth';

export const DEMO_COMPANY_ID = 'demo-nirmaan-001';
export const DEMO_COMPANY_NAME = 'Nirmaan Technologies Limited';

function base64UrlEncode(obj) {
  return btoa(JSON.stringify(obj));
}

function buildDemoToken() {
  const header = { alg: 'none', typ: 'JWT' };
  const payload = {
    sub: 'demo',
    company_id: DEMO_COMPANY_ID,
    company_name: DEMO_COMPANY_NAME,
    // 30 days out — long enough that a demo session doesn't expire mid-walkthrough.
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  };
  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.demo`;
}

/** startDemoMode() — stores the fake token. Idempotent; safe to call more than once. */
export function startDemoMode() {
  setToken(buildDemoToken());
}

/** isDemoMode() — true if the current session token is the demo token. */
export function isDemoMode() {
  const token = getToken();
  if (!token) return false;
  const decoded = decodeToken(token);
  return decoded?.sub === 'demo';
}
