/**
 * VersionHistoryPanel.jsx — Git-like version history for each DRHP section.
 * P7: v1/v2/v3 tags, timestamps, Compare + Restore, clean timeline UI.
 */

import { useState } from "react";
import useVersionStore from "./versionStore.js";

// ---------------------------------------------------------------------------
// timeAgo — relative timestamp
// ---------------------------------------------------------------------------
function timeAgo(isoTimestamp) {
  const now  = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 10)  return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (diffSec < 60)  return rtf.format(-diffSec, "second");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return rtf.format(-diffMin, "minute");
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)   return rtf.format(-diffHr, "hour");
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30)  return rtf.format(-diffDay, "day");
  return rtf.format(-Math.floor(diffDay / 30), "month");
}

// ---------------------------------------------------------------------------
// Source → meta
// ---------------------------------------------------------------------------
const SOURCE_META = {
  ai_rewrite:  { icon: "✦", label: "AI Rewrite",  colorVar: "var(--accent)" },
function timeAgo(dateString) {
  const d = new Date(dateString);
  const diff = (new Date() - d) / 1000; // seconds
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// sourceMeta — UI mapping for different sources
// ---------------------------------------------------------------------------
function sourceMeta(source) {
  switch (source) {
    case "ai_rewrite":
    case "ai_prompt":
    case "ai_chat":
      return { icon: "✦", label: "AI", colorVar: "var(--accent)" }; // Purple for AI
    case "approval":
      return { icon: "✓", label: "Approved", colorVar: "var(--success)" }; // Green for approvals
    case "manual_save":
    default:
      return { icon: "📝", label: "Manual Save", colorVar: "var(--text-secondary)" }; // Gray for manual/unknown
  }
}

// ---------------------------------------------------------------------------
// VersionHistoryPanel
// ---------------------------------------------------------------------------
export default function VersionHistoryPanel({ editor, activeSectionName, companyId }) {
  const getVersions  = useVersionStore((s) => s.getVersions);
  const addVersion   = useVersionStore((s) => s.addVersion);
  const loadVersions = useVersionStore((s) => s.loadVersions);

  const [previewIdx,  setPreviewIdx]  = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIdxA, setCompareIdxA] = useState(null);
  const [compareIdxB, setCompareIdxB] = useState(null);

  // Load versions from backend on mount or section change
  useEffect(() => {
    if (companyId && activeSectionName) {
      loadVersions(companyId, activeSectionName);
    }
  }, [companyId, activeSectionName, loadVersions]);

  const versions = activeSectionName ? getVersions(activeSectionName) : [];
  const count    = versions.length;

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  function handlePreview(entry, idx) {
    if (!editor) return;
    editor.setEditable(false);
    editor.commands.setContent(entry.content);
    setPreviewIdx(idx);
    setCompareMode(false);
  }

  function handleRestore(entry, e) {
    e.stopPropagation();
    if (!editor || !activeSectionName) return;
    editor.setEditable(true);
    editor.commands.setContent(entry.content);
    addVersion(companyId, activeSectionName, {
      id: crypto.randomUUID(),
      sectionName: activeSectionName,
      label: `Restored: ${entry.label}`,
      timestamp: new Date().toISOString(),
      source: entry.source,
      content: entry.content,
      authorLabel: entry.authorLabel ?? "User",
    });
    setPreviewIdx(null);
    setCompareMode(false);
  }

  function handleExitPreview() {
    if (!editor) return;
    editor.setEditable(true);
    setPreviewIdx(null);
    setCompareMode(false);
    setCompareIdxA(null);
    setCompareIdxB(null);
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <section className="version-panel" aria-label="Version history">
      {/* ── Header ── */}
      <div className="version-panel__header">
        <div className="version-panel__title-row">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="version-panel__git-icon" aria-hidden="true">⎇</span>
            <h3 className="version-panel__title">Version History</h3>
            {count > 0 && (
              <span className="version-panel__badge badge badge-accent">
                {count}
              </span>
            )}
          </div>
        </div>

        {previewIdx !== null && (
          <button
            type="button"
            className="version-panel__exit-preview btn btn-sm btn-secondary"
            onClick={handleExitPreview}
          >
            ← Back to editing
          </button>
        )}
      </div>

      {/* ── Preview notice ── */}
      {previewIdx !== null && !compareMode && (
        <div className="version-panel__preview-notice" role="status">
          <span aria-hidden="true">👁</span>
          Previewing version {count - previewIdx} — editor is read-only
        </div>
      )}

      {/* ── Empty state ── */}
      {count === 0 ? (
        <div className="version-panel__empty-state">
          <div className="version-panel__empty-icon" aria-hidden="true">⎇</div>
          <p className="version-panel__empty">No versions saved yet.</p>
          <p className="version-panel__empty-sub">
            Versions are saved automatically when you edit or use AI actions.
          </p>
        </div>
      ) : (
        /* ── Timeline ── */
        <ol className="version-panel__timeline" aria-label="Saved versions">
          {versions.map((entry, idx) => {
            const meta       = sourceMeta(entry.source);
            const isSelected = previewIdx === idx;
            const versionNum = count - idx; // newest = highest number

            return (
              <li
                key={entry.id}
                className={[
                  "version-entry",
                  isSelected ? "version-entry--selected" : "",
                ].filter(Boolean).join(" ")}
              >
                {/* Timeline track dot */}
                <div className="version-entry__track">
                  <div
                    className="version-entry__dot"
                    style={{ borderColor: meta.colorVar, background: isSelected ? meta.colorVar : "var(--bg-surface)" }}
                    aria-hidden="true"
                  />
                  {idx < versions.length - 1 && (
                    <div className="version-entry__line" aria-hidden="true" />
                  )}
                </div>

                {/* Entry content */}
                <div className="version-entry__content">
                  <button
                    type="button"
                    className="version-entry__row"
                    onClick={() => handlePreview(entry, idx)}
                    aria-label={`Preview version ${versionNum}: ${entry.label}`}
                  >
                    {/* Version tag */}
                    <span
                      className="version-entry__tag"
                      style={{ color: meta.colorVar, borderColor: meta.colorVar }}
                    >
                      v{versionNum}
                    </span>

                    {/* Info */}
                    <div className="version-entry__info">
                      <div className="version-entry__label-row">
                        <span className="version-entry__source-icon" style={{ color: meta.colorVar }}>
                          {meta.icon}
                        </span>
                        <span className="version-entry__label">{entry.label}</span>
                      </div>
                      <div className="version-entry__meta-row">
                        <time className="version-entry__time" dateTime={entry.timestamp}>
                          {timeAgo(entry.timestamp)}
                        </time>
                        <span
                          className={[
                            "version-entry__author badge",
                            entry.authorLabel === "AI" ? "badge-accent" : "badge-muted",
                          ].join(" ")}
                        >
                          {entry.authorLabel}
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Actions row: Compare + Restore when selected */}
                  {isSelected && (
                    <div className="version-entry__actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary version-entry__compare-btn"
                        onClick={() => {
                          /* Compare is a UI-only stub that shows a diff note */
                          setCompareMode(true);
                          setCompareIdxA(idx);
                          setCompareIdxB(Math.min(idx + 1, versions.length - 1));
                        }}
                        disabled={versions.length < 2}
                        title="Compare with adjacent version"
                      >
                        Compare
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={(e) => handleRestore(entry, e)}
                      >
                        Restore
                      </button>
                    </div>
                  )}

                  {/* Compare note */}
                  {isSelected && compareMode && compareIdxA === idx && (
                    <div className="version-entry__compare-note">
                      Comparing <strong>v{count - compareIdxA}</strong> ↔{" "}
                      <strong>v{count - compareIdxB}</strong>
                      <br />
                      <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
                        Open the diff viewer (⌘⇧D) for a full line-by-line comparison.
                      </span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
