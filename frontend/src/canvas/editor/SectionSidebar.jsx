import { CheckCircle2, FileEdit, AlertTriangle, Circle } from "lucide-react";
import useCanvasStore from "../services/canvasStore.js";

// design-system.md defines exactly four status colors — no purple "AI
// Generated" fifth state.
function getSectionStatus(section) {
  if (!section) return { label: "Empty", color: "var(--status-pending)", pct: 0 };

  const hasContent = Boolean(section.draft_text || section.content || section.markdown);
  const score = section.score || 0;

  if (section.locked) {
    return { label: "Complete", color: "var(--status-approved)", pct: 100 };
  }

  if (hasContent && score >= 50) {
    return { label: "Draft", color: "var(--status-draft)", pct: score };
  }

  if (hasContent || score > 0) {
    return { label: "Needs Review", color: "var(--status-gap)", pct: Math.max(score, 30) };
  }

  return { label: "Pending", color: "var(--status-pending)", pct: 0 };
}

// ---------------------------------------------------------------------------
// Status badge component
// ---------------------------------------------------------------------------
function StatusBadge({ status }) {
  const iconMap = {
    "Complete":     CheckCircle2,
    "Draft":        FileEdit,
    "Needs Review": AlertTriangle,
    "Pending":      Circle,
    "Empty":        Circle,
  };

  const Icon = iconMap[status.label] || Circle;

  return (
    <div className="section-status-badge" style={{ color: status.color }}>
      <span className="section-status-badge__icon"><Icon size={12} strokeWidth={2} /></span>
      <span className="section-status-badge__label">{status.label}</span>
      {status.pct > 0 && (
        <span className="section-status-badge__pct">{status.pct}%</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual section row
// ---------------------------------------------------------------------------
function SectionItem({ section, index, isActive, onClick }) {
  const status = getSectionStatus(section);
  const label = section.title ?? section.name ?? `Section ${index + 1}`;

  return (
    <li>
      <button
        type="button"
        className={["section-item", isActive ? "section-item--active" : ""].filter(Boolean).join(" ")}
        onClick={() => onClick(index)}
        aria-current={isActive ? "true" : undefined}
        aria-label={`${label}, status: ${status.label}, ${status.pct}% complete`}
      >
        <div className="section-item__title">{label}</div>
        <StatusBadge status={status} />

        {/* Progress bar — only visible when pct > 0 */}
        {status.pct > 0 && (
          <div
            className="section-item__progress-track"
            aria-label={`Section progress: ${status.pct}%`}
          >
            <div
              className="section-item__progress-fill"
              style={{
                width: `${status.pct}%`,
                background: status.color,
              }}
            />
          </div>
        )}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Section Sidebar (P5)
// ---------------------------------------------------------------------------
export default function SectionSidebar() {
  const sections = useCanvasStore((s) => s.sections);
  const activeSectionIdx = useCanvasStore((s) => s.activeSectionIdx);
  const setActiveSectionIdx = useCanvasStore((s) => s.setActiveSectionIdx);

  const completedCount = sections.filter((s) => s.locked).length;
  const totalCount = sections.length || 25;

  return (
    <aside className="section-sidebar" aria-label="Document sections">
      <div className="section-sidebar__header">
        <h2 className="section-sidebar__title">Sections</h2>
        <div className="section-sidebar__progress-summary">
          <span className="section-sidebar__progress-count">{completedCount}/{totalCount}</span>
          <div className="section-sidebar__progress-mini">
            <div
              className="section-sidebar__progress-mini-fill"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <nav className="section-sidebar__nav" aria-label="Section navigation">
        <ul className="section-sidebar__list" role="list">
          {sections.map((section, idx) => (
            <SectionItem
              key={section.name ?? idx}
              section={section}
              index={idx}
              isActive={idx === activeSectionIdx}
              onClick={setActiveSectionIdx}
            />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
