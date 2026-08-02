# Implementation Plan: AI Authoring Canvas

## Overview

Build the AI Authoring Canvas in React (JSX) as the hero feature of the SME IPO DRHP Generator. The Canvas replaces the `/workspace` route with a three-panel layout — Section Sidebar, TipTap Editor, and AI Panel — integrating AI rewrite, inline commands, whole-document prompts, version control, evidence citations, smart suggestions, a diff viewer, keyboard shortcuts, and a full export pipeline. All backend calls degrade gracefully to mock responses so the demo works end-to-end.

All implementation lives under `frontend/src/canvas/`. The language is React 19 + JSX (Vite project).

## Tasks

- [x] 1. Install dependencies and scaffold the canvas directory structure
  - Run `npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-highlight @tiptap/extension-table @tiptap/extension-image framer-motion react-diff-view unidiff zustand @tanstack/react-query` inside `frontend/`
  - Create the directory tree: `frontend/src/canvas/` with sub-folders `editor/`, `prompt/`, `copilot/`, `versions/`, `evidence/`, `diff/`, `toolbar/`, `shortcuts/`, `services/`
  - Create placeholder `index.js` barrel exports in each sub-folder so later imports resolve
  - _Requirements: 14.5_

- [x] 2. Implement the `canvasApi.js` service layer with mock fallbacks
  - [x] 2.1 Create `frontend/src/canvas/services/canvasApi.js` with all API functions
    - Implement `getSections`, `rewrite`, `prompt`, `inlineAI`, `copilotAsk`, `getEvidence`, `getSuggestions`, `uploadImage`, `exportSection`, `exportFull`
    - Each function wraps its `fetch` call in try/catch; on any non-2xx or network error, return the mock response defined in the design
    - Export a single `API_BASE = 'http://localhost:8000'` constant used by all functions
    - _Requirements: 3.3, 4.3, 5.3, 9.2, 10.2, 11.4, 13.6, 14.1_
  - [ ]* 2.2 Write property test for `canvasApi` mock fallback behaviour (Property 38)
    - **Property 38: Canvas never throws on API failures**
    - **Validates: Requirements 14.1**
    - For each API function, simulate a network failure and assert the return value matches the defined mock shape (no thrown exceptions)

- [x] 3. Implement Zustand stores
  - [x] 3.1 Create `frontend/src/canvas/versions/versionStore.js`
    - Implement `useVersionStore` with `versions` map, `addVersion(sectionName, entry)` (max 50 per section, newest-first), and `getVersions(sectionName)`
    - _Requirements: 6.1, 6.6_
  - [ ]* 3.2 Write property tests for `versionStore` (Properties 16, 17, 18, 19, 20)
    - **Property 16: Version entry structure is always complete**
    - **Property 17: Version label and source match the creation event type**
    - **Property 18: Version Store never exceeds 50 entries per section**
    - **Property 19: Version History is always sorted by timestamp descending**
    - **Property 20: Version count badge matches Version Store entry count**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.10**
  - [x] 3.3 Create `frontend/src/canvas/services/canvasStore.js`
    - Implement `useCanvasStore` with: `companyId`, `companyName`, `sections`, `activeSectionIdx`, `aiPanelVisibility`, `promptHistory`, `offlineNotified`
    - Implement actions: `setActiveSectionIdx`, `upsertSection`, `appendPromptHistory`, `setAIPanelVisibility`, `setOfflineNotified`
    - _Requirements: 1.9, 8.5_
  - [ ]* 3.4 Write property tests for `canvasStore` (Properties 23, 24, 25)
    - **Property 23: Prompt History is always sorted by timestamp descending**
    - **Property 24: Prompt History entry contains all required display fields**
    - **Property 25: Re-apply submits the correct prompt against the current active section**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 4. Implement `markdownToTipTap` utility and the `EditorPanel`
  - [x] 4.1 Create `frontend/src/canvas/editor/markdownToTipTap.js`
    - Hand-rolled regex-based parser that converts Markdown headings, paragraphs, bold, italic, bullet lists, ordered lists, and tables into TipTap document JSON `{ type: 'doc', content: [...] }`
    - Falls back to a single paragraph node wrapping the raw string on parse failure
    - _Requirements: 2.6_
  - [ ]* 4.2 Write property test for `markdownToTipTap` (Property 5)
    - **Property 5: markdownToTipTap round-trip**
    - **Validates: Requirements 2.6**
    - For any non-empty Markdown string using headings, paragraphs, bold, italic, bullet lists, and tables, assert the output has `type === 'doc'` and `content.length > 0`
  - [x] 4.3 Create `frontend/src/canvas/editor/EditorPanel.jsx`
    - Initialise TipTap with `StarterKit`, `Highlight` (multicolor), `Table` (resizable), `TableRow`, `TableHeader`, `TableCell`, `Image`
    - Implement 2000ms debounced auto-save using a `useDebounce` hook that calls `useCanvasStore.upsertSection` with `editor.getJSON()`
    - Load section content via `markdownToTipTap(section.draft_text)` when `activeSectionIdx` changes
    - Implement image upload: hidden file input → `canvasApi.uploadImage` → insert `Image` node; on failure insert `URL.createObjectURL(file)` as mock
    - Implement table right-click context menu showing "Delete Row" and "Delete Column" popover
    - _Requirements: 2.1, 2.6, 2.7, 2.8, 2.9, 2.10_

