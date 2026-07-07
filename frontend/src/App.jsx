import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './screens/Landing';
import Dashboard from './screens/Dashboard';
import Workspace from './screens/Workspace';
import Eligibility from './screens/Eligibility';
import Review from './screens/Review';
import Documents from './screens/Documents';
import AppShell from './components/AppShell';

const API = 'http://localhost:8000';

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [sections, setSections] = useState([]);
  const [eligibility, setEligibility] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [currentSection, setCurrentSection] = useState('');

  useEffect(() => { bootstrap(); }, []);

  const bootstrap = async () => {
    try {
      const r = await fetch(`${API}/api/demo/company`);
      if (r.ok) {
        const data = await r.json();
        if (data.company_id) {
          setCompanyId(data.company_id);
          setCompanyName(data.company_name || '');
          await refreshAll(data.company_id);
        }
      }
    } catch (e) { console.error('Bootstrap error:', e); }
  };

  const refreshAll = async (cid) => {
    const id = cid || companyId;
    if (!id) return;
    const [secR, eligR, readR] = await Promise.all([
      fetch(`${API}/api/sections/${id}`),
      fetch(`${API}/api/eligibility/${id}`),
      fetch(`${API}/api/readiness/${id}`)
    ]);
    if (secR.ok) setSections(await secR.json());
    if (eligR.ok) setEligibility(await eligR.json());
    if (readR.ok) setReadiness(await readR.json());
  };

  const handleLandingComplete = () => {
    setShowLanding(false);
    refreshAll(companyId);
  };

  const approvedCount = sections.filter(s => s.locked).length;

  if (showLanding) {
    return <Landing onComplete={handleLandingComplete} />;
  }

  return (
    <BrowserRouter>
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
              />
            }
          />
          <Route
            path="/workspace"
            element={
              <Workspace
                companyId={companyId}
                sections={sections}
                setSections={setSections}
                onCurrentSectionChange={setCurrentSection}
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
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
