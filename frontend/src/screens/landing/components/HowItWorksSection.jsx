import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const STEPS = [
  { index: '01', title: 'Ingest',       desc: 'Structure raw filings, sheets, and board resolution records.' },
  { index: '02', title: 'Graph',        desc: 'Trace relationships across files into an entity map.'          },
  { index: '03', title: 'AI Draft',     desc: 'Draft each DRHP block with inline footnotes linked to sources.'},
  { index: '04', title: 'Human Review', desc: 'Collaborators certify disclosures and apply stamps.'           },
  { index: '05', title: 'Export',       desc: 'Generate SEBI-compliant DRHP with audit records intact.'      },
];

// Node 1: Ingest — Document outline + arrow filling up & moving upward
function IngestIcon({ active }) {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" className={active ? 'stroke-[#8A2E2E]' : 'stroke-[#5C5A54]'} />
      <polyline points="14 2 14 8 20 8" className={active ? 'stroke-[#8A2E2E]' : 'stroke-[#5C5A54]'} />
      <motion.g
        animate={active ? { y: [-3, 0], opacity: 1 } : { y: 3, opacity: 0.4 }}
        transition={{ duration: 0.4, type: 'spring' }}
      >
        <path d="M12 18v-6" className={active ? 'stroke-[#8A2E2E]' : 'stroke-[#5C5A54]'} strokeWidth="2.5" />
        <path d="m9 15 3-3 3 3" className={active ? 'stroke-[#8A2E2E]' : 'stroke-[#5C5A54]'} strokeWidth="2.5" fill={active ? '#8A2E2E' : 'none'} />
      </motion.g>
    </svg>
  );
}

// Node 2: Graph — Network nodes and connecting lines generating in sequence
function GraphIcon({ active }) {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <motion.circle cx="12" cy="5" r="2.5" animate={active ? { scale: [0, 1.25, 1], fill: '#8A2E2E', stroke: '#8A2E2E' } : { scale: 1, stroke: '#5C5A54' }} transition={{ duration: 0.3 }} />
      <motion.circle cx="5" cy="19" r="2.5" animate={active ? { scale: [0, 1.25, 1], fill: '#8A2E2E', stroke: '#8A2E2E' } : { scale: 1, stroke: '#5C5A54' }} transition={{ duration: 0.3, delay: 0.1 }} />
      <motion.circle cx="19" cy="19" r="2.5" animate={active ? { scale: [0, 1.25, 1], fill: '#8A2E2E', stroke: '#8A2E2E' } : { scale: 1, stroke: '#5C5A54' }} transition={{ duration: 0.3, delay: 0.2 }} />
      <motion.path d="M9.5 7.5L6.5 16.5" animate={active ? { pathLength: 1, stroke: '#8A2E2E' } : { pathLength: 0.4, stroke: '#5C5A54' }} transition={{ duration: 0.3 }} />
      <motion.path d="M14.5 7.5l3 9" animate={active ? { pathLength: 1, stroke: '#8A2E2E' } : { pathLength: 0.4, stroke: '#5C5A54' }} transition={{ duration: 0.3, delay: 0.15 }} />
      <motion.path d="M7.5 19h9" animate={active ? { pathLength: 1, stroke: '#8A2E2E' } : { pathLength: 0.4, stroke: '#5C5A54' }} transition={{ duration: 0.3, delay: 0.25 }} />
    </svg>
  );
}

// Node 3: AI Draft — Sparkles icon twinkling & pulsing
function SparklesIcon({ active }) {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <motion.path
        d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"
        animate={active ? { rotate: [0, 15, -15, 0], scale: [1, 1.2, 1], stroke: '#8A2E2E', fill: '#8A2E2E' } : { scale: 1, stroke: '#5C5A54', fill: 'none' }}
        transition={{ duration: 0.6, repeat: active ? Infinity : 0, repeatType: 'reverse' }}
      />
      <motion.path
        d="M5 3v4M3 5h4"
        animate={active ? { opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8], stroke: '#8A2E2E' } : { opacity: 0.4, stroke: '#5C5A54' }}
        transition={{ duration: 0.5, repeat: active ? Infinity : 0 }}
      />
      <motion.path
        d="M19 17v4M17 19h4"
        animate={active ? { opacity: [0.2, 1, 0.2], scale: [0.8, 1.3, 0.8], stroke: '#8A2E2E' } : { opacity: 0.4, stroke: '#5C5A54' }}
        transition={{ duration: 0.5, delay: 0.2, repeat: active ? Infinity : 0 }}
      />
    </svg>
  );
}

// Node 4: Human Review — Shield + checkmark drawing in (Primary Signal Red color)
function HumanReviewIcon({ active }) {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 5 19 5a1 1 0 0 1 1 1z" className={active ? 'stroke-[#8A2E2E]' : 'stroke-[#5C5A54]'} />
      <motion.path
        d="m9 12 2 2 4-4"
        animate={active ? { pathLength: 1, opacity: 1, stroke: '#8A2E2E' } : { pathLength: 0.3, opacity: 0.4, stroke: '#5C5A54' }}
        strokeWidth="2.5"
        transition={{ duration: 0.4 }}
      />
    </svg>
  );
}

