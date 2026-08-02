# Requirements Document

## Introduction

The AI Authoring Canvas is the hero feature of the SME IPO DRHP Generator hackathon MVP. It replaces the existing `/workspace` route with a professional, multi-panel document authoring environment combining a TipTap-powered rich text editor, a ChatGPT Canvas-style AI rewrite workflow (text selection → AI popup → side-by-side diff viewer → Accept/Reject), a whole-document AI prompt bar, a context-aware AI side chat, version history, an evidence panel, and DOCX/PDF export. The Canvas reuses the existing `AppShell` and navigation and operates over the 25 SEBI DRHP sections already defined in the system. All backend calls degrade gracefully to mocked responses so that the full demo flow works end-to-end regardless of backend availability. The primary success criterion is that a judge can complete all 10 steps of the judge workflow without interruption.

The following are explicitly out of scope for this MVP: real-time collaboration, multi-user editing, live cursors, background synchronisation, complex dependency graphs, streaming AI responses, an advanced notification system, enterprise authentication, and production-grade audit infrastructure.

## Glossary

- **Canvas**: The AI Authoring Canvas component (`CanvasRoot`) mounted at the `/workspace` route, replacing `Workspace.jsx`.
- **Editor**: The TipTap-based rich text editing surface rendered as the central panel of the Canvas.
- **AI Panel**: The right-hand panel containing the AI Side Chat, Evidence Panel, and Version History sub-panels.
- **Section Sidebar**: The left-hand panel listing all 25 SEBI DRHP sections with status indicators.
- **AI Toolbar**: The docked toolbar exposing text-formatting actions, AI action buttons, and the Export dropdown.
- **Rewrite Popup**: The floating contextual menu that appears when the user selects text inside the Editor, offering six AI actions: Rewrite, Expand, Simplify, Professional, Investor-Friendly, and Custom Prompt.
- **Diff Viewer**: The modal overlay rendered via `react-diff-view` that displays a side-by-side or unified diff between the original text and an AI-proposed replacement.
- **Version Store**: The Zustand store managing the ordered list of Version entries per section.
- **Version**: An immutable snapshot of a section's full TipTap document JSON captured after each AI edit, manual save, or approval action.
- **Evidence Panel**: The sub-panel displaying citation cards with regulation reference, chapter, source document, page, and confidence score. Data may be mocked if the backend is unavailable.
- **AI Side Chat**: The context-aware chat sub-panel scoped to the active section, the active company, and the current draft content.
- **Prompt History**: The session-scoped log of all AI prompts submitted, rendered with timestamps and a re-apply action.
- **Export Service**: The frontend module that calls backend endpoints to produce DOCX and PDF downloads of the full DRHP or a single section.
- **Section**: One of the 25 named SEBI DRHP content blocks, carrying an `id`, `name`, `status`, `draft_text`, `score`, `locked`, and `flagged_gaps` payload.
- **TipTap**: The open-source headless rich text editor framework (`@tiptap/react` + `@tiptap/starter-kit` plus extension packages).
- **Zustand Store**: The client-side state management store holding Canvas UI state and the Version Store.
- **TanStack Query**: The `@tanstack/react-query` data-fetching layer used for all backend API calls within the Canvas.
- **Framer Motion**: The animation library used for panel transitions and popup animations.
- **Backend**: The FastAPI server running at `http://localhost:8000`.
- **Mock Response**: A hardcoded simulated response returned by the frontend when a backend endpoint is unavailable or returns a non-2xx status, ensuring uninterrupted demo continuity.
- **AppShell**: The existing global layout component providing sidebar navigation and the Copilot Rail; the Canvas renders as its `children` prop.
- **DRHP**: Draft Red Herring Prospectus — the regulatory filing document for an SME IPO under SEBI ICDR regulations.
- **SEBI**: Securities and Exchange Board of India.
- **ICDR**: SEBI (Issue of Capital and Disclosure Requirements) Regulations, 2018.

---

## Requirements

### Requirement 1 — UI Shell and Panel Layout

**User Story:** As a judge evaluating the demo, I want a structured three-panel Canvas layout inside the existing AppShell so that I can navigate between sections, edit content, and use AI tools in a single view.