- [x] 5. Implement the `AIToolbar` and `SelectionPopup`
  - [x] 5.1 Create `frontend/src/canvas/editor/AIToolbar.jsx`
    - Render buttons for: Bold, Italic, Underline, Strikethrough, H1, H2, H3, Bullet List, Ordered List, Blockquote, Code Block, Insert Table, Insert Image, Undo, Redo
    - Each button calls the corresponding `editor.chain().focus().toggleXxx().run()` and shows active state via `editor.isActive()`
    - Include "Shortcuts" modal opener button and `ExportDropdown` component slot
    - Apply project CSS variables (`--accent`, `--glass-bg`, etc.) for all colours
    - _Requirements: 2.2, 2.3, 1.10_
  - [ ]* 5.2 Write property test for formatting toolbar (Property 4)
    - **Property 4: Formatting toolbar buttons apply TipTap commands**
    - **Validates: Requirements 2.3**
  - [x] 5.3 Create `frontend/src/canvas/editor/SelectionPopup.jsx`
    - Subscribe to TipTap `onSelectionUpdate`; show popup when `from !== to`
    - Calculate popup position from `editor.view.coordsAtPos(selection.from)` with viewport overflow repositioning (120px threshold)
    - Render four buttons: Rewrite, Expand, Simplify, Investor Friendly
    - On click: call `canvasApi.rewrite(...)`, show spinner on active button, disable others
    - On response: open `DiffViewerModal` with `{ original: selectedText, proposed: responseText, actionLabel }`
    - Dismiss on Escape or outside click; check `section.locked` before rendering
    - _Requirements: 3.1, 3.2, 3.7, 3.8, 3.10_
  - [ ]* 5.4 Write property tests for `SelectionPopup` (Properties 6, 7)
    - **Property 6: Text selection triggers Rewrite Popup with all four actions**
    - **Property 7: Rewrite API payload is always well-formed**
    - **Validates: Requirements 3.1, 3.2**

