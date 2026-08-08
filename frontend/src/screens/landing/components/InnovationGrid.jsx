import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Network, FileCheck2, ScrollText, UserCheck, Lock } from 'lucide-react';

const FEATURES = [
  {
    icon: Network,
    title: 'Adaptive IPO Knowledge Graph',
    desc: 'Connects financials, filings and disclosures into a single evolving map of your company.',
  },
  {
    icon: FileCheck2,
    title: 'Evidence-Driven Disclosure Intelligence',
    desc: 'Every drafted claim is traceable back to the source document it came from.',
  },
  {
    icon: ScrollText,
    title: 'Regulatory Intelligence Framework',
    desc: 'Draft language is checked against ICDR and SEBI disclosure requirements as you go.',
  },
  {
    icon: UserCheck,
    title: 'Human-Assured Governance',
    desc: 'Founders, bankers and advisors review and sign off before anything is final.',
  },
  {
    icon: Lock,
    title: 'Secure Collaborative Workspace',
    desc: 'One shared workspace for the whole filing team, with a full audit trail.',
  },
];

function ZigzagFeatures() {
  return (
    <div className="relative flex flex-col gap-8 md:gap-12 w-full max-w-4xl mx-auto">
      {FEATURES.map(({ icon: Icon, title, desc }, i) => {
        const rightSide = i % 2 === 1;
        return (
          <motion.div
            key={title}
            initial={{ opacity: 0, x: rightSide ? 32 : -32 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: 'easeOut' }}
            className={`group relative bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md border border-white/10 hover:border-[#C77B70]/50 rounded-xl p-6 sm:p-8 flex flex-col gap-4 transition-all duration-300 shadow-lg hover:shadow-2xl w-full md:w-[58%] ${rightSide
              ? 'md:ml-auto md:text-right md:items-end'
              : 'md:mr-auto md:text-left md:items-start'
              }`}
          >
            <div className="p-3 bg-[#C77B70]/10 border border-[#C77B70]/20 rounded-lg group-hover:scale-105 transition-transform duration-300">
              <Icon size={32} strokeWidth={1.5} className="text-[#C77B70]" />
            </div>
            <div className={`flex flex-col gap-2 ${rightSide ? 'md:items-end text-right' : 'md:items-start text-left'}`}>
              <h3 className="font-sans font-semibold text-lg text-[#FAF8F3] group-hover:text-white transition-colors">
                {title}
              </h3>
              <p className="font-sans text-sm text-[#9C998F] leading-relaxed">
                {desc}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function StaticFeatures() {
  return (
    <section id="features" className="lv-grid-dark bg-[#1C1B19] border-t border-[#DEDAD0]">
      <div className="max-w-5xl mx-auto px-6 sm:px-8 py-16 sm:py-24">
        <div className="mb-14 text-center">
          <h2 className="font-sans text-3xl font-bold text-[#FAF8F3] mb-3 tracking-tight">
            Built for the filing room, not a chat window
          </h2>
          <p className="font-sans text-sm text-[#9C998F] leading-relaxed max-w-xl mx-auto">
            Every capability exists to make the DRHP more precise, more evidenced, and more
            defensible — not to make the product feel clever.
          </p>
        </div>
        <ZigzagFeatures />
      </div>
    </section>
  );
}

function AnimatedFeatures() {
  const containerRef = useRef(null);

  // Scroll-driven entry grow animation matching CSS view-timeline grow keyframes
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'start 0.15'],
  });

  // Scale: 0.72 -> 1.0 (origin 50% 100%)
  const scale = useTransform(scrollYProgress, [0, 1], [0.72, 1]);
  const borderRadius = useTransform(scrollYProgress, [0, 1], ['36px 36px 0px 0px', '0px 0px 0px 0px']);
  const opacity = useTransform(scrollYProgress, [0, 0.25], [0.3, 1]);

  return (
    <section id="features" ref={containerRef} className="relative bg-paper pt-12 overflow-hidden">
      <motion.div
        style={{
          scale,
          borderRadius,
          opacity,
          transformOrigin: '50% 100%',
        }}
        className="lv-grid-dark bg-[#1C1B19] text-[#FAF8F3] w-full px-6 sm:px-12 py-16 sm:py-24 border-t border-[#3A3833] flex flex-col items-center shadow-2xl"
      >
        <div className="max-w-4xl mx-auto text-center mb-14">
          <div className="inline-block px-3 py-1 bg-[#2C2A26] border border-[#8A2E2E]/40 text-[#C77B70] font-sans font-bold text-xs uppercase tracking-widest rounded-sm mb-4">
            CAPABILITIES & GOVERNANCE
          </div>
          <h2 className="font-sans text-3xl sm:text-4xl md:text-5xl font-bold text-[#FAF8F3] mb-4 tracking-tight leading-tight">
            Built for the filing room, not a chat window
          </h2>
          <p className="font-sans text-sm md:text-base text-[#9C998F] leading-relaxed max-w-xl mx-auto">
            Every capability exists to make the DRHP more precise, more evidenced, and more defensible — not to make the product feel clever.
          </p>
        </div>

        <div className="max-w-5xl mx-auto w-full">
          <ZigzagFeatures />
        </div>
      </motion.div>
    </section>
  );
}

export default function InnovationGrid() {
  const [skipAnimation, setSkipAnimation] = useState(true);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sizeQuery = window.matchMedia('(max-width: 900px)');
    const update = () => setSkipAnimation(motionQuery.matches || sizeQuery.matches);
    update();
    motionQuery.addEventListener('change', update);
    sizeQuery.addEventListener('change', update);
    return () => {
      motionQuery.removeEventListener('change', update);
      sizeQuery.removeEventListener('change', update);
    };
  }, []);

  return skipAnimation ? <StaticFeatures /> : <AnimatedFeatures />;
}
