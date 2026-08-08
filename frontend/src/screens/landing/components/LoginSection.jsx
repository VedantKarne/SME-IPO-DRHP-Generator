import { useNavigate } from 'react-router-dom';
import { Building2, Briefcase } from 'lucide-react';

export default function LoginSection() {
  const navigate = useNavigate();

  return (
    <section id="login" className="lv-grid-light bg-[#F1EEE6] border-t border-[#DEDAD0]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-24 text-center flex flex-col items-center">
        <h2 className="font-sans text-3xl font-bold text-[#1C1B19] mb-3 tracking-tight">
          Continue as
        </h2>
        <p className="font-sans text-sm text-[#5C5A54] mb-10">
          Select your role to enter the workspace.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl w-full mx-auto">
          <button
            type="button"
            onClick={() => navigate('/auth', { state: { role: 'founder' } })}
            className="text-center bg-white border border-[#DEDAD0] rounded-sm p-6 flex flex-col items-center gap-3 cursor-pointer transition-colors duration-150 hover:border-[#8A2E2E] hover:bg-[#F1EEE6]"
          >
            <Building2 size={24} strokeWidth={1.5} className="text-[#8A2E2E]" />
            <span className="font-sans font-semibold text-base text-[#1C1B19]">Founder / Promoter</span>
            <p className="font-sans text-sm text-[#5C5A54] leading-relaxed">
              Start your company's IPO workspace and prepare your DRHP draft.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/auth', { state: { role: 'banker' } })}
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