#### Acceptance Criteria

1. THE Canvas SHALL render a three-panel layout consisting of the Section Sidebar (left, 220 px), the Editor (center, flexible), and the AI Panel (right, 320 px), all inside the AppShell `children` slot at the `/workspace` route.
2. THE Canvas SHALL replace `Workspace.jsx` as the component mounted on the `/workspace` route in `App.jsx` while preserving all existing `AppShell` navigation and styling.
3. THE Section Sidebar SHALL display all 25 SEBI DRHP section names in the order defined by the existing `SECTIONS_25` array.
4. WHEN a section is selected in the Section Sidebar, THE Canvas SHALL load that section's content into the Editor and update the active section index in the Zustand Store.
5. THE Section Sidebar SHALL display a status indicator next to each section name: a hollow circle (`○`) for sections with no draft, a tilde (`~`) for sections with a draft that is not locked, and a checkmark (`✓`) for locked or approved sections.
6. THE Canvas SHALL source all section data via TanStack Query fetching `GET /api/sections/{company_id}` on mount; IF the endpoint is unavailable or returns a non-2xx status, THEN THE Canvas SHALL populate the Section Sidebar with the `SECTIONS_25` stub array as the Mock Response.
7. WHERE the viewport is narrower than 1024 CSS pixels, THE Canvas SHALL render the Section Sidebar and AI Panel as drawer overlays toggled by floating buttons, preserving the Editor as the primary visible surface.
8. THE Canvas SHALL initialise the Zustand Store with `companyId`, `companyName`, the merged section list, the active section index, and the AI Panel sub-panel visibility flags on mount.
9. THE Canvas layout SHALL use the project's existing CSS variables (`--accent`, `--glass-bg`, `--glass-border`, `--text-primary`, `--text-secondary`, `--text-muted`, `--success`, `--warning`, `--error`) for all colour values.

---

### Requirement 2 — Rich Text Editor

**User Story:** As a document author, I want a full-featured rich text editor so that I can format DRHP section content with headings, lists, tables, and images without leaving the Canvas.

#### Acceptance Criteria

1. THE Editor SHALL initialise a TipTap instance with `@tiptap/starter-kit`, `@tiptap/extension-highlight`, `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-header`, `@tiptap/extension-table-cell`, and `@tiptap/extension-image` extensions loaded.
2. THE AI Toolbar SHALL expose buttons for Bold, Italic, Underline, Strikethrough, Heading 1, Heading 2, Heading 3, Bullet List, Ordered List, Blockquote, Code Block, Insert Table, Insert Image, Undo, and Redo.
3. WHEN the user clicks an AI Toolbar formatting button, THE Editor SHALL apply the corresponding TipTap chain command to the current selection or cursor position, and the button SHALL display an active state when `editor.isActive()` returns `true` for that mark or node.
4. THE Editor SHALL load a section's `draft_text` Markdown by converting it to TipTap JSON via a `markdownToTipTap` utility function when the user selects a section; IF `markdownToTipTap` fails to parse the string, THEN THE Editor SHALL fall back to a single-paragraph TipTap document containing the raw string.
5. WHEN the Editor content changes and the user has not interacted for 2000 milliseconds, THE Canvas SHALL auto-save the current TipTap JSON to the Zustand Store for the active section.
6. THE Editor SHALL render tables with visible cell borders, column headers, and a right-click context menu on table cells offering "Delete Row" and "Delete Column" actions.
7. WHEN an image is inserted via the Insert Image toolbar button, THE Editor SHALL open a file picker accepting `.png`, `.jpg`, `.jpeg`, `.gif`, and `.webp` files up to 5 MB, attempt to upload the file to `POST /api/canvas/upload-image`, and insert the returned URL as a TipTap Image node; IF the upload endpoint is unavailable, THEN THE Editor SHALL insert a base64 data URI of the selected file as the Mock Response.
8. THE Editor surface SHALL support standard keyboard shortcuts for formatting: `Ctrl+B` / `Cmd+B` for Bold, `Ctrl+I` / `Cmd+I` for Italic, `Ctrl+U` / `Cmd+U` for Underline.

