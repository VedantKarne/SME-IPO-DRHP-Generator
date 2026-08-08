import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './screens/landing/LandingPage';
import Dashboard from './screens/Dashboard';
import Eligibility from './screens/Eligibility';
import Documents from './screens/Documents';
import KnowledgeBase from './screens/KnowledgeBase';
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
import { getToken, isTokenExpired, decodeToken, authedFetch } from './utils/auth';
import { onSessionUpdate } from './utils/tabSync';

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

      const { company_id, company_name, role: userRole } = decodeToken(token);
      setCompanyId(company_id);
      setCompanyName(company_name);
      setRole(userRole || '');

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
    // Returning user — check role first: a banker always lands on their own
    // Overview, regardless of document state (that's a founder-only concept).
    const data = await bootstrap();
    const token = getToken();
    const userRole = token ? decodeToken(token)?.role : null;
    if (userRole === 'merchant_banker') {
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
              readOnly={!isBanker}
              role={role}
              eligibility={eligibility}
              consistency={consistency}
            />
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
                  </>
                )}

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