- [x] 6. Checkpoint — Ensure editor core works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement the `DiffViewerModal`
  - [x] 7.1 Create `frontend/src/canvas/diff/DiffViewerModal.jsx`
    - Generate unified diff string from `original` and `proposed` using `diffLines` + `formatLines` from the `unidiff` package
    - Render via `parseDiff` + `<Diff viewType="unified">` + `<Hunk>` from `react-diff-view`; import `react-diff-view/style/index.css`
    - Apply red-tinted (`rgba(244,63,94,0.12)`) background for removed lines and green-tinted (`rgba(16,185,129,0.1)`) for added lines via `renderToken`
    - Wrap in `AnimatePresence` + `motion.div` (Framer Motion) with `initial={{ opacity: 0, scale: 0.97 }}` / `animate={{ opacity: 1, scale: 1 }}`
    - `position: fixed` semi-transparent backdrop
    - Footer buttons: Accept (primary), Reject (secondary), Copy Proposed (secondary); "Copied!" tooltip for 2000ms
    - Header: `{sectionName} — {actionLabel}`
    - Keyboard: `Enter` → Accept, `Escape` → Reject
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  - [ ]* 7.2 Write property tests for `DiffViewerModal` (Properties 8, 21, 22)
    - **Property 8: Diff Viewer renders any original/proposed pair with correct highlighting**
    - **Property 21: Diff Viewer keyboard navigation**
    - **Property 22: Diff Viewer header shows section name and action label**
    - **Validates: Requirements 3.4, 7.2, 7.6, 7.7**

- [ ] 8. Wire Accept/Reject flow — Version entry creation and Editor updates
  - [ ] 8.1 Update `SelectionPopup` and `EditorPanel` to handle Diff Viewer Accept/Reject
    - On Accept: call `editor.chain().deleteSelection().insertContent(proposed).run()`, then `useVersionStore.addVersion` with `source: 'ai_rewrite'`, label `"AI Rewrite — {action}"`, `content: editor.getJSON()`
    - On Reject: close modal without changes
    - _Requirements: 3.5, 3.6, 6.2_
  - [ ]* 8.2 Write property tests for Accept/Reject flow (Properties 9, 10)
    - **Property 9: Accept creates a Version entry and updates Editor content**
    - **Property 10: Reject leaves Editor content unchanged**
    - **Validates: Requirements 3.5, 3.6**

- [ ] 9. Implement `WholeDocPrompt`
  - [ ] 9.1 Create `frontend/src/canvas/prompt/WholeDocPrompt.jsx`
    - Render prompt input bar below `AIToolbar` and above `EditorPanel`
    - On submit (Enter or button click): call `canvasApi.prompt(companyId, sectionName, promptText, editor.getText())`
    - On success: call `editor.commands.setContent(markdownToTipTap(responseText))`, call `addVersion` with `source: 'ai_prompt'`, append `PromptEntry` to `promptHistory` in `useCanvasStore`
    - Show loading spinner on submit button during in-flight request; disable input
    - Retain last prompt text until user clears
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6_
  - [ ]* 9.2 Write property tests for `WholeDocPrompt` (Properties 11, 12)
    - **Property 11: Whole Document Prompt payload is always well-formed**
    - **Property 12: Successful prompt response updates Editor, Version Store, and Prompt History**
    - **Validates: Requirements 4.2, 4.4**

- [ ] 10. Implement `AISideChat`
  - [ ] 10.1 Create `frontend/src/canvas/copilot/AISideChat.jsx`
    - Render scrollable message thread with user and AI bubbles
    - Pre-populate with initial AI message: "Select a section and ask me to refine it..."
    - Render four quick-prompt chips; on chip click: set input and submit immediately
    - On message submit: call `canvasApi.copilotAsk(companyId, sectionName, message)`
    - Show typing indicator (three animated dots) during in-flight request
    - Auto-scroll via `chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })` on each new message
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  - [ ]* 10.2 Write property tests for `AISideChat` (Properties 13, 14, 15)
    - **Property 13: Chat API payload includes current section name**
    - **Property 14: Quick-prompt chip click submits the chip text as a chat message**
    - **Property 15: Chat auto-scrolls to the latest message**
    - **Validates: Requirements 5.2, 5.6, 5.8**