---

### Requirement 3 — AI Canvas: Selection-Triggered Rewrite (Primary Feature)

**User Story:** As a judge evaluating the demo, I want to highlight any text in the editor and trigger AI rewrite actions so that I can improve specific passages and see the changes in a diff viewer before accepting or rejecting them.

*This is the primary feature of the Canvas and has the highest implementation priority.*

#### Acceptance Criteria

1. WHEN the user selects one or more characters inside the Editor, THE Canvas SHALL display the Rewrite Popup adjacent to the selected text offering six action buttons: Rewrite, Expand, Simplify, Professional, Investor-Friendly, and Custom Prompt.
2. WHEN the user clicks one of the five named action buttons (Rewrite, Expand, Simplify, Professional, Investor-Friendly) in the Rewrite Popup, THE Canvas SHALL send a `POST /api/canvas/rewrite` request with payload `{ company_id, section_name, selected_text, action }` where `action` is the lowercase snake-case equivalent of the button label.
3. WHEN the user clicks the "Custom Prompt" action button in the Rewrite Popup, THE Canvas SHALL display an inline text input field within the Rewrite Popup where the user can type a free-form instruction, and upon submission SHALL send the same `POST /api/canvas/rewrite` request with `action` set to `"custom"` and an additional `custom_instruction` field containing the typed instruction.
4. IF the `POST /api/canvas/rewrite` endpoint returns a non-2xx status or is unreachable, THEN THE Canvas SHALL generate a Mock Response by appending `" [AI-enhanced: {action}]"` to the selected text and proceed as if the backend responded successfully.
5. WHEN the backend (or Mock Response) returns a proposed replacement text, THE Canvas SHALL render the Diff Viewer displaying the original selected text and the proposed replacement in a unified diff format using `react-diff-view`.
6. WHEN the user clicks "Accept" in the Diff Viewer, THE Canvas SHALL replace the selected text range in the Editor with the proposed replacement, close the Diff Viewer, dismiss the Rewrite Popup, and create a new Version entry in the Version Store with `source` set to `"ai_rewrite"`.
7. WHEN the user clicks "Reject" in the Diff Viewer, THE Canvas SHALL close the Diff Viewer and restore the Editor to its pre-action state without modifying the document content or the Version Store.
8. THE Rewrite Popup SHALL dismiss automatically WHEN the user clicks outside of it or presses `Escape`.
9. WHILE an AI rewrite request is in-flight, THE Rewrite Popup SHALL display a loading spinner on the active action button and disable all other action buttons.
10. THE Rewrite Popup SHALL reposition to the opposite side of the selection IF the selected text is within 120 CSS pixels of the right or bottom edge of the viewport.
11. WHEN the active section has `locked` set to `true`, THE Canvas SHALL hide the Rewrite Popup trigger and display an "Approved & Locked" badge in the Editor instead.

---

### Requirement 4 — Whole-Document Prompt Editing

**User Story:** As a document author, I want to submit a free-text AI instruction that applies to the entire active section so that I can restructure or tone-shift a full section in one command.

#### Acceptance Criteria

1. THE Canvas SHALL render a Whole-Document Prompt input bar between the AI Toolbar and the Editor surface.
2. WHEN the user types a prompt in the Whole-Document Prompt input and presses Enter or clicks the submit button, THE Canvas SHALL send `POST /api/canvas/prompt` with payload `{ company_id, section_name, prompt, full_text }` where `full_text` is the current TipTap plaintext export of the Editor via `editor.getText()`.
3. IF the `POST /api/canvas/prompt` endpoint returns a non-2xx status or is unreachable, THEN THE Canvas SHALL generate a Mock Response returning `"[Whole-doc AI edit applied: {prompt}]\n\n{full_text}"` and proceed as if the backend responded successfully.
4. WHEN the backend (or Mock Response) returns updated full text, THE Canvas SHALL update the Editor content, create a new Version entry with `source` set to `"ai_prompt"`, and append the prompt to the Prompt History.
5. WHILE a Whole-Document Prompt request is in-flight, THE submit button SHALL display a loading spinner and the Whole-Document Prompt input SHALL be disabled.
6. THE Whole-Document Prompt input SHALL retain the last submitted prompt text until the user clears it manually.
7. THE Canvas SHALL support `Ctrl+Enter` / `Cmd+Enter` as a keyboard shortcut to submit the Whole-Document Prompt.