// Node 5: Export — Download arrow bouncing & sliding down into place
function ExportIcon({ active }) {
  return (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" className={active ? 'stroke-[#8A2E2E]' : 'stroke-[#5C5A54]'} />
      <motion.g
        animate={active ? { y: [0, 4, 0] } : { y: 0 }}
        transition={{ duration: 0.6, repeat: active ? Infinity : 0, repeatType: 'reverse' }}
      >
        <polyline points="7 10 12 15 17 10" className={active ? 'stroke-[#8A2E2E]' : 'stroke-[#5C5A54]'} strokeWidth="2.5" />
        <line x1="12" x2="12" y1="3" y2="15" className={active ? 'stroke-[#8A2E2E]' : 'stroke-[#5C5A54]'} strokeWidth="2.5" />
      </motion.g>
    </svg>
  );
}

function StepNodeItem({ step, index, scrollYProgress }) {
  const thresholds = [
    [0.05, 0.25],
    [0.22, 0.42],
    [0.40, 0.60],
    [0.58, 0.78],
    [0.75, 0.95],
  ];
  const range = thresholds[index];

  const activeVal = useTransform(scrollYProgress, range, [0, 1]);
  const [active, setActive] = useState(false);

  useEffect(() => {
    return activeVal.on('change', (v) => setActive(v >= 0.5));
  }, [activeVal]);

  return (
    <div className="flex flex-col items-center text-center">
      {/* Index label — Increased bottom margin for clean spacing above icon */}
      <span className={`font-mono text-[10px] font-bold mb-12 block transition-colors duration-300 ${active ? 'text-[#8A2E2E]' : 'text-[#9C998F]'}`}>
        {step.index}
      </span>

      {/* Icon node - Enlarged w-16 h-16 container with increased bottom margin */}
      <motion.div
        animate={active ? { scale: 1.15, borderColor: '#8A2E2E', backgroundColor: '#FAF0F0' } : { scale: 1, borderColor: '#DEDAD0', backgroundColor: '#FFFFFF' }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="w-16 h-16 rounded-full border-2 flex items-center justify-center mx-auto mb-6 sm:mb-8 shadow-sm relative z-20 cursor-pointer"
      >
        {index === 0 && <IngestIcon active={active} />}
        {index === 1 && <GraphIcon active={active} />}
        {index === 2 && <SparklesIcon active={active} />}
        {index === 3 && <HumanReviewIcon active={active} />}
        {index === 4 && <ExportIcon active={active} />}
      </motion.div>

      {/* Title — Added clear breathing room */}
      <h3 className={`font-sans font-bold text-sm mb-2 transition-colors duration-300 ${active ? 'text-[#8A2E2E]' : 'text-[#1C1B19]'}`}>
        {step.title}
      </h3>

      {/* Description */}
      <p className="font-sans text-xs text-[#5C5A54] leading-relaxed max-w-[140px] mx-auto">
        {step.desc}
      </p>
    </div>
  );
}

export default function HowItWorksSection() {
  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center'],
  });

  const pathLength = useTransform(scrollYProgress, [0.1, 0.85], [0, 1]);

  // Alternating wave curve path connecting the 5 nodes with increased arc curvature:
  // Node 1 (100) -> Node 2 (300) [HIGH UPWARD ARC]
  // Node 2 (300) -> Node 3 (500) [DEEP DOWNWARD ARC]
  // Node 3 (500) -> Node 4 (700) [HIGH UPWARD ARC]
  // Node 4 (700) -> Node 5 (900) [DEEP DOWNWARD ARC]
  const wavePathD = "M 100,66 C 165,6 235,6 300,66 C 365,126 435,126 500,66 C 565,6 635,6 700,66 C 765,126 835,126 900,66";

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
          {/* Wave SVG Pipeline Track — Positioned behind the icon nodes */}
          <div className="hidden sm:block absolute inset-x-0 -top-2 h-[135px] pointer-events-none z-10">
            <svg
              className="w-full h-full"
              viewBox="0 0 1000 132"
              preserveAspectRatio="none"
            >
              {/* Inactive Wave Track */}
              <path
                d={wavePathD}
                stroke="#DEDAD0"
                strokeWidth="2.5"
                strokeDasharray="4 4"
                fill="none"
              />
              {/* Active Scroll Tracer Wave */}
              <motion.path
                d={wavePathD}
                stroke="#8A2E2E"
                strokeWidth="3"
                fill="none"
                style={{ pathLength }}
              />
            </svg>
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 items-start text-center relative z-20">
            {STEPS.map((step, i) => (
              <StepNodeItem key={step.index} step={step} index={i} scrollYProgress={scrollYProgress} />
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
