import { useCallback, useRef, useState } from "react";
import { Sparkles, AlertTriangle } from "lucide-react";
import * as canvasApi from "../services/canvasApi.js";
import useCanvasStore from "../services/canvasStore.js";
import useVersionStore from "../versions/versionStore.js";
import { markdownToTipTap } from "./markdownToTipTap.js";

// Individual toolbar button
function ToolbarButton({ onClick, title, active = false, disabled = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      className={[
        "ai-toolbar__btn",
        active ? "ai-toolbar__btn--active" : "",
        disabled ? "ai-toolbar__btn--disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

// AI Action button — sparkle prefix, accent colours
function AIActionButton({ onClick, title, loading = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={loading}
      className="ai-toolbar__ai-btn"
    >
      {loading ? (
        <span className="ai-toolbar__ai-spinner" aria-hidden="true" />
      ) : (
        <span className="ai-toolbar__ai-sparkle" aria-hidden="true">
          <Sparkles size={12} strokeWidth={2} />
        </span>
      )}
      {children}
    </button>
  );
}

// Visual separator between groups
function Divider() {
  return <span className="ai-toolbar__divider" aria-hidden="true" />;
}

// Thicker divider between AI group and formatting group
function GroupDivider() {
  return <span className="ai-toolbar__group-divider" aria-hidden="true" />;
}

// AIToolbar expects a TipTap `editor` instance as a prop
// Also accepts companyId / sectionName for AI actions
export default function AIToolbar({ editor, companyId = "", sectionName = "" }) {
  const imageInputRef = useRef(null);
  const [loadingAction, setLoadingAction] = useState(null);
  const [actionError, setActionError] = useState(null);

  const addVersion = useVersionStore((s) => s.addVersion);

  // --- AI Actions ---
  const handleAIAction = useCallback(
    async (action, label) => {
      if (!editor || loadingAction) return;
      setLoadingAction(action);
      try {
        const selectedText = editor.state.selection.empty
          ? editor.getText()
          : editor.state.doc.textBetween(
              editor.state.selection.from,
              editor.state.selection.to,
              " "
            );
        const result = await canvasApi.rewrite(companyId, sectionName, selectedText, action);
        const proposed = result?.proposed_text;
        if (!proposed) throw new Error('the AI returned an empty rewrite');
        if (!editor.state.selection.empty) {
          editor.chain().focus().deleteSelection().insertContent(proposed).run();
        } else {
          editor.commands.setContent(markdownToTipTap(proposed));
        }
        await addVersion(companyId, sectionName, {
          id: crypto.randomUUID(),
          sectionName,
          label: `AI Toolbar — ${label}`,
          timestamp: new Date().toISOString(),
          source: "ai_rewrite",
          content: editor.getJSON(),
          authorLabel: "AI",
        });
        setActionError(null);
      } catch (e) {
        // There was no catch here at all, so a failure left the toolbar
        // spinner clearing with no other visible effect.
        console.error(`AI toolbar action "${action}" failed:`, e);
        setActionError(`${label} failed — ${e?.message ?? 'the request failed'}`);
      } finally {
        setLoadingAction(null);
      }
    },
    [editor, loadingAction, companyId, sectionName, addVersion]
  );

  // --- Image handlers ---
  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file || !editor) return;

      const reader = new FileReader();
      reader.onload = () => {
        editor.chain().focus().setImage({ src: reader.result, alt: file.name }).run();
      };
      reader.readAsDataURL(file);
      e.target.value = ""; // allow re-selecting the same file
    },
    [editor]
  );

  const handleImageUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  // --- Table insert ---
  const handleInsertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  if (!editor) return null;

  const inTable = editor.isActive("table");

  return (
    <div className="ai-toolbar" role="toolbar" aria-label="AI and formatting toolbar">
      {/* Failure notice — the draft is left untouched when this appears */}
      {actionError && (
        <div className="ai-toolbar__error" role="alert">
          <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" /> {actionError}
        </div>
      )}

      {/* ── AI Actions (P4) ────────────────────────────────────────── */}
      <AIActionButton
        onClick={() => handleAIAction("rewrite", "Rewrite")}
        title="AI Rewrite — rewrite selected text"
        loading={loadingAction === "rewrite"}
      >
        Rewrite
      </AIActionButton>

      <AIActionButton
        onClick={() => handleAIAction("expand", "Expand")}
        title="AI Expand — expand selected text"
        loading={loadingAction === "expand"}
      >
        Expand
      </AIActionButton>

      <AIActionButton
        onClick={() => handleAIAction("investor_friendly", "Investor Friendly")}
        title="Investor Friendly — optimise for investors"
        loading={loadingAction === "investor_friendly"}
      >
        Investor Friendly
      </AIActionButton>

      <AIActionButton
        onClick={() => handleAIAction("professional", "Professional")}
        title="Professional — make tone formal and precise"
        loading={loadingAction === "professional"}
      >
        Professional
      </AIActionButton>

      <AIActionButton
        onClick={() => handleAIAction("simplify", "Simplify")}
        title="Simplify — make text clearer"
        loading={loadingAction === "simplify"}
      >
        Simplify
      </AIActionButton>

      <AIActionButton
        onClick={() => handleAIAction("cite", "Cite Evidence")}
        title="Cite Evidence — add regulatory citations"
        loading={loadingAction === "cite"}
      >
        Cite Evidence
      </AIActionButton>

      <GroupDivider />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
        active={editor.isActive("bold")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 4h8a4 4 0 0 1 0 8H6V4zm0 8h9a4 4 0 0 1 0 8H6v-8z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
        active={editor.isActive("italic")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <line x1="19" y1="4" x2="10" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="14" y1="20" x2="5" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="15" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
        active={editor.isActive("underline")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 4v6a6 6 0 0 0 12 0V4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line x1="4" y1="20" x2="20" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </ToolbarButton>

      <Divider />

      {/* ── Headings ───────────────────────────────────────────────── */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
      >
        H1
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
      >
        H2
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
      >
        H3
      </ToolbarButton>

      <Divider />

      {/* ── Lists ──────────────────────────────────────────────────── */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
        active={editor.isActive("bulletList")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="4" cy="6" r="1.5" fill="currentColor" />
          <circle cx="4" cy="12" r="1.5" fill="currentColor" />
          <circle cx="4" cy="18" r="1.5" fill="currentColor" />
          <line x1="8" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="8" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
        active={editor.isActive("orderedList")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <line x1="10" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="10" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="10" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <text x="2" y="7" fontSize="6" fill="currentColor">1</text>
          <text x="2" y="13" fontSize="6" fill="currentColor">2</text>
          <text x="2" y="19" fontSize="6" fill="currentColor">3</text>
        </svg>
      </ToolbarButton>

      <Divider />

      {/* ── Table ──────────────────────────────────────────────────── */}
      <ToolbarButton onClick={handleInsertTable} title="Insert table">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
          <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="2" />
          <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="2" />
          <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="2" />
          <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="2" />
        </svg>
      </ToolbarButton>

      {/* Contextual table controls — visible only when cursor is inside a table */}
      {inTable && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add column after"
          >
            +C
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete column"
          >
            −C
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add row after"
          >
            +R
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete row"
          >
            −R
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete table"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </ToolbarButton>
        </>
      )}

      <Divider />

      {/* ── Image ──────────────────────────────────────────────────── */}
      <ToolbarButton
        onClick={() => imageInputRef.current?.click()}
        title="Upload image"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
          <polyline
            points="21 15 16 10 5 21"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>

      <ToolbarButton onClick={handleImageUrl} title="Insert image from URL">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <Divider />

      {/* ── History ────────────────────────────────────────────────── */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        title="Undo"
        disabled={!editor.can().undo()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <polyline
            points="1 4 1 10 7 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3.51 15a9 9 0 1 0 .49-4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        title="Redo"
        disabled={!editor.can().redo()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <polyline
            points="23 4 23 10 17 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20.49 15a9 9 0 1 1-.49-4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </ToolbarButton>
    </div>
  );
}