---

### Requirement 5 — AI Side Chat

**User Story:** As a judge evaluating the demo, I want a context-aware chat panel scoped to the active section so that I can ask questions and request targeted edits without leaving the Canvas.

#### Acceptance Criteria

1. THE AI Side Chat sub-panel SHALL display a scrollable message thread with alternating user and AI message bubbles.
2. WHEN the user submits a message in the AI Side Chat, THE Canvas SHALL send `POST /api/copilot/ask` with payload `{ company_id, current_section, question }` where `current_section` is the active section name.
3. THE AI Side Chat payload SHALL also include `context` containing the current Editor plaintext (via `editor.getText()`) so that the AI response is grounded in the section's current draft content.
4. IF the `POST /api/copilot/ask` endpoint returns a non-2xx status or is unreachable, THEN THE Canvas SHALL display a Mock Response message: `"I'm operating in offline mode. The backend is not currently reachable."`.
5. THE AI Side Chat SHALL pre-populate with the message `"Select a section and ask me to refine it. E.g., 'Make this more investor-friendly' or 'Add a paragraph about exports.'"` as the initial AI bubble on first render.
6. THE AI Side Chat SHALL include four quick-prompt chips: "Make this more professional", "Shorter and punchier", "Add investor-friendly language", and "Explain the regulations for this section".
7. WHEN the user clicks a quick-prompt chip, THE Canvas SHALL populate the chat input with the chip text and submit it immediately.
8. WHILE a chat request is in-flight, THE AI Side Chat SHALL display a typing indicator (three animated dots) and disable the submit button.
9. THE AI Side Chat SHALL automatically scroll to the most recently added message after each message is appended to the thread.

---

### Requirement 6 — Version History

**User Story:** As a judge evaluating the demo, I want to view, compare, and restore earlier drafts so that I can audit AI changes and roll back to any prior state of a section.

#### Acceptance Criteria

1. THE Version Store SHALL maintain an ordered list of Version entries per section; each Version entry SHALL contain: `id` (UUID), `sectionName` (string), `label` (string), `timestamp` (ISO 8601 string), `source` (one of `"ai_rewrite"`, `"ai_prompt"`, `"manual_save"`, `"ai_chat"`, `"approval"`), `content` (TipTap JSON snapshot), and `authorLabel` (`"AI"` or `"User"`).
2. WHEN an AI rewrite action is accepted, THE Canvas SHALL create a Version entry with `source` set to `"ai_rewrite"` and `label` set to `"AI Rewrite — {action}"` (action capitalised).
3. WHEN a Whole-Document Prompt completes successfully (real or mocked), THE Canvas SHALL create a Version entry with `source` set to `"ai_prompt"` and `label` set to `"AI Prompt — {prompt truncated to 40 characters}"`.
4. WHEN the user manually saves using `Ctrl+S` / `Cmd+S`, THE Canvas SHALL create a Version entry with `source` set to `"manual_save"` and `label` set to `"Manual Save"`.
5. WHEN the user approves and locks a section, THE Canvas SHALL create a Version entry with `source` set to `"approval"` and `label` set to `"Approved & Locked"`.
6. THE Version Store SHALL retain at most 50 Version entries per section, discarding the oldest entry when the limit is exceeded.
7. THE Canvas SHALL render a Version History sub-panel listing all Version entries for the active section sorted by `timestamp` descending, displaying the `label` and a human-readable relative timestamp for each entry.
8. WHEN the user clicks a Version entry in the Version History sub-panel, THE Canvas SHALL load that Version's `content` snapshot into the Editor as a read-only preview and highlight the selected entry row.
9. WHEN the user clicks "Restore" while previewing a Version, THE Canvas SHALL set the Editor back to editable, replace the live Editor content with that Version's `content` snapshot, and create a new Version entry with `label` set to `"Restored from: {original label}"`.
10. THE Version History sub-panel header SHALL display a badge showing the total count of Version entries for the active section.

