import { useState, useEffect } from 'react';

// design-system.md: score rings use a single --signal stroke, not a
// per-category rainbow. Shared by Dashboard.jsx and the banker screens so
// founder and banker readiness visuals stay visually identical.
export default function ScoreRing({ score, size = 140, stroke = 10, color = 'var(--signal)' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [anim, setAnim] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnim(score), 300);
    return () => clearTimeout(t);
  }, [score]);

  const filled = circ * (1 - anim / 100);

  return (
    <div className="readiness-ring-wrap" style={{ width: size, height: size, margin: '0 auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--paper-sunken)" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={filled}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s ease' }}
        />
      </svg>
      <div className="readiness-ring-label">
        <span className="readiness-pct" style={{ fontSize: size * 0.28, lineHeight: 1 }}>{score}%</span>
        <span className="readiness-pct-label" style={{ fontSize: size * 0.14, color: 'var(--ink-soft)', fontWeight: 600, letterSpacing: '0.08em', marginTop: 2 }}>READY</span>
      </div>
    </div>
  );
}