- [ ] 11. Implement `VersionHistoryPanel`
  - [ ] 11.1 Create `frontend/src/canvas/versions/VersionHistoryPanel.jsx`
    - Read from `useVersionStore.getVersions(activeSectionName)` (already sorted newest-first)
    - Display each entry with label and relative timestamp via `Intl.RelativeTimeFormat` or a hand-rolled `timeAgo` helper
    - On entry click: `editor.setEditable(false)`, `editor.commands.setContent(entry.content)`, highlight the row
    - "Restore" button: `editor.setEditable(true)`, `editor.commands.setContent(entry.content)`, `addVersion` with label `"Restored from: {original label}"`
    - Header badge showing total count of entries
    - _Requirements: 6.7, 6.8, 6.9, 6.10_
  - [ ] 11.2 Add `Ctrl+S` / `Cmd+S` manual save to create a `manual_save` Version entry
    - In `useKeyboardShortcuts` (implemented in task 14), wire `Ctrl+S` / `Cmd+S` to call `addVersion` with `source: 'manual_save'`, `label: 'Manual Save'`, `content: editor.getJSON()`
    - Call `event.preventDefault()` to block browser native save dialog
    - _Requirements: 6.4, 12.1, 12.4_

- [ ] 12. Implement `EvidencePanel`
  - [ ] 12.1 Create `frontend/src/canvas/evidence/EvidencePanel.jsx`
    - Fetch citation data via TanStack Query `useQuery(['evidence', companyId, sectionName], () => canvasApi.getEvidence(companyId, sectionName))`
    - Render citation cards with: source document name, regulation number, chapter name, page reference, confidence score as `{n}%`
    - Show "✅ Verified against regulatory corpus" badge when `confidence >= 90`
    - On card click: `editor.chain().unsetHighlight().run()` then highlight all `[Reg X | ICDR...]` spans via `editor.chain().setHighlight({ color: '#fef08a' }).run()`
    - Refetches automatically on section change (TanStack Query key includes `sectionName`)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  - [ ]* 12.2 Write property tests for `EvidencePanel` (Properties 26, 27, 28)
    - **Property 26: Citation cards display all five required fields**
    - **Property 27: Verified badge appears only for confidence >= 90**
    - **Property 28: Citation card click highlights matching editor spans**
    - **Validates: Requirements 9.3, 9.4, 9.5**

- [ ] 13. Implement `SmartSuggestionsPanel`
  - [ ] 13.1 Create a `SmartSuggestionsPanel.jsx` in `frontend/src/canvas/`
    - Fetch from `GET /api/canvas/suggestions/{companyId}/{sectionName}` via TanStack Query, with a 5000ms debounce-based `enabled` flag that resets on Editor content changes and section changes
    - Mock fallback synthesises suggestions from `section.flagged_gaps`
    - Render severity badges: `critical` → `badge-error`, `warning` → `badge-warning`, `info` → `badge-accent`
    - "Fix with AI" button sets `WholeDocPrompt` input to `"Fix: {suggestion.title}"` and submits
    - Empty state: "No issues detected."
    - Header badge with count of active suggestions
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - [ ]* 13.2 Write property tests for `SmartSuggestionsPanel` (Properties 29, 30, 31)
    - **Property 29: Suggestion cards display severity, title, and description**
    - **Property 30: Fix with AI pre-populates and submits the Whole Document Prompt**
    - **Property 31: Suggestions badge count matches the suggestions array length**
    - **Validates: Requirements 10.3, 10.4, 10.6**

- [ ] 14. Checkpoint — Ensure all AI panels work with mock data
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Implement `InlineAIPalette`
  - [ ] 15.1 Create `frontend/src/canvas/copilot/InlineAIPalette.jsx`
    - Floating input rendered inside `EditorPanel` when `inlinePaletteOpen` state is true
    - Position via `editor.view.coordsAtPos(editor.state.selection.from)` → `top: cursorY + 24, left: cursorX`
    - Placeholder: "Ask AI to do anything..."
    - `contextParagraph`: traverse from cursor to find the parent paragraph node's text content
    - On Enter: call `canvasApi.inlineAI(companyId, sectionName, instruction, contextParagraph)`, show loading spinner
    - On response: open `DiffViewerModal`; Accept/Reject flow identical to `SelectionPopup`
    - Dismiss on Escape or outside click
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_
  - [ ]* 15.2 Write property tests for `InlineAIPalette` (Properties 32, 33)
    - **Property 32: Cmd+K opens Inline AI palette in any focused Editor state**
    - **Property 33: Inline AI API payload includes the cursor paragraph as context_text**
    - **Validates: Requirements 11.1, 11.3**

