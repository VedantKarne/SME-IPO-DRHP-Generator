import { useState, useRef, useCallback, useEffect } from "react";
import * as canvasApi from "../services/canvasApi.js";
import { markdownToTipTap } from "../editor/markdownToTipTap.js";
import useCanvasStore from "../services/canvasStore.js";
import useVersionStore from "../versions/versionStore.js";

/**
 * WholeDocPrompt.jsx
 *
 * Renders a prompt input bar that applies an AI instruction to the entire
 * section. Sits between AIToolbar and EditorPanel in the editor column.
 *
 * Props:
 *   editor      {object}  – TipTap editor instance
 *   companyId   {string}  – active company ID
 *   sectionName {string}  – active section name
 *
 * Requirements: 4.1, 4.2, 4.4, 4.5, 4.6
 */
export default function WholeDocPrompt({ editor, companyId, sectionName }) {
  const [promptText, setPromptText] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const appendPromptHistory = useCanvasStore((s) => s.appendPromptHistory);
  const addVersion = useVersionStore((s) => s.addVersion);

  // ---------------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    const trimmed = promptText.trim();
    if (!trimmed || !editor || loading) return;

    setLoading(true);

    try {
      const fullText = editor.getText();
      const response = await canvasApi.prompt(companyId, sectionName, trimmed, fullText);
      const responseText = response?.proposed_text ?? "";

      // Update editor content
      editor.commands.setContent(markdownToTipTap(responseText));

      // Create a version snapshot
      addVersion(companyId, sectionName, {
        id: crypto.randomUUID(),
        sectionName,
        label: `AI Prompt — ${trimmed.substring(0, 40)}`,
        timestamp: new Date().toISOString(),
        source: "ai_prompt",
        content: editor.getJSON(),
        authorLabel: "AI",
      });

      // Append to prompt history (newest-first prepend handled by the store)
      appendPromptHistory({
        id: crypto.randomUUID(),
        promptText: trimmed,
        sectionName,
        actionType: "whole-doc",
        timestamp: new Date().toISOString(),
      });

      // Retain the prompt text — user must clear it manually (Requirement 4.5)
    } catch {
      // canvasApi.prompt always returns a mock on failure, so this branch
      // should never be reached. Silently ignore as a safety net.
    } finally {
      setLoading(false);
      // Return focus to input after submission
      inputRef.current?.focus();
    }
  }, [promptText, editor, loading, companyId, sectionName, addVersion, appendPromptHistory]);

  // ---------------------------------------------------------------------------
  // Keyboard handling: Enter submits; Ctrl/Cmd+Enter also submits (Req 4.6)
  // Shift+Enter is allowed to pass through (newline in textarea if needed,
  // though this is a single-line input so it also submits — per design).
  // ---------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e) => {
      const isEnter = e.key === "Enter";
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (isEnter && (isCmdOrCtrl || !e.shiftKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // ---------------------------------------------------------------------------
  // Expose a programmatic "set and submit" function for SmartSuggestions
  // "Fix with AI" integration via a custom DOM event.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;

    const handler = (e) => {
      if (e.detail?.text) {
        setPromptText(e.detail.text);
        if (e.detail.autoSubmit) {
          // Defer so state update has flushed
          setTimeout(() => {
            // Trigger the parent form submit via the button — handled via
            // the closest form element.
            node.closest("form")?.requestSubmit?.();
          }, 0);
        }
      }
    };

    node.addEventListener("whole-doc-prompt:set", handler);
    return () => node.removeEventListener("whole-doc-prompt:set", handler);
  }, []);

  // ---------------------------------------------------------------------------
  // Form submit (triggered by button click or keyboard Enter on the form)
  // ---------------------------------------------------------------------------
  const handleFormSubmit = useCallback(
    (e) => {
      e.preventDefault();
      handleSubmit();
    },
    [handleSubmit]
  );

  return (
    <form
      className="whole-doc-prompt"
      onSubmit={handleFormSubmit}
      aria-label="Apply AI instruction to entire section"
    >
      {/* AI sparkle icon */}
      <span className="whole-doc-prompt__icon" aria-hidden="true">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
            fill="currentColor"
          />
          <path
            d="M19 14L19.75 16.75L22.5 17.5L19.75 18.25L19 21L18.25 18.25L15.5 17.5L18.25 16.75L19 14Z"
            fill="currentColor"
            opacity="0.7"
          />
          <path
            d="M5 4L5.5 6L7.5 6.5L5.5 7L5 9L4.5 7L2.5 6.5L4.5 6L5 4Z"
            fill="currentColor"
            opacity="0.5"
          />
        </svg>
      </span>

      {/* Text input */}
      <input
        ref={inputRef}
        type="text"
        className="whole-doc-prompt__input"
        placeholder="Apply AI instruction to entire section..."
        value={promptText}
        onChange={(e) => setPromptText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        aria-label="AI instruction for entire section"
        aria-busy={loading}
        autoComplete="off"
        spellCheck="true"
      />

      {/* Submit button */}
      <button
        type="submit"
        className={[
          "whole-doc-prompt__submit",
          loading ? "whole-doc-prompt__submit--loading" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={loading || !promptText.trim()}
        aria-label={loading ? "Applying AI instruction…" : "Apply AI instruction"}
        title={loading ? "Applying…" : "Apply (Enter)"}
      >
        {loading ? (
          /* Spinner */
          <svg
            className="whole-doc-prompt__spinner"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="42 14"
            />
          </svg>
        ) : (
          /* Arrow / send icon */
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <line
              x1="5"
              y1="12"
              x2="19"
              y2="12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="12 5 19 12 12 19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </form>
  );
}
