import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './screens/Landing';
import Dashboard from './screens/Dashboard';
import Workspace from './screens/Workspace';
import Eligibility from './screens/Eligibility';
import Review from './screens/Review';
import Documents from './screens/Documents';
import KnowledgeBase from './screens/KnowledgeBase';
import Auth from './screens/Auth';
import AppShell from './components/AppShell';
import GlobalSidebar from './components/GlobalSidebar';
import CanvasRoot from './canvas/CanvasRoot';
import { getToken, isTokenExpired, decodeToken, authedFetch } from './utils/auth';
import { onSessionUpdate } from './utils/tabSync';

const API = 'http://127.0.0.1:8000';

export default function App() {
  const [showAuth, setShowAuth] = useState(true);
  const [showLanding, setShowLanding] = useState(false);
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
        setShowAuth(true);
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
        setShowAuth(true);
        return;
      }
      
      const { company_id, company_name } = decodeToken(token);
      setCompanyId(company_id);
      setCompanyName(company_name);
      setShowAuth(false);
      
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
    if (isNewRegistration) {
      setShowAuth(false);
      setShowLanding(true); // Show onboarding chat for new users
    } else {
      // Returning user: load dashboard directly
      bootstrap();
    }
  };

  const handleLandingComplete = () => {
    setShowLanding(false);
    bootstrap();
  };

  const approvedCount = sections.filter(s => s.locked).length;

  if (showAuth) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  if (showLanding) {
    return <Landing onComplete={handleLandingComplete} />;
  }

  return (
    <BrowserRouter>
      <GlobalSidebar companyName={companyName} approvedCount={approvedCount} />
      <Routes>
        <Route
          path="/workspace"
          element={
            <CanvasRoot
              companyId={companyId}
              companyName={companyName}
              sections={sections}
            />
          }
        />
        <Route
          path="*"
          element={
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
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
