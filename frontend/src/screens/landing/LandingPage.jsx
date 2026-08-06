import './landing.css';
import LandingHeader from './components/LandingHeader';
import LandingHero from './components/LandingHero';
import InnovationGrid from './components/InnovationGrid';
import HowItWorksSection from './components/HowItWorksSection';
import SecuritySection from './components/SecuritySection';
import LoginSection from './components/LoginSection';
import LandingFooter from './components/LandingFooter';

export default function LandingPage() {
  return (
    <div className="landing-v2 min-h-screen bg-paper text-ink overflow-x-hidden selection:bg-signal-soft selection:text-signal">
      <LandingHeader />
      <LandingHero />
      <InnovationGrid />
      <HowItWorksSection />
      <SecuritySection />
      <LoginSection />
      <LandingFooter />
    </div>
  );
}