---

### Requirement 7 — Diff Viewer

**User Story:** As a judge evaluating the demo, I want to see a visual diff between the original and AI-proposed text before accepting any change so that I can make informed decisions about every AI suggestion.

#### Acceptance Criteria

1. THE Diff Viewer SHALL render using the `react-diff-view` library in unified diff format, generating the diff string from the original and proposed texts using the `unidiff` package.
2. THE Diff Viewer SHALL display removed lines with a red-tinted background and added lines with a green-tinted background, consistent with the project's `--error-dim` and `--success-dim` CSS variables.
3. THE Diff Viewer SHALL be presented in a modal overlay with a semi-transparent backdrop and a Framer Motion entrance animation.
4. THE Diff Viewer modal footer SHALL include an "Accept" button (primary style), a "Reject" button (secondary style), and a "Copy Proposed" button (secondary style).
5. WHEN the user clicks "Copy Proposed", THE Canvas SHALL write the proposed replacement text to the system clipboard and display a transient "Copied!" tooltip for 2000 milliseconds.
6. THE Diff Viewer SHALL support keyboard navigation: pressing `Enter` SHALL trigger Accept and pressing `Escape` SHALL trigger Reject.
7. THE Diff Viewer modal header SHALL display the active section name and the action label (e.g., "Rewrite — Investor-Friendly").
8. THE Diff Viewer SHALL be triggered from both the Rewrite Popup flow (Requirement 3) and the Inline AI palette flow (Requirement 8).

---

### Requirement 8 — Inline AI (⌘K)

**User Story:** As a document author, I want to trigger an inline AI command palette at the cursor position so that I can apply targeted natural-language instructions without interrupting my editing flow.

#### Acceptance Criteria

1. WHEN the user presses `Ctrl+K` / `Cmd+K` while the Editor is focused, THE Canvas SHALL render the Inline AI command palette positioned immediately below the current cursor line.
2. THE Inline AI command palette SHALL display a floating input field with placeholder text "Ask AI to do anything...".
3. WHEN the user types an instruction and presses Enter, THE Canvas SHALL send `POST /api/canvas/inline-ai` with payload `{ company_id, section_name, instruction, context_text }` where `context_text` is the full text of the paragraph node containing the cursor at the time the palette was opened.
4. IF the `POST /api/canvas/inline-ai` endpoint is unavailable or returns a non-2xx status, THEN THE Canvas SHALL generate a Mock Response by prepending `"[Inline AI: {instruction}] "` to the `context_text` and treat that as the proposed replacement.
5. WHEN the Inline AI response is received, THE Canvas SHALL render the Diff Viewer with the original `context_text` and the proposed replacement; the Accept/Reject flow SHALL proceed identically to Requirement 3 acceptance criteria 6 and 7.
6. THE Inline AI command palette SHALL dismiss WHEN the user presses `Escape` or clicks outside of it.
7. WHILE an Inline AI request is in-flight, THE Inline AI command palette SHALL display a loading spinner and disable the submit action.

---

### Requirement 9 — Evidence Panel

**User Story:** As a judge evaluating the demo, I want citation cards with regulation references, page numbers, and confidence scores for the active section so that I can verify that the generated content is grounded in SEBI regulations.

#### Acceptance Criteria

1. THE Evidence Panel sub-panel SHALL fetch citation data from `GET /api/canvas/evidence/{company_id}/{section_name}` via TanStack Query, and SHALL refetch automatically WHEN the active section changes.
2. IF the evidence endpoint is unavailable or returns a non-2xx status, THEN THE Evidence Panel SHALL render Mock Response citation cards derived from the `EVIDENCE_MAP` stubs (`Reg 229`, `Reg 237`, `Reg 238`, `Reg 233`), ensuring the Evidence Panel displays populated data regardless of backend availability.
3. EACH citation card SHALL display all five fields: source document name, regulation number, chapter name, page reference, and confidence score as a percentage string (e.g., `"97%"`).
4. THE Evidence Panel SHALL display a "✅ Verified against regulatory corpus" badge on any citation card whose confidence score is 90% or higher.
5. WHEN the user clicks a citation card, THE Canvas SHALL clear any existing TipTap Highlight marks and apply a yellow Highlight mark to all Editor text spans matching the pattern `[Reg {number} | ICDR...]`.
6. THE Evidence Panel SHALL display an empty-state message "No citations available for this section." WHEN the citations list is empty.

