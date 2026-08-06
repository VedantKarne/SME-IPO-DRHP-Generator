import { useEffect, useRef, useState } from 'react';
import './HeroAnimation.css';

// Chips cluster in the left ~40% of the box; graph nodes/lines run in a
// separate lane on the right ~65-93%, so the connecting lines never cross
// through a chip's label (they used to, at the old coordinates).
const DOC_CHIPS = [
  { id: 'financials', label: 'Financial Statements', top: '2%', left: '4%', rotate: -6 },
  { id: 'gst', label: 'GST Returns', top: '28%', left: '0%', rotate: 4 },
  { id: 'roc', label: 'ROC Filings', top: '56%', left: '8%', rotate: -3 },
  { id: 'board', label: 'Board Resolution', top: '82%', left: '2%', rotate: 5 },
];

// Graph node anchors (SVG viewBox coordinate space, 140 wide) — kept in the
// x:90-128 lane (roughly 64%-91% of box width), clear of the chip cluster.
const GRAPH_NODES = {
  financials: { x: 128, y: 15 },
  gst: { x: 90, y: 95 },
  roc: { x: 128, y: 175 },
  board: { x: 90, y: 255 },
};

const EDGES = [
  ['financials', 'gst'],
  ['gst', 'roc'],
  ['roc', 'board'],
];

const SECTIONS = [
  { id: 'risk', title: 'Risk Factors', citation: 1 },
  { id: 'capital', title: 'Capital Structure', citation: 2 },
  { id: 'objects', title: 'Objects of the Offer', citation: 3, gap: true, gapLabel: 'Missing: Board Resolution' },
];

const START_READINESS = 48;
const END_READINESS = 92;
const LOOP_MS = 7900;

const EMPTY_TICK = { edgesDrawn: 0, docGrown: false, sectionsShown: 0, gapResolved: false, resetting: false };

export default function HeroAnimation() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [tick, setTick] = useState(EMPTY_TICK);
  const [readiness, setReadiness] = useState(START_READINESS);
  const timeouts = useRef([]);
  const rafRef = useRef(null);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sizeQuery = window.matchMedia('(max-width: 640px)');
    setReducedMotion(motionQuery.matches);
    setIsSmallScreen(sizeQuery.matches);
    const onMotionChange = (e) => setReducedMotion(e.matches);
    const onSizeChange = (e) => setIsSmallScreen(e.matches);
    motionQuery.addEventListener('change', onMotionChange);
    sizeQuery.addEventListener('change', onSizeChange);
    return () => {
      motionQuery.removeEventListener('change', onMotionChange);
      sizeQuery.removeEventListener('change', onSizeChange);
    };
  }, []);

  const skipAnimation = reducedMotion || isSmallScreen;

  useEffect(() => {
    if (skipAnimation) return undefined;

    const schedule = (fn, delay) => {
      timeouts.current.push(setTimeout(fn, delay));
    };

    const animateReadiness = (duration) => {
      const start = performance.now();
      const step = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        setReadiness(Math.round(START_READINESS + (END_READINESS - START_READINESS) * progress));
        if (progress < 1) rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    };

    const runLoop = () => {
      setTick(EMPTY_TICK);
      setReadiness(START_READINESS);

      EDGES.forEach((_, i) => {
        schedule(() => setTick((t) => ({ ...t, edgesDrawn: i + 1 })), 200 + i * 300);
      });

      schedule(() => setTick((t) => ({ ...t, docGrown: true })), 1100);

      schedule(() => {
        setTick((t) => ({ ...t, sectionsShown: 1 }));
        animateReadiness(3000);
      }, 1900);
      schedule(() => setTick((t) => ({ ...t, sectionsShown: 2 })), 2900);
      schedule(() => setTick((t) => ({ ...t, sectionsShown: 3 })), 3900);
      schedule(() => setTick((t) => ({ ...t, gapResolved: true })), 4900);

      schedule(() => setTick((t) => ({ ...t, resetting: true })), 7000);
      schedule(runLoop, LOOP_MS);
    };

    runLoop();

    return () => {
      timeouts.current.forEach(clearTimeout);
      timeouts.current = [];
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [skipAnimation]);

  if (skipAnimation) {
    return <StaticEndState />;
  }

  return (
    <div className={`lv-hero-anim ${tick.resetting ? 'lv-resetting' : ''}`} aria-hidden="true">
      <AnimLeft edgesDrawn={tick.edgesDrawn} />
      <DocPanel docGrown={tick.docGrown} sectionsShown={tick.sectionsShown} gapResolved={tick.gapResolved} readiness={readiness} />
    </div>
  );
}

function AnimLeft({ edgesDrawn }) {
  return (
    <div className="lv-anim-left">
      {DOC_CHIPS.map((chip) => (
        <div
          key={chip.id}
          className="lv-doc-chip"
          style={{ top: chip.top, left: chip.left, '--rot': `${chip.rotate}deg` }}
        >
          {chip.label}
        </div>
      ))}
      <svg className="lv-graph-svg" viewBox="0 0 140 300" preserveAspectRatio="none">
        {EDGES.map(([a, b], i) => {
          const na = GRAPH_NODES[a];
          const nb = GRAPH_NODES[b];
          return (
            <line
              key={`${a}-${b}`}
              x1={na.x}
              y1={na.y}
              x2={nb.x}
              y2={nb.y}
              className={`lv-graph-edge ${i < edgesDrawn ? 'lv-edge-on' : ''}`}
            />
          );
        })}
        {Object.entries(GRAPH_NODES).map(([id, pos]) => (
          <circle
            key={id}
            cx={pos.x}
            cy={pos.y}
            r="3"
            className={`lv-graph-node ${edgesDrawn > 0 ? 'lv-node-on' : ''}`}
          />
        ))}
      </svg>
    </div>
  );
}

function DocPanel({ docGrown, sectionsShown, gapResolved, readiness }) {
  return (
    <div className={`lv-doc-panel ${docGrown ? 'lv-doc-open' : ''}`}>
      <div className="lv-doc-panel-header">
        <span className="lv-doc-panel-title">Draft DRHP</span>
        <span className="lv-doc-readiness">{readiness}%</span>
      </div>
      <div className="lv-doc-panel-body">
        {SECTIONS.map((section, i) => (
          <div key={section.id} className={`lv-doc-section ${i < sectionsShown ? 'lv-section-on' : ''}`}>
            <div className="lv-doc-section-title">
              {section.title}
              <sup className="lv-citation-marker">{section.citation}</sup>
            </div>
            <div className="lv-doc-section-line" />
            {section.gap && (
              <div className={`lv-status-line ${gapResolved ? 'lv-status-approved' : 'lv-status-gap'}`}>
                <span className="lv-status-dot" />
                {gapResolved ? 'Board Resolution — Verified' : section.gapLabel}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StaticEndState() {
  return (
    <div className="lv-hero-anim lv-static-endstate" aria-hidden="true">
      <AnimLeft edgesDrawn={EDGES.length} />
      <DocPanel docGrown sectionsShown={SECTIONS.length} gapResolved readiness={END_READINESS} />
    </div>
  );
}
