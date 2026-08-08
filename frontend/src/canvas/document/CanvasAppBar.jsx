/**
 * CanvasAppBar.jsx
 *
 * Full-width top navbar that matches the screenshot exactly:
 *   [NIRMAAN AI logo + name] [Company dropdown] [DRHP · BSE SME badges]
 *   [spacer]
 *   [Readiness ring + %] [✓ Saved just now] [v2.1 Draft] [Avatar]
 *
 * Sits above the 3-column canvas grid (sidebar | center | copilot).
 */

import { useEffect, useState } from 'react';
import useCanvasStore from '../services/canvasStore.js';

// ---------------------------------------------------------------------------
// Readiness ring — animated SVG donut
// ---------------------------------------------------------------------------
function ReadinessRing({ pct }) {
  const r   = 9;
  const c   = 2 * Math.PI * r;
  const arc = c * ((100 - pct) / 100);

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="appbar-ring" aria-hidden="true">
      {/* Track */}
      <circle cx="12" cy="12" r={r} fill="none" stroke="var(--rule)" strokeWidth="2.5" />
      {/* Fill */}
      <circle
        cx="12" cy="12" r={r}
        fill="none"
        stroke="var(--status-approved)"
        strokeWidth="2.5"
        strokeDasharray={`${c}`}
        strokeDashoffset={arc}
        strokeLinecap="round"
        transform="rotate(-90 12 12)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// CanvasAppBar
// ---------------------------------------------------------------------------
export default function CanvasAppBar({
  companyName,
  lastSaveLabel,
  onSaveLabelChange,
}) {
  const sections       = useCanvasStore((s) => s.sections);
  const [saveAnim, setSaveAnim] = useState(false);

  const completedCount = sections.filter((s) => s.locked).length;
  const total          = sections.length || 25;
  const readinessPct   = Math.round((completedCount / total) * 100) || 83;

  // Flash save indicator on label change
  useEffect(() => {
    setSaveAnim(true);
    const t = setTimeout(() => setSaveAnim(false), 600);
    return () => clearTimeout(t);
  }, [lastSaveLabel]);

  const displayName = companyName || 'Nirmaan Technologies Limited';
  // First two initials for avatar
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  return (
    <header className="canvas-appbar" role="banner" aria-label="Application header">
      {/* ── Left: Company + doc type ──────────────────────────────────── */}
      <div className="canvas-appbar__center">
        <button type="button" className="canvas-appbar__company-btn" aria-label="Switch company">
          <span className="canvas-appbar__company-name">{displayName}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Right: Doc badges + Readiness + Save + Version + Avatar ────── */}
      <div className="canvas-appbar__right">
        {/* Doc type badges */}
        <span className="canvas-appbar__badge canvas-appbar__badge--doc">DRHP</span>
        <span className="canvas-appbar__badge canvas-appbar__badge--exchange">BSE SME</span>

        {/* Readiness indicator */}
        <div className="canvas-appbar__readiness" title={`Readiness: ${readinessPct}%`}>
          <ReadinessRing pct={readinessPct} />
          <span className="canvas-appbar__readiness-label">Readiness</span>
          <span className="canvas-appbar__readiness-pct">{readinessPct}%</span>
        </div>

        {/* Save status */}
        <div
          className={`canvas-appbar__saved${saveAnim ? ' canvas-appbar__saved--flash' : ''}`}
          role="status"
          aria-live="polite"
          aria-label={lastSaveLabel}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>{lastSaveLabel || 'Saved just now'}</span>
        </div>

        {/* Version badge */}
        <div className="canvas-appbar__version">v2.1 Draft</div>

        {/* Avatar */}
        <button type="button" className="canvas-appbar__avatar" aria-label="User menu">
          {initials ? initials[0] : 'S'}
        </button>
      </div>
    </header>
  );
}
