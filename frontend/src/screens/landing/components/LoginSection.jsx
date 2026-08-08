/**
 * LoginSection.jsx
 *
 * Role-selection section on the landing page. Shows one card per role;
 * clicking a card persists the chosen role to localStorage (key:
 * "nirmaan_role") so App.jsx can route to the correct dashboard after
 * authentication completes.
 *
 * Roles:
 *   - Founder / Promoter  → navigates to /auth (existing flow)
 *   - Legal Advisor       → persists role, navigates to /auth
 *   - Merchant Banker     → coming soon (shows toast, unchanged)
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Briefcase, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function LoginSection() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const handleFounderClick = () => {
    // Persist role so App.jsx routes to the Founder dashboard post-auth
    localStorage.setItem('nirmaan_role', 'founder');
    navigate('/auth');
  };

  const handleLegalAdvisorClick = () => {
    // Persist role so App.jsx routes to /legal/dashboard post-auth
    localStorage.setItem('nirmaan_role', 'legal_advisor');
    navigate('/auth');
  };

  const handleBankerClick = () => {
    // Persist role so App.jsx routes to /banker/overview post-auth
    localStorage.setItem('nirmaan_role', 'merchant_banker');
    navigate('/auth');
  };

  return (
    <section id="login" className="lv-grid-light bg-[#F1EEE6] border-t border-[#DEDAD0]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-24 text-center flex flex-col items-center">
        <h2 className="font-sans text-3xl font-bold text-[#1C1B19] mb-3 tracking-tight">
          Continue as
        </h2>
        <p className="font-sans text-sm text-[#5C5A54] mb-10">
          Select your role to enter the workspace.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl w-full mx-auto">
          <button
            type="button"
            id="role-select-founder"
            onClick={handleFounderClick}
            className="text-center bg-white border border-[#DEDAD0] rounded-sm p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors duration-150 hover:border-[#8A2E2E] hover:bg-[#F1EEE6]"
          >
            <Building2 size={24} strokeWidth={1.5} className="text-[#8A2E2E]" />
            <span className="font-sans font-semibold text-base text-[#1C1B19]">Founder / Promoter</span>
            <p className="font-sans text-sm text-[#5C5A54] leading-relaxed">
              Start your company's IPO workspace and prepare your DRHP draft.
            </p>
          </button>

          {/* Legal Advisor role card — routes to /legal/dashboard after auth */}
          <button
            type="button"
            id="role-select-legal-advisor"
            onClick={handleLegalAdvisorClick}
            className="text-center bg-white border border-[#DEDAD0] rounded-sm p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors duration-150 hover:border-[#8A2E2E] hover:bg-[#F1EEE6]"
          >
            <Scale size={24} strokeWidth={1.5} className="text-[#8A2E2E]" />
            <span className="font-sans font-semibold text-base text-[#1C1B19]">Legal Advisor</span>
            <p className="font-sans text-sm text-[#5C5A54] leading-relaxed">
              Review legal disclosures, litigation matters, and compliance sections.
            </p>
          </button>

          {/* Merchant Banker — coming soon, behavior unchanged */}
          <button
            type="button"
            id="role-select-merchant-banker"
            onClick={handleBankerClick}
            className="text-center bg-white border border-[#DEDAD0] rounded-sm p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors duration-150 hover:border-[#8A2E2E] hover:bg-[#F1EEE6]"
          >
            <Briefcase size={24} strokeWidth={1.5} className="text-[#8A2E2E]" />
            <span className="font-sans font-semibold text-base text-[#1C1B19]">Merchant Banker</span>
            <p className="font-sans text-sm text-[#5C5A54] leading-relaxed">
              Review and sign off on a company's disclosure draft.
            </p>
          </button>
        </div>
      </div>
    </section>
  );
}
