/**
 * ExportDropdown.jsx — Export section as PDF / DOCX / DRHP Draft.
 * P8: Replace single Export button with a dropdown menu.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import * as canvasApi from "../services/canvasApi.js";

const EXPORT_OPTIONS = [
  { id: "pdf",        label: "Export PDF",        icon: "📄", fmt: "pdf"  },
  { id: "docx",       label: "Export DOCX",       icon: "📝", fmt: "docx" },
  { id: "drhp_draft", label: "Export DRHP Draft", icon: "📋", fmt: "pdf"  },
];

export default function ExportDropdown({ editor, companyId, sectionName }) {
  const [open, setOpen]   = useState(false);
  const [busy, setBusy]   = useState(null);
  const [toast, setToast] = useState(null);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleExport = useCallback(
    async (opt) => {
      setOpen(false);
      setBusy(opt.id);
      try {
        const content = editor ? editor.getHTML() : "";
        const blob = await canvasApi.exportSection(companyId, sectionName, content, opt.fmt);
        const ext  = opt.fmt === "docx" ? "docx" : "pdf";
        const name = `${(sectionName || "section").replace(/[^a-z0-9]/gi, "_")}.${ext}`;
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        setToast({ type: "success", msg: `${opt.label} downloaded` });
      } catch {
        setToast({ type: "error", msg: "Export failed — try again" });
      } finally {
        setBusy(null);
        setTimeout(() => setToast(null), 3000);
      }
    },
    [editor, companyId, sectionName]
  );

  return (
    <div className="export-dropdown" ref={menuRef}>
      <button
        type="button"
        className="btn btn-sm btn-secondary export-dropdown__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!!busy}
      >
        {busy ? (
          <>
            <span className="export-dropdown__spinner" aria-hidden="true" /> Exporting…
          </>
        ) : (
          <>⬇ Export</>
        )}
        <span className="export-dropdown__caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <ul
          className="export-dropdown__menu"
          role="menu"
          aria-label="Export options"
        >
          {EXPORT_OPTIONS.map((opt) => (
            <li key={opt.id} role="none">
              <button
                type="button"
                role="menuitem"
                className="export-dropdown__item"
                onClick={() => handleExport(opt)}
              >
                <span className="export-dropdown__item-icon">{opt.icon}</span>
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Inline mini toast */}
      {toast && (
        <div className={`export-dropdown__toast export-dropdown__toast--${toast.type}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
