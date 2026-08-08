/**
 * CanvasLayout.jsx
 *
 * Layout matching the screenshot exactly:
 *
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  CanvasAppBar  (full-width, 52px)                       │
 *  ├────────┬────────────────────────────────┬───────────────┤
 *  │        │ DocumentToolbar (42px)          │               │
 *  │ Sidebar│──────────────────────────────  │ CopilotPanel  │
 *  │        │ DocumentCanvas (scrollable)    │               │
 *  └────────┴────────────────────────────────┴───────────────┘
 *
 * - AppBar spans all columns via CSS grid row 1
 * - Sidebar + center + copilot share row 2
 * - Copilot is resizable (drag handle); collapses to 0 when closed
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import useCanvasStore from '../services/canvasStore.js';
import useToast, { ToastContainer } from '../toolbar/useToast.jsx';
import CanvasAppBar     from './CanvasAppBar.jsx';
import DocumentSidebar  from './DocumentSidebar.jsx';
import DocumentToolbar  from './DocumentToolbar.jsx';
import DocumentCanvas   from './DocumentCanvas.jsx';
import CopilotPanel     from './CopilotPanel.jsx';
import HITLReviewPanel from '../hitl/HITLReviewPanel.jsx';

const COPILOT_DEFAULT_W = 330;
const COPILOT_MIN_W     = 260;
const COPILOT_MAX_W     = 520;

// Must match --doc-sidebar-w's default in canvas.css — reused here so the
// Sections column can be collapsed to 0 without touching that base value.
const DOC_SIDEBAR_W = 224;

// ---------------------------------------------------------------------------
// CanvasLayout
// ---------------------------------------------------------------------------
export default function CanvasLayout({ companyId, companyName }) {
  const [copilotOpen,   setCopilotOpen]   = useState(true);
  const [copilotWidth,  setCopilotWidth]  = useState(COPILOT_DEFAULT_W);
  const [lastSaveLabel, setLastSaveLabel] = useState('Saved just now');

  const isDragging  = useRef(false);
  const dragStartX  = useRef(0);
  const dragStartW  = useRef(COPILOT_DEFAULT_W);

  const toggleCopilot = useCallback(() => setCopilotOpen((v) => !v), []);

  const editorRefs   = useRef({});
  const containerRef = useRef(null);

  const activeSectionIdx  = useCanvasStore((s) => s.activeSectionIdx);
  const sections          = useCanvasStore((s) => s.sections);
  const activeSectionName = sections[activeSectionIdx]?.name ?? '';
  const activeEditor      = editorRefs.current[activeSectionName] ?? null;

  // The app's main nav (GlobalSidebar, rendered as a sibling outside this
  // tree — see App.jsx) and the Sections panel below are mutually exclusive:
  // whichever isn't showing frees its width for the document itself.
  const navRailCollapsed = useCanvasStore((s) => s.navRailCollapsed);
  const sidebarWEffective = navRailCollapsed ? 'var(--sidebar-w-rail)' : 'var(--sidebar-w)';
  const docSidebarW       = navRailCollapsed ? `${DOC_SIDEBAR_W}px` : '0px';

  // Toast system
  const { toasts, showToast, dismissToast } = useToast();

  // Autosave callback. Receives an error when the save did NOT succeed, so we
  // never show "Autosaved" for work that was not actually persisted.
  const handleAutosave = useCallback((sectionName, error) => {
    const shortName = sectionName.length > 28
      ? sectionName.slice(0, 28) + '…'
      : sectionName;

    if (error) {
      setLastSaveLabel('Not saved');
      showToast(`Could not save "${shortName}" — ${error.message}`, 'error', 5000);
      return;
    }

    setLastSaveLabel('Saved just now');
    showToast(`Autosaved — ${shortName}`, 'success', 2000);
  }, [showToast]);

  // Copilot resize drag
  const onResizeStart = useCallback((e) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = copilotWidth;
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev) {
      if (!isDragging.current) return;
      const delta = dragStartX.current - ev.clientX;
      const newW  = Math.min(COPILOT_MAX_W, Math.max(COPILOT_MIN_W, dragStartW.current + delta));
      setCopilotWidth(newW);
    }
    function onUp() {
      isDragging.current            = false;
      document.body.style.cursor    = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [copilotWidth]);

  const copilotColW = copilotOpen ? `${copilotWidth}px` : '0px';

  return (
    <div
      className={`canvas-layout${copilotOpen ? ' canvas-layout--copilot-open' : ' canvas-layout--copilot-closed'}`}
      style={{
        '--doc-copilot-w': copilotColW,
        '--sidebar-w-effective': sidebarWEffective,
        '--doc-sidebar-w': docSidebarW,
      }}
    >
      {/* ── Full-width AppBar — spans all columns ── */}
      <CanvasAppBar
        companyName={companyName}
        lastSaveLabel={lastSaveLabel}
        copilotOpen={copilotOpen}
        onToggleCopilot={toggleCopilot}
      />

      {/* ── Left Sidebar ── */}
      <DocumentSidebar containerRef={containerRef} />

      {/* ── Center: toolbar + document ── */}
      <div className="canvas-layout__center">
        <DocumentToolbar
          activeEditor={activeEditor}
          companyId={companyId}
          activeSectionName={activeSectionName}
          copilotOpen={copilotOpen}
          onToggleCopilot={toggleCopilot}
          showToast={showToast}
        />
        {/* Surfaces a paused LangGraph review. Renders nothing when there is
            nothing awaiting a decision. */}
        <HITLReviewPanel
          sectionId={sections[activeSectionIdx]?.id}
          sectionName={activeSectionName}
          onResolved={(action) => showToast(`Review ${action}d`, 'success', 2500)}
        />
        <DocumentCanvas
          companyId={companyId}
          editorRefs={editorRefs}
          containerRef={containerRef}
          onAutosave={handleAutosave}
          showToast={showToast}
        />
      </div>

      {/* ── Resize handle ── */}
      {copilotOpen && (
        <div
          className="canvas-copilot-resize"
          onMouseDown={onResizeStart}
          aria-hidden="true"
          role="separator"
          title="Drag to resize Copilot"
        />
      )}

      {/* ── Right Copilot panel ── */}
      <CopilotPanel
        isOpen={copilotOpen}
        onClose={toggleCopilot}
        companyId={companyId}
        activeSectionName={activeSectionName}
        activeEditor={activeEditor}
      />

      {/* ── Toast notifications ── */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
