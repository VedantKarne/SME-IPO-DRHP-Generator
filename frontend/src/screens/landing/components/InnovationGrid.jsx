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
    <div className="relative flex flex-col gap-10 md:gap-14">
      <div
        aria-hidden="true"
        className="hidden md:block absolute top-2 bottom-2 left-1/2 w-px bg-white/10 -translate-x-1/2"
      />
      {FEATURES.map(({ icon: Icon, title, desc }, i) => {
        const rightSide = i % 2 === 1;
        return (
          <motion.div
            key={title}
            initial={{ opacity: 0, x: rightSide ? 24 : -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`relative w-full md:w-[56%] flex flex-col gap-3 ${rightSide ? 'md:ml-auto md:text-right md:items-end' : 'md:mr-auto md:text-left md:items-start'}`}
          >
            <Icon size={20} strokeWidth={1.5} className="text-[#C77B70]" />
            <h3 className="font-sans font-semibold text-base text-[#FAF8F3]">{title}</h3>
            <p className="font-sans text-sm text-[#9C998F] leading-relaxed">{desc}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

function StaticFeatures() {
  return (
    <section id="features" className="lv-grid-dark bg-[#1C1B19] border-t border-[#DEDAD0]">
      <div className="max-w-4xl mx-auto px-6 sm:px-8 py-16 sm:py-24">
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
  const boxRef = useRef(null);
  const wrapRef = useRef(null);
  const contentRef = useRef(null);
  // Real, measured target size (not guessed) — read live inside the motion
  // mapping functions via a ref so a resize never leaves it stale.
  const targetRef = useRef({ w: 900, h: 700 });

  useEffect(() => {
    const measure = () => {
      targetRef.current = {
        w: wrapRef.current?.clientWidth || targetRef.current.w,
        h: contentRef.current?.scrollHeight || targetRef.current.h,
      };
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, []);

  // Tracks the box's own scroll-into-view progress — no pin/sticky, no second
  // element, so there's no seam or gap: this IS the circle, and it IS the
  // card that ends up holding the features, continuously, in normal flow.
  const { scrollYProgress } = useScroll({
    target: boxRef,
    offset: ['start 0.9', 'start 0.35'],
  });

  const SEED = 260; // px — big enough that the heading text isn't forced into a
  // narrow column and visibly re-wrapping as the box grows; still small
  // enough relative to the final ~900-1100px card to read as "grows".
  const RADIUS_END = 32; // px

  // Hidden until scroll reaches this section, then a real (unclipped) small
  // circle fades in fully-formed, and only then starts growing — no dome.
  const opacity = useTransform(scrollYProgress, [0, 0.05], [0, 1]);
  const t = useTransform(scrollYProgress, [0.05, 1], [0, 1]);

  const width = useTransform(t, (v) => `${SEED + v * (targetRef.current.w - SEED)}px`);
  const height = useTransform(t, (v) => `${SEED + v * (targetRef.current.h - SEED)}px`);
  // Border-radius values larger than half the box's own size just get
  // clamped by the browser to a full pill/circle — so interpolating it
  // linearly from a big constant (e.g. 9999px) down to 32px looked "instant":
  // the raw value stayed far above the clamp threshold for most of the
  // scroll range (no visible change), then dropped below it in the last
  // few percent (sudden snap to rounded-rect). Anchoring "fully round" to
  // the box's *current* half-dimension instead means the effective
  // roundedness shrinks smoothly across the whole range, not just the end.
  const borderRadius = useTransform(t, (v) => {
    const w = SEED + v * (targetRef.current.w - SEED);
    const h = SEED + v * (targetRef.current.h - SEED);
    const fullRound = Math.min(w, h) / 2;
    const r = fullRound + v * (RADIUS_END - fullRound);
    return `${r}px`;
  });

  return (
    <section id="features" className="bg-paper border-t border-[#DEDAD0]">
      <div ref={wrapRef} className="max-w-[1100px] mx-auto px-6 sm:px-8 py-16 sm:py-24">
        <motion.div
          ref={boxRef}
          style={{ opacity, width, height, borderRadius, overflow: 'hidden' }}
          className="lv-grid-dark bg-[#1C1B19] mx-auto"
        >
          <div ref={contentRef} className="px-8 md:px-14 py-14 md:py-20">
            <div className="mb-14 text-center">
              <h2 className="font-sans text-3xl md:text-4xl font-bold text-[#FAF8F3] mb-4 tracking-tight">
                Built for the filing room, not a chat window
              </h2>
              <p className="font-sans text-sm md:text-base text-[#DEDAD0] leading-relaxed max-w-xl mx-auto">
                Every capability exists to make the DRHP more precise, more evidenced, and more
                defensible — not to make the product feel clever.
              </p>
            </div>
            <ZigzagFeatures />
          </div>
        </motion.div>
      </div>
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
