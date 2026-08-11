/**
 * App.jsx
 *
 * Root application router. Handles authentication bootstrap, session restore,
 * and role-based routing.
 *
 * Role routing works by reading localStorage.getItem('nirmaan_role') after
 * a successful login. This key is set in LoginSection.jsx when the user
 * clicks a role card on the landing page.
 *
 * Roles handled:
 *   'legal_advisor' → /legal/dashboard
 *   'founder' / default → /dashboard (original Founder flow, unchanged)
 */
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './screens/landing/LandingPage';
import Dashboard from './screens/Dashboard';
import Eligibility from './screens/Eligibility';
import Documents from './screens/Documents';
import KnowledgeBase from './screens/KnowledgeBase';
import Reports from './screens/Reports';
import Profile from './screens/Profile';
import Auth from './screens/Auth';
import Onboarding from './screens/Onboarding';
import AppShell from './components/AppShell';
import GlobalSidebar from './components/GlobalSidebar';
import BankerSidebar from './components/BankerSidebar';
import CanvasRoot from './canvas/CanvasRoot';
import ProtectedRoute from './routes/ProtectedRoute';
import BankerOverview from './screens/banker/BankerOverview';
import ReviewQueue from './screens/banker/ReviewQueue';
import Compliance from './screens/banker/Compliance';
import Evidence from './screens/banker/Evidence';
import Approvals from './screens/banker/Approvals';
import Activity from './screens/banker/Activity';
import LegalDashboard from './screens/legal/LegalDashboard';
import LegalDocuments from './screens/legal/LegalDocuments';
import LegalSections from './screens/legal/LegalSections';
import LegalCompliance from './screens/legal/LegalCompliance';
import LegalReviewQueue from './screens/legal/LegalReviewQueue';
import LegalComments from './screens/legal/LegalComments';
import LegalActivity from './screens/legal/LegalActivity';
import FinanceSidebar from './screens/finance/components/FinanceSidebar';
import FinanceDashboard from './screens/finance/FinanceDashboard';
import FinanceDocuments from './screens/finance/FinanceDocuments';
import FinanceFinancialData from './screens/finance/FinanceFinancialData';
import FinanceSections from './screens/finance/FinanceSections';
import FinanceReviewQueuePage from './screens/finance/FinanceReviewQueuePage';
import FinanceEvidence from './screens/finance/FinanceEvidence';
import FinanceComments from './screens/finance/FinanceComments';
import FinanceActivity from './screens/finance/FinanceActivity';
import TeamInvitations from './screens/TeamInvitations';
import UserInvitations from './screens/UserInvitations';
import AdminSidebar from './screens/admin/components/AdminSidebar';
import AdminOverview from './screens/admin/AdminOverview';
import AdminUsers from './screens/admin/AdminUsers';
import AdminRoles from './screens/admin/AdminRoles';
import AdminProjects from './screens/admin/AdminProjects';
import AdminAuditLogs from './screens/admin/AdminAuditLogs';
import AdminMonitoring from './screens/admin/AdminMonitoring';
import AdminRules from './screens/admin/AdminRules';
import UserProfile from './screens/UserProfile';
import './screens/admin/admin.css';
import { getToken, isTokenExpired, decodeToken, authedFetch } from './utils/auth';
import { onSessionUpdate } from './utils/tabSync';
import { getPostLoginRoute } from './utils/roleRouting';

const API = 'http://127.0.0.1:8000';