- [ ] 16. Implement keyboard shortcuts and `ShortcutsModal`
  - [ ] 16.1 Create `frontend/src/canvas/shortcuts/useKeyboardShortcuts.js`
    - `useEffect` on `document` `keydown` event; handle: `Ctrl/Cmd+S` (manual save + preventDefault), `Ctrl/Cmd+K` (open InlineAIPalette), `Ctrl/Cmd+Z` (TipTap undo), `Ctrl/Cmd+Shift+Z` (TipTap redo), `Ctrl/Cmd+Enter` (submit WholeDocPrompt), `Escape` (dismiss in priority order: InlineAIPalette → DiffViewer → SelectionPopup → ShortcutsModal)
    - Accept a `dismissPriority` callback array from `CanvasRoot` for Escape handling
    - _Requirements: 12.1, 12.4_
  - [ ] 16.2 Create `frontend/src/canvas/shortcuts/ShortcutsModal.jsx`
    - Modal with two-column table listing all shortcuts
    - Dismiss on Escape or outside click
    - _Requirements: 12.2, 12.3_
  - [ ]* 16.3 Write property test for keyboard shortcuts (Property 34)
    - **Property 34: All global keyboard shortcuts fire the correct Canvas action**
    - **Validates: Requirements 12.1, 12.4**

- [ ] 17. Implement `ExportDropdown` and toast system
  - [ ] 17.1 Create `frontend/src/canvas/toolbar/ExportDropdown.jsx`
    - Dropdown with four options: "Export Section as DOCX", "Export Section as PDF", "Export Full DRHP as DOCX", "Export Full DRHP as PDF"
    - Call the appropriate `canvasApi.exportSection` or `canvasApi.exportFull` function
    - Download via `<a href={URL.createObjectURL(blob)} download={filename}>` pattern
    - Show loading spinner on Export button during in-flight request; disable all options
    - On success: show "Export complete" success toast (3000ms)
    - On failure / mock: trigger plain-text blob download, show "Backend unavailable — exported as plain text" warning toast (3000ms)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_
  - [x] 17.2 Create a `useToast` hook and `ToastContainer` component in `frontend/src/canvas/`
    - `useToast` manages a list of `{ id, message, type, duration }` objects in state
    - `ToastContainer` renders toasts `position: fixed` at the bottom-right corner
    - Each toast auto-dismisses via `setTimeout` after `duration` milliseconds
    - _Requirements: 13.8, 13.9_
  - [ ]* 17.3 Write property tests for `ExportDropdown` (Properties 35, 36, 37)
    - **Property 35: Export API calls use correct endpoints and payloads**
    - **Property 36: Successful export triggers a 3-second success toast**
    - **Property 37: Failed export mock fallback triggers a 3-second warning toast**
    - **Validates: Requirements 13.2, 13.3, 13.4, 13.5, 13.8, 13.9_**

