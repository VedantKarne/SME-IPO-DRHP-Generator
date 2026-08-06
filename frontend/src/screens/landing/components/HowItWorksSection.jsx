import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { FileUp, Network, Sparkles, ShieldCheck, Download } from 'lucide-react';

const STEPS = [
  { index: '01', title: 'Ingest',       desc: 'Structure raw filings, sheets, and board resolution records.',             icon: FileUp     },
  { index: '02', title: 'Graph',        desc: 'Trace relationships across files into an entity map.',                      icon: Network    },
  { index: '03', title: 'AI Draft',     desc: 'Draft each DRHP block with inline footnotes linked to sources.',            icon: Sparkles   },
  { index: '04', title: 'Human Review', desc: 'Collaborators certify disclosures and apply stamps.',                       icon: ShieldCheck},
  { index: '05', title: 'Export',       desc: 'Generate SEBI-compliant DRHP with audit records intact.',                  icon: Download   },
];

export default function HowItWorksSection() {
  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  });

  const scaleX = useTransform(scrollYProgress, [0.1, 0.9], [0, 1]);

  return (
    <section id="how-it-works" ref={containerRef} className="border-t border-[#DEDAD0]">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-16 sm:py-24">

        {/* Heading */}
        <div className="mb-14 text-center">
          <h2 className="font-sans text-3xl font-bold text-[#1C1B19] mb-3 tracking-tight">
            The SME DRHP Drafting Pipeline
          </h2>
          <p className="font-sans text-sm text-[#5C5A54] max-w-[60ch] mx-auto leading-relaxed">
            Nirmaan AI replaces chaotic coordination with a structured, step-by-step assembly line.
          </p>
        </div>

        {/* Pipeline Track */}
        <div className="relative">
          {/* Track lines — positioned behind the icons row */}
          {/* Hidden on mobile, visible sm+ where grid is 5-col */}
          <div className="hidden sm:block">
            {/* Inactive track */}
            <div className="absolute top-6 left-[10%] right-[10%] h-px bg-[#DEDAD0] z-0" />
            {/* Active tracer */}
            <motion.div
              className="absolute top-6 left-[10%] right-[10%] h-[1.5px] bg-[#8A2E2E] z-10 origin-left"
              style={{ scaleX }}
            />
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-start text-center relative z-20">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.index} className="flex flex-col items-center text-center">
                  {/* Index label */}
                  <span className="font-mono text-[9px] font-bold text-[#9C998F] mb-1.5 block">
                    {step.index}
                  </span>

                  {/* Icon node */}
                  <div className="w-12 h-12 rounded-full border border-[#DEDAD0] flex items-center justify-center mx-auto mb-3 bg-white shadow-sm">
                    <Icon className="w-5 h-5 text-[#5C5A54]" strokeWidth={1.5} />
                  </div>

                  {/* Title */}
                  <h3 className="font-sans font-bold text-sm text-[#1C1B19] mb-1.5">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="font-sans text-xs text-[#5C5A54] leading-relaxed max-w-[140px] mx-auto">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