export default function App() {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('');
  const [sections, setSections] = useState([]);
  const [eligibility, setEligibility] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [consistency, setConsistency] = useState(null);
  const [currentSection, setCurrentSection] = useState('');
  // Was already in the /api/session/restore response but never kept in
  // state (only read transiently in handleAuthSuccess below) — the
  // Finance/CA Documents page needs it too.
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  // Per-project permission level for the current user ('viewer' | 'editor' | 'reviewer' | 'admin').
  // null means promoter/owner (full access). Fetched from /api/user/projects after bootstrap.
  const [projectPermission, setProjectPermission] = useState(null);

  useEffect(() => {
    bootstrap();

    // Listen for tab sync events
    onSessionUpdate((data) => {
      if (data && data.type === 'LOGOUT') {
        navigate('/auth');
      }
      if (data && data.type === 'SECTION_UPDATED') {
        bootstrap(); // Re-fetch session
      }
    });
  }, []);

  // Professional roles that join IPO projects via invitation.
  // New-style accounts have null JWT company_id; old-style have the company they registered with.
  const PROFESSIONAL_ROLES = new Set(['merchant_banker', 'legal_advisor', 'chartered_accountant', 'company_secretary', 'auditor']);

  const bootstrap = async () => {
    try {
      const token = getToken();
      if (!token || isTokenExpired(token)) {
        return null;
      }

      const { company_id: jwt_company_id, company_name: jwt_company_name, role: userRole } = decodeToken(token);
      const isProfessional = PROFESSIONAL_ROLES.has(userRole);

      let active_company_id;
      let active_company_name;

      // JWT company_id is the primary source of truth.
      // It was set at login for a specific company and is always correct.
      // Only for new-style professional accounts (null JWT company_id) do we
      // resolve the project from their invitations/memberships.
      const storedCompanyId = localStorage.getItem('nirmaan_company_id');

      if (!jwt_company_id && isProfessional) {
        // New-style professional: no JWT company_id — resolve from memberships.
        try {
          const projRes = await authedFetch(`${API}/api/user/projects`);
          if (projRes.ok) {
            const projects = await projRes.json();
            // Pick first member project (invited to an IPO project)
            const memberProject = projects.find(p => p.role !== 'Owner/Promoter') || projects[0];
            if (memberProject) {
              active_company_id = memberProject.id;
              active_company_name = memberProject.name;
              localStorage.setItem('nirmaan_company_id', memberProject.id);
              localStorage.setItem('nirmaan_company_name', memberProject.name);
              setProjectPermission(memberProject.permission || null);
            }
          }
        } catch (_) { /* non-fatal — professional with no accepted invitations yet */ }
      } else {
        // JWT has company_id (all promoters, and old-style professionals).
        // Use JWT as source of truth; seed localStorage if empty.
        if (!storedCompanyId && jwt_company_id) {
          localStorage.setItem('nirmaan_company_id', jwt_company_id);
          if (jwt_company_name) localStorage.setItem('nirmaan_company_name', jwt_company_name);
        }
        active_company_id = localStorage.getItem('nirmaan_company_id') || jwt_company_id;
        active_company_name = localStorage.getItem('nirmaan_company_name') || jwt_company_name;

        // Fetch the user's permission level for this project
        if (active_company_id) {
          try {
            const projRes = await authedFetch(`${API}/api/user/projects`);
            if (projRes.ok) {
              const projects = await projRes.json();
              const activeProject = projects.find(p => p.id === active_company_id);
              if (activeProject) setProjectPermission(activeProject.permission || null);
            }
          } catch (_) { /* non-fatal */ }
        }
      }

      setCompanyId(active_company_id || '');
      setCompanyName(active_company_name || '');
      setRole(userRole || '');

      if (!active_company_id) return null;

      const r = await authedFetch(`${API}/api/session/restore?company_id=${active_company_id}`);
      if (r.ok) {
        const data = await r.json();
        setSections(data.sections || []);
        setEligibility(data.eligibility || null);
        setReadiness(data.readiness || null);
        setConsistency(data.consistency || null);
        setUploadedDocuments(data.uploaded_documents || []);
        return data;
      }
    } catch (e) { console.error('Bootstrap error:', e); }
    return null;
  };



  const handleAuthSuccess = async (isNewRegistration, roleArg) => {
    // Roles with their own dashboard (currently just Finance/CA) skip the
    // founder-oriented onboarding/documents flow entirely — see
    // utils/roleRouting.js. Every other role (including no role, e.g. a
    // user who reached /auth directly) keeps the exact existing behavior
    // below, untouched.
    //
    // The JWT's role claim (now persisted server-side, see
    // auth_router.py) is authoritative once the token is set; the role
    // passed in from Auth.jsx is only a same-request fallback for the
    // brief window before that token exists. For every role other than
    // finance_ca the JWT role is 'promoter' (or 'merchant_banker'/'admin'),
    // none of which map to a route below, so this changes nothing for them.
    const token = getToken();
    const jwtRole = token ? decodeToken(token)?.role : null;
    const effectiveRole = jwtRole || roleArg;
    const roleRoute = getPostLoginRoute(effectiveRole);
    if (roleRoute) {
      bootstrap();
      navigate(roleRoute);
      return;
    }

    if (isNewRegistration) {
      bootstrap();
      navigate('/onboarding');
      return;
    }
    // Read role persisted by LoginSection.jsx when the user clicked a role card.
    const savedRole = localStorage.getItem('nirmaan_role');

    // Legal Advisor — route to the legal dashboard (new, isolated route).
    if (savedRole === 'legal_advisor') {
      await bootstrap();
      navigate('/legal/dashboard');
      return;
    }

    // Founder / default — original routing logic, completely unchanged.
    // Returning user - check if they have any uploaded documents.
    // If none, send them to Documents to start the upload flow;
    // otherwise send them straight to Dashboard.
    const data = await bootstrap();
    if (jwtRole === 'merchant_banker') {
      navigate('/banker/overview');
      return;
    }
    const hasDocuments = (data?.uploaded_documents?.length ?? 0) > 0;
    navigate(hasDocuments ? '/dashboard' : '/documents');
  };


  const handleOnboardingComplete = () => {
    bootstrap();
    // The Dashboard's readiness/eligibility data is only meaningful once
    // documents are on file, so a freshly onboarded (real) company lands on
    // Documents first — see the first-upload banner there.
    navigate('/documents');
  };

  const approvedCount = sections.filter(s => s.locked).length;
  const isBanker = role === 'merchant_banker';

  // Determine whether the current user can edit the canvas.
  // Priority order:
  //   1. Promoters / owners always have full access (no projectPermission record).
  //   2. Merchant bankers with 'editor' or 'admin' project permission can edit.
  //   3. Any member explicitly granted 'editor' or 'admin' permission can edit.
  //   4. 'viewer' and 'reviewer' are read-only.
  const EDIT_PERMISSIONS = new Set(['editor', 'admin']);
  const canEdit =
    role === 'promoter' ||
    (isBanker && (!projectPermission || EDIT_PERMISSIONS.has(projectPermission))) ||
    (!isBanker && EDIT_PERMISSIONS.has(projectPermission));

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<Auth onAuthSuccess={handleAuthSuccess} />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding onComplete={handleOnboardingComplete} />
          </ProtectedRoute>
        }
      />

      {/* ── Legal Advisor routes — isolated under /legal/* ─────────────────────
           GlobalSidebar receives role="legal_advisor" so it renders NAV_LEGAL.
           AppShell provides the main content area (no copilot for this role).
           All 7 sub-pages shipped in Phase 2. Do NOT add non-legal routes here. */}
      <Route
        path="/legal/*"
        element={
          <ProtectedRoute>
            <GlobalSidebar companyName={companyName} approvedCount={0} role="legal_advisor" />
            <AppShell companyId={companyId} currentSection="" noCopilot>
              <Routes>
                <Route path="/" element={<Navigate to="/legal/dashboard" replace />} />
                <Route path="/dashboard" element={<LegalDashboard />} />
                <Route path="/documents" element={<LegalDocuments />} />
                <Route path="/drhp" element={<LegalSections />} />
                <Route path="/compliance" element={<LegalCompliance />} />
                <Route path="/review" element={<LegalReviewQueue />} />
                <Route path="/comments" element={<LegalComments />} />
                <Route path="/activity" element={<LegalActivity />} />
                <Route path="/invitations" element={<UserInvitations />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace"
        element={
          <ProtectedRoute>
            {isBanker
              ? <BankerSidebar companyName={companyName} sections={sections} />
              : <GlobalSidebar companyName={companyName} approvedCount={approvedCount} />}
            <CanvasRoot
              companyId={companyId}
              companyName={companyName}
              sections={sections}
              readOnly={!canEdit}

              role={role}
              eligibility={eligibility}
              consistency={consistency}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <div className="admin-shell-container">
              <AdminSidebar />
              <main className="admin-shell-main">
                <header className="admin-header">
                  <div className="admin-header-title">System Admin Console</div>
                  <div className="admin-header-status">
                    <span className="admin-status-dot"></span>
                    <span>System Operational</span>
                  </div>
                </header>
                <Routes>
                  <Route path="/" element={<Navigate to="/admin/overview" replace />} />
                  <Route path="/overview" element={<AdminOverview />} />
                  <Route path="/users" element={<AdminUsers />} />
                  <Route path="/roles" element={<AdminRoles />} />
                  <Route path="/projects" element={<AdminProjects />} />
                  <Route path="/audit-logs" element={<AdminAuditLogs />} />
                  <Route path="/monitoring" element={<AdminMonitoring />} />
                  <Route path="/rules" element={<AdminRules />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance-dashboard/*"
        element={
          <ProtectedRoute>
            <FinanceSidebar companyName={companyName} />
            <main className="finance-shell-main">
              <Routes>
                <Route
                  path="/"
                  element={
                    <FinanceDashboard
                      companyName={companyName}
                      sections={sections}
                      readiness={readiness}
                      uploadedDocuments={uploadedDocuments}
                    />
                  }
                />
                <Route path="/financial-data" element={<FinanceFinancialData companyId={companyId} />} />
                <Route path="/documents" element={<FinanceDocuments companyId={companyId} />} />
                <Route path="/sections" element={<FinanceSections sections={sections} setSections={setSections} />} />
                <Route path="/evidence" element={<FinanceEvidence />} />
                <Route path="/review-queue" element={<FinanceReviewQueuePage sections={sections} />} />
                <Route path="/comments" element={<FinanceComments />} />
                <Route path="/activity" element={<FinanceActivity />} />
              </Routes>
            </main>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={['promoter', 'merchant_banker', 'legal_advisor', 'finance_ca', 'admin']}>
            <UserProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            {isBanker
              ? <BankerSidebar companyName={companyName} sections={sections} />
              : <GlobalSidebar companyName={companyName} approvedCount={approvedCount} />}
            <AppShell
              companyId={companyId}
              companyName={companyName}
              approvedCount={approvedCount}
              currentSection={currentSection}
            >
              <Routes>
                <Route path="/" element={<Navigate to={isBanker ? '/banker/overview' : '/dashboard'} replace />} />
                <Route path="/documents" element={<Documents readOnly={isBanker} />} />
                <Route path="/knowledge-base" element={<KnowledgeBase />} />
                <Route
                  path="/reports"
                  element={
                    <Reports
                      companyId={companyId}
                      companyName={companyName}
                      sections={sections}
                      eligibility={eligibility}
                      consistency={consistency}
                    />
                  }
                />

                {isBanker ? (
                  <>
                    <Route
                      path="/banker/overview"
                      element={
                        <BankerOverview
                          companyId={companyId}
                          companyName={companyName}
                          sections={sections}
                          readiness={readiness}
                          eligibility={eligibility}
                          consistency={consistency}
                        />
                      }
                    />
                    <Route
                      path="/banker/review-queue"
                      element={<ReviewQueue sections={sections} consistency={consistency} />}
                    />
                    <Route
                      path="/banker/compliance"
                      element={<Compliance eligibility={eligibility} consistency={consistency} />}
                    />
                    <Route
                      path="/banker/evidence"
                      element={<Evidence sections={sections} />}
                    />
                    <Route
                      path="/banker/approvals"
                      element={
                        <Approvals
                          companyId={companyId}
                          companyName={companyName}
                          sections={sections}
                          readiness={readiness}
                        />
                      }
                    />
                    <Route
                      path="/banker/activity"
                      element={<Activity companyId={companyId} />}
                    />
                  </>
                ) : (
                  <>
                    <Route
                      path="/dashboard"
                      element={
                        <Dashboard
                          companyId={companyId}
                          companyName={companyName}
                          sections={sections}
                          readiness={readiness}
                          eligibility={eligibility}
                          consistency={consistency}
                        />
                      }
                    />
                    <Route
                      path="/eligibility"
                      element={<Eligibility eligibility={eligibility} />}
                    />
                    <Route path="/profile" element={<Profile companyName={companyName} />} />
                    <Route path="/team" element={<TeamInvitations />} />
                  </>
                )}

                {/* Available for any role */}
                <Route path="/invitations" element={<UserInvitations />} />

                {/* A role's own sidebar only ever links to its own routes, but a
                    stale bookmark or hand-typed URL for the other role's pages
                    (e.g. a banker opening /dashboard) would otherwise match no
                    Route above and render nothing. */}
                <Route path="*" element={<Navigate to={isBanker ? '/banker/overview' : '/dashboard'} replace />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