---

### Requirement 10 — Export (DOCX and PDF)

**User Story:** As a judge evaluating the demo, I want to export the complete DRHP document or a single section as DOCX or PDF so that I can receive a formatted, filing-ready document.

#### Acceptance Criteria

1. THE AI Toolbar SHALL include an "Export" button that opens a dropdown offering four options: "Export Section as DOCX", "Export Section as PDF", "Export Full DRHP as DOCX", and "Export Full DRHP as PDF".
2. WHEN the user selects "Export Section as DOCX", THE Canvas SHALL send `POST /api/export/section/docx` with payload `{ company_id, section_name, content }` where `content` is `editor.getHTML()`, and download the returned file as `{section_name}.docx`.
3. WHEN the user selects "Export Section as PDF", THE Canvas SHALL send `POST /api/export/section/pdf` with the same payload and download the returned file as `{section_name}.pdf`.
4. WHEN the user selects "Export Full DRHP as DOCX", THE Canvas SHALL send `POST /api/export/full/docx` with payload `{ company_id }` and download the returned file as `DRHP_{company_name}.docx`.
5. WHEN the user selects "Export Full DRHP as PDF", THE Canvas SHALL send `POST /api/export/full/pdf` with payload `{ company_id }` and download the returned file as `DRHP_{company_name}.pdf`.
6. IF any export endpoint returns a non-2xx status or is unreachable, THEN THE Canvas SHALL generate a plain-text `Blob` from `editor.getText()` and trigger a browser download with the same filename but a `.txt` extension as the Mock Response.
7. WHILE an export request is in-flight, THE Export button SHALL display a loading spinner and all dropdown options SHALL be disabled.
8. WHEN an export completes with a 2xx response, THE Canvas SHALL display a success toast "Export complete" for 3000 milliseconds.
9. WHEN an export fails and the Mock Response fallback is triggered, THE Canvas SHALL display a warning toast "Backend unavailable — exported as plain text" for 3000 milliseconds.

---

### Requirement 11 — Autosave

**User Story:** As a document author, I want the Canvas to save my work automatically so that I never lose content due to an accidental navigation or browser close.

#### Acceptance Criteria

1. WHEN the Editor content changes and the user has not made further edits for 2000 milliseconds, THE Canvas SHALL write the current TipTap JSON to the Zustand Store for the active section as an autosave operation.
2. THE autosave operation SHALL NOT create a Version entry in the Version Store; only explicit saves (`Ctrl+S` / `Cmd+S`) and AI-triggered edits SHALL create Version entries.
3. WHEN the user switches between sections, THE Canvas SHALL load the most recently autosaved TipTap JSON for the newly selected section from the Zustand Store.

---

### Requirement 12 — Keyboard Shortcuts

**User Story:** As a power user, I want keyboard shortcuts for all major Canvas actions so that I can work efficiently without reaching for the mouse.

#### Acceptance Criteria

1. THE Canvas SHALL support the following keyboard shortcuts globally while the Canvas is mounted:
   - `Ctrl+S` / `Cmd+S`: Create a `"manual_save"` Version entry.
   - `Ctrl+K` / `Cmd+K`: Open the Inline AI command palette (per Requirement 8).
   - `Ctrl+Z` / `Cmd+Z`: Undo within TipTap's history stack.
   - `Ctrl+Shift+Z` / `Cmd+Shift+Z`: Redo within TipTap's history stack.
   - `Ctrl+Enter` / `Cmd+Enter`: Submit the Whole-Document Prompt.
   - `Escape`: Dismiss the active modal, popup, or palette in priority order (Inline AI palette → Diff Viewer → Rewrite Popup → Shortcuts modal).
