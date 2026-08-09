import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, GitBranch } from 'lucide-react';
import * as canvasApi from '../canvas/services/canvasApi.js';
import { IMPACT_KEYS } from '../utils/impactKeys.js';

const FIELD_X = 90;
const SECTION_X = 460;
const ROW_HEIGHT = 46;
const TOP_PADDING = 30;

export default function DependencyGraph({ isOpen, onClose }) {
  const [impacts, setImpacts] = useState(null);
  const [selectedField, setSelectedField] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setImpacts(null);
    setSelectedField(null);
    Promise.all(
      IMPACT_KEYS.map(({ key }) =>
        canvasApi.getImpact(key).catch(() => ({ changed_field: key, affected_sections: [] }))
      )
    ).then(setImpacts);
  }, [isOpen]);

  const sections = useMemo(() => {
    if (!impacts) return [];
    const seen = new Set();
    const list = [];
    impacts.forEach((imp) => {
      imp.affected_sections.forEach((s) => {
        if (!seen.has(s)) {
          seen.add(s);
          list.push(s);
        }
      });
    });
    return list;
  }, [impacts]);

  if (!isOpen) return null;

  const height = Math.max(IMPACT_KEYS.length, sections.length) * ROW_HEIGHT + TOP_PADDING * 2;
  const fieldY = (i) => TOP_PADDING + i * ROW_HEIGHT + ROW_HEIGHT / 2;
  const sectionY = (i) => TOP_PADDING + i * ROW_HEIGHT + ROW_HEIGHT / 2;

  // Rendered as a portal so it always sits above canvas chrome — DocumentSidebar,
  // this component's mount point, is display:none below 880px (canvas.css), which
  // would otherwise take the modal down with it since a display:none ancestor
  // hides all descendants regardless of the modal's own position:fixed.
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(26, 22, 18, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: 'min(720px, 92vw)', maxHeight: '85vh', overflowY: 'auto', padding: 24 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitBranch size={17} strokeWidth={1.75} color="var(--signal)" />
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)' }}>Data Dependency Graph</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn-icon"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 4 }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginBottom: 14 }}>
          If a field on the left changes, the DRHP sections it connects to need re-review. Click a field to trace it.
        </p>

        {!impacts ? (
          <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>Loading…</p>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Data Fields
              </span>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                DRHP Sections
              </span>
            </div>
            <svg
              viewBox={`0 0 ${SECTION_X + 220} ${height}`}
              width="100%"
              height={height}
              role="img"
              aria-label="Graph of data fields connected to the DRHP sections they affect"
            >
              {impacts.flatMap((imp, fi) =>
                imp.affected_sections.map((s) => {
                  const si = sections.indexOf(s);
                  const isSelected = selectedField === imp.changed_field;
                  const isDimmed = selectedField && !isSelected;
                  return (
                    <line
                      key={`${imp.changed_field}-${s}`}
                      x1={FIELD_X + 90} y1={fieldY(fi)}
                      x2={SECTION_X} y2={sectionY(si)}
                      stroke={isSelected ? 'var(--signal)' : 'var(--rule)'}
                      strokeWidth={isSelected ? 1.75 : 1}
                      opacity={isDimmed ? 0.15 : 1}
                    />
                  );
                })
              )}

              {IMPACT_KEYS.map(({ key, label }, i) => {
                const isSelected = selectedField === key;
                const isDimmed = selectedField && !isSelected;
                return (
                  <g
                    key={key}
                    onClick={() => setSelectedField(isSelected ? null : key)}
                    style={{ cursor: 'pointer' }}
                    opacity={isDimmed ? 0.35 : 1}
                  >
                    <rect
                      x={FIELD_X - 82} y={fieldY(i) - 15} width={164} height={30} rx={3}
                      fill={isSelected ? 'var(--signal-soft)' : 'var(--paper-raised)'}
                      stroke={isSelected ? 'var(--signal)' : 'var(--rule)'}
                      strokeWidth={isSelected ? 1.5 : 1}
                    />
                    <text
                      x={FIELD_X} y={fieldY(i) + 4} textAnchor="middle"
                      fontSize="12" fontFamily="var(--font-sans, Inter, sans-serif)"
                      fontWeight={isSelected ? 700 : 500}
                      fill="var(--ink)"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {sections.map((s, i) => {
                const isConnectedToSelected =
                  selectedField &&
                  impacts.some((imp) => imp.changed_field === selectedField && imp.affected_sections.includes(s));
                const isDimmed = selectedField && !isConnectedToSelected;
                return (
                  <g key={s} opacity={isDimmed ? 0.25 : 1}>
                    <rect
                      x={SECTION_X} y={sectionY(i) - 14} width={200} height={28} rx={3}
                      fill="var(--paper-sunken)"
                      stroke="var(--rule)"
                      strokeWidth={1}
                    />
                    <text
                      x={SECTION_X + 10} y={sectionY(i) + 4}
                      fontSize="11.5" fontFamily="var(--font-sans, Inter, sans-serif)"
                      fill="var(--ink-soft)"
                    >
                      {s.length > 26 ? `${s.slice(0, 25)}…` : s}
                    </text>
                  </g>
                );
              })}
            </svg>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
