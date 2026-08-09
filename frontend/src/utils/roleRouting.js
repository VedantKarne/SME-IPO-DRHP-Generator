// Maps the role a user selected on the landing page ("Continue as", see
// screens/landing/config/roleOptions.js) to the route they should land on
// after a successful sign-in or sign-up. Kept separate from Auth.jsx /
// App.jsx's UI so routing decisions live in one place — App.jsx's
// handleAuthSuccess calls getPostLoginRoute(role) rather than hardcoding
// role checks inline.
//
// Only 'finance_ca' has a distinct destination today. Any other role
// (including 'founder', or no role at all — e.g. a user who lands on
// /auth directly without going through the landing page) falls back to
// null, which tells the caller to keep using its existing default routing.
const ROLE_DASHBOARD_ROUTES = {
  finance_ca: '/finance-dashboard',
  admin: '/admin/overview',
};

export function getPostLoginRoute(role) {
  return ROLE_DASHBOARD_ROUTES[role] ?? null;
}