2. THE Canvas SHALL prevent default browser behaviour for `Ctrl+S` / `Cmd+S` to avoid triggering the browser's native file save dialog.
3. THE AI Toolbar SHALL include a "Shortcuts" button that opens a Keyboard Shortcuts help modal listing all shortcuts in a two-column table.
4. THE Shortcuts help modal SHALL dismiss WHEN the user presses `Escape` or clicks outside of the modal.

---

### Requirement 13 — Demo Flow and Judge Workflow

**User Story:** As a judge evaluating the demo, I want to complete all 10 steps of the judge workflow end-to-end so that I can assess the full capabilities of the AI Authoring Canvas.

#### Acceptance Criteria

1. THE Canvas SHALL allow a judge to complete all 10 steps of the judge workflow without any step failing due to a missing backend response:
   - Step 1 — Open an IPO section: THE Canvas SHALL load a section into the Editor within 2000 milliseconds of section selection (using real or Mock Response section data).
   - Step 2 — Generate an AI draft: THE Canvas SHALL populate the Editor with AI-generated draft text via the Whole-Document Prompt (using real or Mock Response).
   - Step 3 — Manually edit the document: THE Editor SHALL accept and persist keyboard input from the judge.
   - Step 4 — Highlight a paragraph and improve it with AI: THE Rewrite Popup SHALL appear and offer all six action buttons on any text selection.
   - Step 5 — Review proposed changes in a diff viewer: THE Diff Viewer SHALL display after any Rewrite Popup action is submitted (using real or Mock Response).
   - Step 6 — Accept or reject the changes: THE Diff Viewer SHALL respond to the judge's Accept or Reject action and update or preserve the Editor content accordingly.
   - Step 7 — View version history: THE Version History sub-panel SHALL display a list of Version entries reflecting all prior AI and manual edits in the session.
   - Step 8 — View evidence for generated content: THE Evidence Panel SHALL display populated citation cards (using real data or `EVIDENCE_MAP` Mock Response).
   - Step 9 — Chat with the AI about the current section: THE AI Side Chat SHALL accept a message and return a response (using real or Mock Response).
   - Step 10 — Export the final document: THE Export dropdown SHALL trigger a file download for the judge's selected format (using real endpoint or plain-text Mock Response).
2. THE Canvas SHALL display a non-blocking toast "Backend offline — using demo mode" the first time any critical API call fails during the session, and SHALL suppress repeated offline toasts for the remainder of the session.
3. WHEN the Canvas mounts and `GET /api/demo/company` returns a valid `company_id`, THE Canvas SHALL use that `company_id` for all subsequent API calls.
4. WHEN the Canvas mounts and `GET /api/sections/{company_id}` returns a non-empty array, THE Canvas SHALL pre-populate the Section Sidebar with the returned section data, including `draft_text`, `score`, `locked`, and `flagged_gaps` values.
5. THE Canvas SHALL install the following npm packages as production dependencies in `frontend/package.json`: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-highlight`, `@tiptap/extension-table`, `@tiptap/extension-image`, `framer-motion`, `react-diff-view`, `unidiff`, `zustand`, and `@tanstack/react-query`.

---

### Requirement 14 — Prompt History

**User Story:** As a document author, I want a session-scoped log of all AI prompts I have submitted so that I can review past instructions and re-apply useful ones.

#### Acceptance Criteria

1. THE Prompt History sub-panel SHALL display a scrollable list of all prompts submitted during the current session, sorted by `timestamp` descending (newest first).
2. EACH Prompt History entry SHALL display: the prompt text (truncated to 80 characters with an ellipsis if longer), the section name the prompt was applied to, the action type, and a human-readable relative timestamp.
3. WHEN the user clicks "Re-apply" on a Prompt History entry, THE Canvas SHALL resubmit that entry's prompt text against the currently active section and handle the response identically to a new prompt submission.
4. THE Prompt History sub-panel SHALL display the message "No prompts yet in this session." WHEN the Prompt History list is empty.
5. THE Canvas SHALL store the Prompt History list in the Zustand Store for the duration of the browser session.
