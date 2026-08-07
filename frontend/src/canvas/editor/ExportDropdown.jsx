/**
 * ExportDropdown.jsx — Export section as PDF / DOCX / DRHP Draft.
 * P8: Replace single Export button with a dropdown menu.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Download, FileText, FileEdit, BookOpen, ChevronDown } from "lucide-react";
import * as canvasApi from "../services/canvasApi.js";

// `scope` matters: the old "Export DRHP Draft" option called the per-section
// endpoint, so it downloaded one section while its label promised the document.
const EXPORT_OPTIONS = [
  { id: "section_pdf",  label: "This section as PDF",   icon: FileText, fmt: "pdf",  scope: "section" },
  { id: "section_docx", label: "This section as DOCX",  icon: FileEdit, fmt: "docx", scope: "section" },
  { id: "full_docx",    label: "Full DRHP as DOCX",     icon: BookOpen, fmt: "docx", scope: "full" },
  { id: "full_pdf",     label: "Full DRHP as PDF",      icon: FileText, fmt: "pdf",  scope: "full" },
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
        let blob;
        let name;
        if (opt.scope === "full") {
          blob = await canvasApi.exportFull(companyId, opt.fmt);
          name = `DRHP_full.${opt.fmt}`;
        } else {
          const content = editor ? editor.getHTML() : "";
          blob = await canvasApi.exportSection(companyId, sectionName, content, opt.fmt);
          name = `${(sectionName || "section").replace(/[^a-z0-9]/gi, "_")}.${opt.fmt}`;
        }
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        setToast({ type: "success", msg: `${opt.label} downloaded` });
      } catch (e) {
        console.error('Export failed:', e);
        setToast({ type: "error", msg: `Export failed — ${e?.message ?? 'try again'}` });
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
          <><Download size={14} strokeWidth={2} /> Export</>
        )}
        <ChevronDown size={12} strokeWidth={2} className="export-dropdown__caret" aria-hidden="true" />
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
                <span className="export-dropdown__item-icon">
                  <opt.icon size={14} strokeWidth={1.5} />
                </span>
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
