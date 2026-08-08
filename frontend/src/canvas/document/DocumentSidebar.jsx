/**
 * DocumentSidebar.jsx
 *
 * Left navigation rail matching the screenshot exactly:
 *  • "SECTIONS" label at the top
 *  • Numbered rows (01–25) with coloured status dot + section name
 *  • Active row highlighted in blue
 *  • "View all 25 sections" collapsed footer
 *  • IntersectionObserver driven active state (via canvasStore)
 *  • Smooth-scroll to section anchor on click
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import useCanvasStore from '../services/canvasStore.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// design-system.md defines exactly four status colors (approved/draft/gap/
// pending) — no fifth "AI generated" accent. A high-scoring unlocked
// section still reads as "in draft" until it's actually locked.
function dotColor(section) {
  if (section.locked)                                         return 'var(--status-approved)';
  const has = Boolean(section.content || section.draft_text || section.markdown);
  if (has)                                                    return 'var(--status-draft)';
  return 'var(--status-pending)';
}

function dotTitle(section) {
  if (section.locked)                                         return 'Complete';
  const has = Boolean(section.content || section.draft_text || section.markdown);
  if (has && (section.score ?? 0) >= 80)                     return 'In Progress — AI drafted';
  if (has)                                                    return 'In Progress';
  return 'Pending';
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// DocumentSidebar
// ---------------------------------------------------------------------------
export default function DocumentSidebar({ containerRef }) {
  const sections         = useCanvasStore((s) => s.sections);
  const activeSectionIdx = useCanvasStore((s) => s.activeSectionIdx);
  const navRailCollapsed = useCanvasStore((s) => s.navRailCollapsed);
  const setNavRailCollapsed = useCanvasStore((s) => s.setNavRailCollapsed);
  const [collapsed, setCollapsed] = useState(true);

  const activeItemRef = useRef(null);
  const listRef       = useRef(null);

  const total          = sections.length || 25;
  const completedCount = sections.filter((s) => s.locked).length;

  // How many sections to show when collapsed (match screenshot: 15 visible)
  const VISIBLE_COUNT  = 15;
  const visibleSections = collapsed ? sections.slice(0, VISIBLE_COUNT) : sections;

  // Scroll active nav item into view inside the sidebar
  useEffect(() => {
    if (activeItemRef.current && listRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSectionIdx]);

  function handleClick(sectionName) {
    const container = containerRef?.current;
    if (!container) return;
    const target = container.querySelector(`#section-${slugify(sectionName)}`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // This panel is the Workspace's alternative to the app's main nav — only
  // one of the two is ever shown at once (see canvasStore.js navRailCollapsed).
  // Must come after every hook above so hook call order stays consistent
  // across renders regardless of which branch this takes.
  if (!navRailCollapsed) return null;

  return (
    <aside className="doc-sidebar" aria-label="Document sections">
      {/* ── Back to main nav ── */}
      <button
        type="button"
        className="doc-sidebar__back"
        onClick={() => setNavRailCollapsed(false)}
      >
        <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
        Document Workspace
      </button>

      {/* ── SECTIONS label ── */}
      <div className="doc-sidebar__heading" aria-hidden="true">SECTIONS</div>

      {/* ── Section nav list ── */}
      <nav aria-label="Jump to section" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ul className="doc-sidebar__list" ref={listRef} role="list">
          {visibleSections.map((section, idx) => {
            const isActive = idx === activeSectionIdx;
            const color    = dotColor(section);
            const num      = String(idx + 1).padStart(2, '0');

            return (
              <li key={section.name} role="none" ref={isActive ? activeItemRef : null}>
                <button
                  type="button"
                  className={`doc-sidebar__item${isActive ? ' doc-sidebar__item--active' : ''}`}
                  onClick={() => handleClick(section.name)}
                  aria-current={isActive ? 'true' : undefined}
                  title={`${section.name} — ${dotTitle(section)}`}
                >
                  {/* Number */}
                  <span className="doc-sidebar__num" aria-hidden="true">{num}</span>
                  {/* Name */}
                  <span className="doc-sidebar__item-text">{section.name}</span>
                  {/* Status dot — right-aligned */}
                  <span
                    className="doc-sidebar__dot"
                    style={{ background: color }}
                    aria-hidden="true"
                    title={dotTitle(section)}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        {/* ── "View all N sections" footer ── */}
        {sections.length > VISIBLE_COUNT && (
          <button
            type="button"
            className="doc-sidebar__view-all"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
          >
            {collapsed
              ? `View all ${total} sections`
              : 'Show less'}
            <svg
              width="11" height="11" viewBox="0 0 24 24" fill="none"
              aria-hidden="true"
              style={{ transform: collapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
      </nav>
    </aside>
  );
}
