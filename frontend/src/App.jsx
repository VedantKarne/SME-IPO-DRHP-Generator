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
import Review from './screens/Review';
import Documents from './screens/Documents';
import KnowledgeBase from './screens/KnowledgeBase';
import Profile from './screens/Profile';
import Auth from './screens/Auth';
import Onboarding from './screens/Onboarding';
import AppShell from './components/AppShell';
import GlobalSidebar from './components/GlobalSidebar';
import CanvasRoot from './canvas/CanvasRoot';
import ProtectedRoute from './routes/ProtectedRoute';
import LegalDashboard from './screens/legal/LegalDashboard';
import { getToken, isTokenExpired, decodeToken, authedFetch } from './utils/auth';
import { onSessionUpdate } from './utils/tabSync';

const API = 'http://127.0.0.1:8000';

export default function App() {
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [sections, setSections] = useState([]);
  const [eligibility, setEligibility] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [consistency, setConsistency] = useState(null);
  const [currentSection, setCurrentSection] = useState('');

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

  const bootstrap = async () => {
    try {
      const token = getToken();
      if (!token || isTokenExpired(token)) {
        return null;
      }

      const { company_id, company_name } = decodeToken(token);
      setCompanyId(company_id);
      setCompanyName(company_name);

      const r = await authedFetch(`${API}/api/session/restore`);
      if (r.ok) {
        const data = await r.json();
        setSections(data.sections || []);
        setEligibility(data.eligibility || null);
        setReadiness(data.readiness || null);
        setConsistency(data.consistency || null);
        return data;
      }
    } catch (e) { console.error('Bootstrap error:', e); }
    return null;
  };

  const handleAuthSuccess = async (isNewRegistration) => {
    if (isNewRegistration) {
      bootstrap();
      navigate('/onboarding');
      return;
    }
    // Read role persisted by LoginSection.jsx when the user clicked a role card.
    const role = localStorage.getItem('nirmaan_role');

    // Legal Advisor — route to the legal dashboard (new, isolated route).
    if (role === 'legal_advisor') {
      await bootstrap();
      navigate('/legal/dashboard');
      return;
    }

    // Founder / default — original routing logic, completely unchanged.
    // Returning user - check if they have any uploaded documents.
    // If none, send them to Documents to start the upload flow;
    // otherwise send them straight to Dashboard.
    const data = await bootstrap();
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
           Sub-routes are intentionally minimal; more pages ship in Phase 2. */}
      <Route
        path="/legal/*"
        element={
          <ProtectedRoute>
            <GlobalSidebar companyName={companyName} approvedCount={0} role="legal_advisor" />
            <AppShell companyId={companyId} currentSection="" noCopilot>
              <Routes>
                <Route path="/" element={<Navigate to="/legal/dashboard" replace />} />
                <Route path="/dashboard" element={<LegalDashboard />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace"
        element={
          <ProtectedRoute>
            <GlobalSidebar companyName={companyName} approvedCount={approvedCount} />
            <CanvasRoot
              companyId={companyId}
              companyName={companyName}
              sections={sections}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <GlobalSidebar companyName={companyName} approvedCount={approvedCount} />
            <AppShell
              companyId={companyId}
              companyName={companyName}
              approvedCount={approvedCount}
              currentSection={currentSection}
            >
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
                <Route
                  path="/review"
                  element={<Review sections={sections} setSections={setSections} companyId={companyId} />}
                />
                <Route path="/documents" element={<Documents />} />
                <Route path="/knowledge-base" element={<KnowledgeBase />} />
                <Route path="/profile" element={<Profile companyName={companyName} />} />
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
