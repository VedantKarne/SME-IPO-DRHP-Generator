import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './screens/landing/LandingPage';
import Dashboard from './screens/Dashboard';
import Eligibility from './screens/Eligibility';
import Review from './screens/Review';
import Documents from './screens/Documents';
import KnowledgeBase from './screens/KnowledgeBase';
import Auth from './screens/Auth';
import Onboarding from './screens/Onboarding';
import AppShell from './components/AppShell';
import GlobalSidebar from './components/GlobalSidebar';
import CanvasRoot from './canvas/CanvasRoot';
import ProtectedRoute from './routes/ProtectedRoute';
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
        return;
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
      }
    } catch (e) { console.error('Bootstrap error:', e); }
  };

  const handleAuthSuccess = (isNewRegistration) => {
    bootstrap();
    navigate(isNewRegistration ? '/onboarding' : '/dashboard');
  };

  const handleOnboardingComplete = () => {
    bootstrap();
    navigate('/dashboard');
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
              </Routes>
            </AppShell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
