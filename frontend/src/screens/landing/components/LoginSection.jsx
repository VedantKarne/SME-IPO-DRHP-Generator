import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Briefcase } from 'lucide-react';
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
    navigate('/auth');
  };

  const handleBankerClick = () => {
    // TODO(Backend): CompanyUser.role already models 'merchant_banker' (see
    // src/extraction/schema.py), but no banker-facing dashboard or review
    // flow exists yet. Wire this to a real route once that flow ships —
    // do not fake a redirect in the meantime.
    setToast('Merchant Banker workspace is coming soon.');
  };

  return (
    <section id="login" className="lv-grid-light bg-[#F1EEE6] border-t border-[#DEDAD0]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-24">
        <h2 className="font-sans text-3xl font-bold text-[#1C1B19] mb-3 tracking-tight">
          Continue as
        </h2>
        <p className="font-sans text-sm text-[#5C5A54] mb-10">
          Select your role to enter the workspace.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
          <button
            type="button"
            onClick={handleFounderClick}
            className="text-left bg-white border border-[#DEDAD0] rounded-sm p-6 flex flex-col items-start gap-3 cursor-pointer transition-colors duration-150 hover:border-[#8A2E2E] hover:bg-[#F4E7E5]"
          >
            <Building2 size={24} strokeWidth={1.5} className="text-[#8A2E2E]" />
            <span className="font-sans font-semibold text-base text-[#1C1B19]">Founder / Promoter</span>
            <p className="font-sans text-sm text-[#5C5A54] leading-relaxed">
              Start your company's IPO workspace and prepare your DRHP draft.
            </p>
          </button>

          <button
            type="button"
            onClick={handleBankerClick}
            className="text-left bg-white border border-[#DEDAD0] rounded-sm p-6 flex flex-col items-start gap-3 cursor-pointer transition-colors duration-150 hover:border-[#8A2E2E] hover:bg-[#F4E7E5]"
          >
            <Briefcase size={24} strokeWidth={1.5} className="text-[#8A2E2E]" />
            <span className="font-sans font-semibold text-base text-[#1C1B19]">Merchant Banker</span>
            <p className="font-sans text-sm text-[#5C5A54] leading-relaxed">
              Review and sign off on a company's disclosure draft.
            </p>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 12, x: '-50%' }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed left-1/2 bottom-8 bg-[#1C1B19] text-[#FAF8F3] font-sans text-sm px-5 py-3 rounded-sm z-50 whitespace-nowrap"
            role="status"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