- [ ] 18. Implement `PromptHistoryPanel`
  - [ ] 18.1 Create a `PromptHistoryPanel.jsx` in `frontend/src/canvas/`
    - Read `promptHistory` from `useCanvasStore`; render sorted newest-first
    - Each entry: prompt text (truncated to 80 chars with ellipsis), section name, action type, relative timestamp
    - "Re-apply" button: resubmit the entry's `promptText` against the current active section (not the original section)
    - Empty state: "No prompts yet in this session."
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 19. Assemble `CanvasRoot` and the Section Sidebar
  - [ ] 19.1 Create `frontend/src/canvas/editor/SectionSidebar.jsx`
    - Display all 25 SEBI DRHP section names from `SECTIONS_25` in original order
    - Status indicator: `✓` (var(--success)) when `locked`, `~` (var(--warning)) when `draft_text` non-empty and not locked, `○` (var(--text-muted)) otherwise
    - 3px score bar below section name when `score > 0`
    - On click: set `activeSectionIdx` in Zustand Store
    - _Requirements: 1.3, 1.4, 1.5_
  - [ ]* 19.2 Write property tests for `SectionSidebar` (Properties 1, 2, 3)
    - **Property 1: Section Sidebar preserves SECTIONS_25 order**
    - **Property 2: Section selection loads correct content**
    - **Property 3: Status indicator matches section state**
    - **Validates: Requirements 1.3, 1.4, 1.5**
  - [ ] 19.3 Create `frontend/src/canvas/CanvasRoot.jsx`
    - Three-column CSS grid: `220px 1fr 320px`
    - Fetch company data via `GET /api/demo/company` on mount; fetch sections via TanStack Query `GET /api/sections/{companyId}`
    - Merge API sections with `SECTIONS_25` stubs; write to `useCanvasStore`
    - Show offline toast ("Backend offline — using demo mode") on first API failure; set `offlineNotified` flag to suppress repeats
    - On viewport < 1024px: convert Sidebar and AI Panel to drawer overlays with toggle buttons
    - Compose all sub-components: `SectionSidebar`, `AIToolbar`, `WholeDocPrompt`, `EditorPanel`, `SelectionPopup`, `DiffViewerModal`, `InlineAIPalette`, `AISideChat`, `VersionHistoryPanel`, `EvidencePanel`, `SmartSuggestionsPanel`, `PromptHistoryPanel`, `ExportDropdown`, `ShortcutsModal`, `ToastContainer`
    - Attach `useKeyboardShortcuts` hook
    - Wrap with `QueryClientProvider`
    - AI Panel: four collapsible sub-panels (Chat, Prompt History, Evidence, Suggestions) independently togglable
    - _Requirements: 1.1, 1.2, 1.6, 1.7, 1.8, 1.9, 1.10, 14.2, 14.3, 14.4_

- [ ] 20. Update `App.jsx` to mount `CanvasRoot` on `/workspace` route
  - Import `CanvasRoot` from `./canvas/CanvasRoot`
  - Replace the existing `<Workspace>` component in the `/workspace` route with `<CanvasRoot ...>`
  - Keep `Workspace.jsx` file intact but unrouted
  - _Requirements: 1.2_

- [ ] 21. Checkpoint — Full demo flow end-to-end
  - Verify all 13 phases work with mock data when the backend is offline
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Property test tasks annotate which design property they validate and the corresponding requirement clause
- Checkpoints at tasks 6, 14, and 21 provide incremental validation gates
- The design document uses specific language: React 19 + JSX — no language selection prompt is needed
- `SECTIONS_25` is the existing array already defined elsewhere in the project; tasks reference it without re-defining it
- `canvasApi.js` is the single source of truth for all API calls and mock fallbacks — components never call `fetch` directly
- The `unidiff` package is used alongside `react-diff-view` to generate the unified diff string in the browser
- All colour values use the project's existing CSS variables; no new colour tokens are introduced

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "3.3"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.4", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3"] },
    { "id": 4, "tasks": ["5.1", "5.3", "7.1"] },
    { "id": 5, "tasks": ["5.2", "5.4", "7.2", "9.1", "10.1", "17.2"] },
    { "id": 6, "tasks": ["8.1", "9.2", "10.2", "12.1", "13.1", "15.1"] },
    { "id": 7, "tasks": ["8.2", "11.1", "12.2", "13.2", "15.2", "17.1", "18.1"] },
    { "id": 8, "tasks": ["11.2", "16.1", "16.2", "17.3"] },
    { "id": 9, "tasks": ["16.3", "19.1"] },
    { "id": 10, "tasks": ["19.2", "19.3"] },
    { "id": 11, "tasks": ["20"] }
  ]
}
```
