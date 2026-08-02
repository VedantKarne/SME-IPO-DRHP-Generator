# Design Document — AI Authoring Canvas

## Overview

The AI Authoring Canvas is the hero feature of the SME IPO DRHP Generator. It replaces the `/workspace` route with a professional three-panel document authoring environment: a Section Sidebar (left), a TipTap-powered rich text Editor (center), and an AI Panel (right). The Canvas integrates AI rewrite, inline commands, whole-document prompts, version control, evidence citations, smart suggestions, a diff viewer, and a full export pipeline. All backend calls degrade gracefully to mocked responses so the demo works end-to-end regardless of backend availability.

## Architecture

### High-Level Structure

```
frontend/src/canvas/
├── CanvasRoot.jsx          # Top-level Canvas component, three-panel layout
├── editor/
│   ├── EditorPanel.jsx     # TipTap editor instance + auto-save debounce
│   ├── AIToolbar.jsx       # Formatting + AI action buttons + Export + Shortcuts
│   ├── SelectionPopup.jsx  # Rewrite Popup on text selection
│   └── markdownToTipTap.js # Markdown → TipTap JSON conversion utility
├── prompt/
│   └── WholeDocPrompt.jsx  # Full-section AI prompt input bar
├── copilot/
│   ├── AISideChat.jsx      # Context-aware section chat
│   └── InlineAIPalette.jsx # ⌘K floating command palette
├── versions/
│   ├── VersionHistoryPanel.jsx  # Version list, Restore flow
│   └── versionStore.js          # Zustand slice for Version Store
├── evidence/
│   └── EvidencePanel.jsx   # Citation cards with confidence scores
├── diff/
│   └── DiffViewerModal.jsx # react-diff-view modal, Accept/Reject/Copy
├── toolbar/
│   └── ExportDropdown.jsx  # Export section/full DRHP as DOCX/PDF
├── shortcuts/
│   ├── useKeyboardShortcuts.js  # Global keyboard shortcut hook
│   └── ShortcutsModal.jsx       # Keyboard shortcuts help modal
└── services/
    └── canvasApi.js         # All API service functions with mock fallbacks
```


### State Management

The Canvas uses two Zustand stores:

**`useCanvasStore`** — UI state for the entire Canvas:
```js
{
  companyId: string,
  companyName: string,
  sections: Section[],          // merged SECTIONS_25 + API data
  activeSectionIdx: number,
  aiPanelVisibility: {
    chat: boolean,
    promptHistory: boolean,
    evidence: boolean,
    suggestions: boolean,
  },
  promptHistory: PromptEntry[],  // session-scoped prompt log
  offlineNotified: boolean,      // suppress repeated offline toast
  // actions: setActiveSectionIdx, upsertSection, appendPromptHistory,
  //          setAIPanelVisibility, setOfflineNotified
}
```

**`useVersionStore`** — Version snapshots, keyed by section name:
```js
{
  versions: Record<string, VersionEntry[]>,  // max 50 per section key
  // actions: addVersion, getVersions(sectionName), restoreVersion
}
```

**Data flow:**
1. `CanvasRoot` fetches sections via TanStack Query on mount, merges with `SECTIONS_25` stubs, writes to `useCanvasStore`.
2. `EditorPanel` reads `activeSectionIdx`, loads section content, writes auto-save state back to `useCanvasStore`.
3. AI actions (rewrite, prompt, inline AI) call `canvasApi.js`, receive response, pass to `DiffViewerModal`, on Accept update editor and call `addVersion`.
4. `VersionHistoryPanel` reads from `useVersionStore` for the active section.
5. `EvidencePanel` and `SmartSuggestions` use TanStack Query with mock fallback.


## Component Design

### CanvasRoot.jsx

The top-level component mounted at `/workspace`. Replaces `Workspace.jsx` in `App.jsx`.

**Layout:**
```
┌──────────────┬─────────────────────────────┬─────────────────┐
│ Section      │  AIToolbar (fixed top)       │  AI Panel       │
│ Sidebar      │  WholeDocPrompt              │  ├ AI Side Chat  │
│ (220px)      │  EditorPanel (TipTap)        │  ├ PromptHistory │
│              │                              │  ├ Evidence      │
│              │                              │  └ Suggestions   │
└──────────────┴─────────────────────────────┴─────────────────┘
```

**Responsibilities:**
- Owns the three-column CSS grid (`220px 1fr 320px`).
- Fetches company data via `GET /api/demo/company` on mount.
- Fetches sections via TanStack Query `GET /api/sections/{companyId}`.
- Shows offline toast ("Backend offline — using demo mode") on first API failure, sets `offlineNotified` flag.
- Passes `sections`, `activeSectionIdx`, `companyId` down via props or context.
- On viewport < 1024px: converts Sidebar and AI Panel to drawer overlays toggled by floating buttons.

**Mock fallback for sections:** A `SECTIONS_25` array of stub objects with `{ id: null, name, status: 'pending', draft_text: '', score: 0, locked: false, flagged_gaps: [] }`.

### Section Sidebar

**Component:** inline within `CanvasRoot.jsx` or extracted to `editor/SectionSidebar.jsx`.

**Status indicators:**
- `locked === true` → `✓` in `var(--success)`
- `draft_text` non-empty and not locked → `~` in `var(--warning)`
- no draft → `○` in `var(--text-muted)`

**Score bar:** 3px progress bar below section name when `score > 0`.

**Selection:** clicking a section sets `activeSectionIdx` in Zustand and triggers Editor content load.


### EditorPanel.jsx

**TipTap configuration:**
```js
useEditor({
  extensions: [
    StarterKit,
    Highlight.configure({ multicolor: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    Image,
  ],
  content: initialContent,       // TipTap JSON from markdownToTipTap(draft_text)
  onUpdate: ({ editor }) => {
    debouncedAutoSave(editor.getJSON());
  },
})
```

**`markdownToTipTap(markdownString)`** utility:
- Uses a lightweight Markdown-to-TipTap-JSON converter (no external dep; hand-rolled regex-based parser for headings, paragraphs, lists, tables, code blocks, bold/italic).
- Returns a valid TipTap `{ type: 'doc', content: [...] }` JSON object.
- Falls back to `{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: markdownString }] }] }` on parse failure.

**Auto-save:** `useDebounce` hook (2000ms) writes `editor.getJSON()` to `useCanvasStore.upsertSection`.

**Image upload:**
1. File picker input (hidden, triggered by toolbar button) accepts `.png .jpg .jpeg .gif .webp` up to 5MB.
2. `POST /api/canvas/upload-image` with `FormData`.
3. On success: insert `Image` node with returned URL.
4. On failure: insert `Image` node with `URL.createObjectURL(file)` as base64 data URI (mock).

**Table context menu:** right-click on table cell shows a small popover with "Delete Row" and "Delete Column" buttons.

**`SelectionPopup.jsx`:**
- Rendered inside `EditorPanel`; subscribes to TipTap's `onSelectionUpdate`.
- When selection is non-empty (`from !== to`), calculates popup position from `editor.view.coordsAtPos(selection.from)`.
- Repositions: if `popupLeft + 200 > window.innerWidth` → flip left; if `popupTop + 160 > window.innerHeight` → flip above.
- Displays four buttons: Rewrite, Expand, Simplify, Investor Friendly.
- On button click: calls `canvasApi.rewrite(companyId, sectionName, selectedText, action)`, shows spinner on active button, disables others.
- On response: opens `DiffViewerModal` with `{ original: selectedText, proposed: responseText, actionLabel }`.
- On Accept: applies `editor.chain().deleteSelection().insertContent(proposed).run()`, creates Version entry, dismisses.
- On Reject: dismisses without changes.
- Dismisses on Escape or outside click via `useEffect` event listener.


### AIToolbar.jsx

Docked toolbar rendered above the Editor. Buttons:

| Group | Buttons |
|---|---|
| Formatting | Bold, Italic, Underline, Strikethrough |
| Headings | H1, H2, H3 |
| Lists | Bullet List, Ordered List |
| Blocks | Blockquote, Code Block |
| Insert | Table, Image |
| History | Undo, Redo |
| AI | Shortcuts modal opener |
| Export | Export dropdown (`ExportDropdown.jsx`) |

Each formatting button calls `editor.chain().focus().toggleXxx().run()` and shows active state when `editor.isActive('xxx')`.

### WholeDocPrompt.jsx

Rendered between `AIToolbar` and `EditorPanel`.

```
┌─────────────────────────────────────────────────────────┐
│  [AI ✦]  Apply AI instruction to entire section...  [→] │
└─────────────────────────────────────────────────────────┘
```

- Input retained after submission (cleared only by user).
- On submit (Enter or click): calls `canvasApi.prompt(companyId, sectionName, promptText, editor.getText())`.
- On success: calls `editor.commands.setContent(markdownToTipTap(responseText))`, creates Version entry with `source: "ai_prompt"`, appends to Prompt History.
- `Ctrl+Enter` / `Cmd+Enter` submits (handled by `useKeyboardShortcuts`).

### InlineAIPalette.jsx

Floating input, rendered within `EditorPanel` when `inlinePaletteOpen` state is true.

**Positioning:** `editor.view.coordsAtPos(editor.state.selection.from)` → places palette `top: cursorY + 24, left: cursorX`.

**Behaviour:**
- Placeholder: "Ask AI to do anything..."
- On Enter: calls `canvasApi.inlineAI(companyId, sectionName, instruction, contextParagraph)`.
- `contextParagraph`: resolved by traversing from the cursor position to find the parent paragraph node's text content.
- On response: opens `DiffViewerModal` with `{ original: contextParagraph, proposed: responseText }`.
- Accept/Reject flow identical to `SelectionPopup`.
- Dismisses on Escape or outside click.
- Loading spinner replaces submit icon while in-flight.


### DiffViewerModal.jsx

Modal rendered on top of the Canvas with a `position: fixed` semi-transparent backdrop.

**Props:** `{ original, proposed, sectionName, actionLabel, onAccept, onReject }`

**Implementation using `react-diff-view`:**
```js
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import 'react-diff-view/style/index.css';

// Generate unified diff string from original/proposed using a lightweight
// in-browser differ (custom or 'diff' npm package via services layer).
// Pass to parseDiff() to get file hunks for react-diff-view.
```

**Visual:**
- Removed lines: red-tinted background (`rgba(244,63,94,0.12)`), consistent with `--error-dim`.
- Added lines: green-tinted background (`rgba(16,185,129,0.1)`), consistent with `--success-dim`.
- Header shows: `{sectionName} — {actionLabel}`.
- Footer buttons: Accept (primary), Reject (secondary), Copy Proposed (secondary).
- Copy Proposed: `navigator.clipboard.writeText(proposed)` → transient tooltip "Copied!" disappears after 2000ms.

**Keyboard handling:**
- `Enter` key → triggers `onAccept`.
- `Escape` key → triggers `onReject`.

**Framer Motion animation:** `AnimatePresence` + `motion.div` with `initial={{ opacity: 0, scale: 0.97 }}` / `animate={{ opacity: 1, scale: 1 }}`.

### VersionHistoryPanel.jsx + versionStore.js

**`versionStore.js`** — Zustand store (separate from canvasStore for modularity):
```js
const useVersionStore = create((set, get) => ({
  versions: {},  // { [sectionName]: VersionEntry[] }
  addVersion: (sectionName, entry) => {
    set(state => {
      const existing = state.versions[sectionName] || [];
      const updated = [entry, ...existing].slice(0, 50);  // max 50, newest-first
      return { versions: { ...state.versions, [sectionName]: updated } };
    });
  },
  getVersions: (sectionName) => get().versions[sectionName] || [],
}));
```

**VersionEntry shape:**
```js
{
  id: crypto.randomUUID(),
  sectionName: string,
  label: string,             // e.g. "AI Rewrite — Investor Friendly"
  timestamp: new Date().toISOString(),
  source: 'ai_rewrite' | 'ai_prompt' | 'manual_save' | 'ai_chat' | 'approval',
  content: TipTapJSON,       // editor.getJSON() snapshot
  authorLabel: 'AI' | 'User',
}
```

**Label construction:**
| Source | Label |
|---|---|
| `ai_rewrite` | `"AI Rewrite — {action}"` (capitalize action) |
| `ai_prompt` | `"AI Prompt — {prompt.substring(0,40)}"` |
| `manual_save` | `"Manual Save"` |
| `ai_chat` | `"AI Chat Edit"` |
| `approval` | `"Approved & Locked"` |
| restore | `"Restored from: {original label}"` |

**VersionHistoryPanel UI:**
- Listed newest-first (already sorted by `addVersion` prepend order).
- Each entry shows label, relative timestamp (using `Intl.RelativeTimeFormat` or a hand-rolled `timeAgo` helper).
- Clicking an entry: sets editor to read-only (`editor.setEditable(false)`), loads `entry.content` (`editor.commands.setContent(entry.content)`), highlights the entry row.
- "Restore" button below: sets editor editable again, sets content, creates new Version entry with `"Restored from: {original label}"`.
- Badge: total count of entries for active section.


### AISideChat.jsx

Right-panel sub-panel. Structurally similar to the existing `CopilotRail` in `AppShell.jsx` but scoped to the active section.

**State:** local `messages`, `input`, `loading`.

**Initial message:** `"Select a section and ask me to refine it. E.g., 'Make this more investor-friendly' or 'Add a paragraph about exports.'"` as the first AI bubble.

**Quick-prompt chips (4):**
- "Make this more professional"
- "Shorter and punchier"
- "Add investor-friendly language"
- "Explain the regulations for this section"

On chip click: set input to chip text and immediately submit.

**Message submission:** calls `canvasApi.copilotAsk(companyId, sectionName, message)`.

**Mock fallback:** `"I'm operating in offline mode. The backend is not currently reachable."`

**Typing indicator:** three animated dots (`typing-dot` CSS class already defined in `index.css`).

**Auto-scroll:** `useEffect` on messages → `chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })`.

### EvidencePanel.jsx

**Data source:** TanStack Query `useQuery(['evidence', companyId, sectionName], () => canvasApi.getEvidence(companyId, sectionName))`.

**Mock fallback (`EVIDENCE_MAP`):**
```js
const EVIDENCE_MAP = {
  'Reg 229': { reg: '229', chapter: 'IV — SME Listing Requirements', doc: 'SEBI ICDR Regulations 2018', page: 'Part II, Reg 229', confidence: 99 },
  'Reg 237': { reg: '237', chapter: 'IV — Disclosures in Offer Documents', doc: 'SEBI ICDR Regulations 2018', page: 'Part II, Reg 237', confidence: 97 },
  'Reg 238': { reg: '238', chapter: 'IV — Content of Offer Documents', doc: 'SEBI ICDR Regulations 2018', page: 'Part II, Reg 238', confidence: 98 },
  'Reg 233': { reg: '233', chapter: 'IV — Capital Structure Disclosures', doc: 'SEBI ICDR Regulations 2018', page: 'Part II, Reg 233', confidence: 96 },
};
```

**Citation card fields:** source document name, regulation number, chapter name, page reference, confidence score as `{confidence}%`.

**"Verified" badge:** shown when `confidence >= 90`. Uses `badge-success` CSS class with text "✅ Verified against regulatory corpus".

**Citation click → highlight:** calls `editor.chain().unsetHighlight().run()` first, then finds all text nodes matching `[Reg X | ICDR...]` and applies `editor.chain().setHighlight({ color: '#fef08a' }).run()` at those positions.

**Reloads on section change:** TanStack Query key includes `sectionName`, so it refetches automatically.

### SmartSuggestionsPanel.jsx

**Data source:** TanStack Query with a 5000ms debounce-based `enabled` flag (set to `true` after 5s of `lastInteraction` inactivity). Fetches `GET /api/canvas/suggestions/{companyId}/{sectionName}`.

**Also refetches on section change** (key includes `sectionName`).

**Mock fallback:** synthesises suggestion cards from `section.flagged_gaps`:
```js
section.flagged_gaps.map(gap => ({
  severity: 'warning',
  title: gap.description?.substring(0, 60) || 'Missing disclosure',
  description: gap.description || '',
}))
```

**Severity badges:**
- `critical` → `badge-error`
- `warning` → `badge-warning`
- `info` → `badge-accent`

**"Fix with AI":** sets `WholeDocPrompt` input to `"Fix: {suggestion.title}"` and submits.

**Empty state:** "No issues detected." when array is empty.

**Header badge:** count of active suggestions.


### useKeyboardShortcuts.js

Custom hook attached to `CanvasRoot`. Uses `useEffect` to add a `keydown` listener on `document`.

```js
// Escape chain: InlineAIPalette → DiffViewer → SelectionPopup → ShortcutsModal
// Each component registers/deregisters its dismiss callback with the hook.
```

**Shortcut table:**

| Shortcut | Action |
|---|---|
| `Ctrl+S` / `Cmd+S` | `preventDefault` + create manual_save Version entry |
| `Ctrl+K` / `Cmd+K` | Open InlineAIPalette |
| `Ctrl+Z` / `Cmd+Z` | `editor.chain().undo().run()` |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | `editor.chain().redo().run()` |
| `Ctrl+Enter` / `Cmd+Enter` | Submit WholeDocPrompt |
| `Escape` | Dismiss active modal/popup in priority order |

### ExportDropdown.jsx

**Dropdown options:**
1. Export Section as DOCX → `POST /api/export/section/docx`
2. Export Section as PDF → `POST /api/export/section/pdf`
3. Export Full DRHP as DOCX → `POST /api/export/full/docx`
4. Export Full DRHP as PDF → `POST /api/export/full/pdf`

**Download mechanism:** create `<a>` element, set `href` to `URL.createObjectURL(blob)`, set `download` attribute, click programmatically, then `URL.revokeObjectURL`.

**Mock fallback:** `new Blob([editor.getText()], { type: 'text/plain' })` downloaded with the same filename but `.txt` extension.

**Toast system:** a simple `useToast` hook / context manages a list of toast messages rendered in the bottom-right corner via `position: fixed`. Each toast has a `type` (`success` | `warning` | `error`) and auto-dismisses after `duration` milliseconds using `setTimeout`.

### canvasApi.js

All API functions follow this pattern:

```js
async function rewrite(companyId, sectionName, selectedText, action) {
  try {
    const res = await fetch(`${API}/api/canvas/rewrite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: companyId, section_name: sectionName, selected_text: selectedText, action }),
    });
    if (!res.ok) throw new Error('non-2xx');
    return await res.json();
  } catch {
    // Mock response
    return { proposed_text: `${selectedText} [AI-enhanced: ${action}]` };
  }
}
```

**All API functions with their mock responses:**

| Function | Endpoint | Mock |
|---|---|---|
| `getSections(cid)` | `GET /api/sections/{cid}` | Returns `SECTIONS_25` stubs |
| `rewrite(cid, sec, text, action)` | `POST /api/canvas/rewrite` | `"{text} [AI-enhanced: {action}]"` |
| `prompt(cid, sec, prompt, fullText)` | `POST /api/canvas/prompt` | `"[Whole-doc AI edit applied: {prompt}]\n\n{fullText}"` |
| `inlineAI(cid, sec, instruction, ctx)` | `POST /api/canvas/inline-ai` | `"[Inline AI: {instruction}] {ctx}"` |
| `copilotAsk(cid, sec, question)` | `POST /api/copilot/ask` | Offline mode message |
| `getEvidence(cid, sec)` | `GET /api/canvas/evidence/{cid}/{sec}` | `EVIDENCE_MAP` values array |
| `getSuggestions(cid, sec)` | `GET /api/canvas/suggestions/{cid}/{sec}` | Synthesised from `flagged_gaps` |
| `uploadImage(formData)` | `POST /api/canvas/upload-image` | `URL.createObjectURL(file)` |
| `exportSection(cid, sec, content, fmt)` | `POST /api/export/section/{fmt}` | Plain-text blob |
| `exportFull(cid, fmt)` | `POST /api/export/full/{fmt}` | Plain-text blob |


## Data Models

### Section (API response + stub)
```js
{
  id: string | null,        // null for stubs
  name: string,             // one of SECTIONS_25
  status: 'pending' | 'draft' | 'approved',
  draft_text: string,       // Markdown content from backend
  score: number,            // 0.0 – 1.0
  locked: boolean,
  flagged_gaps: Array<{ description: string }>
}
```

### VersionEntry
```js
{
  id: string,               // crypto.randomUUID()
  sectionName: string,
  label: string,
  timestamp: string,        // ISO 8601
  source: 'ai_rewrite' | 'ai_prompt' | 'manual_save' | 'ai_chat' | 'approval',
  content: object,          // TipTap JSON { type: 'doc', content: [...] }
  authorLabel: string       // 'AI' | 'User'
}
```

### PromptEntry
```js
{
  id: string,               // crypto.randomUUID()
  promptText: string,
  sectionName: string,
  actionType: 'rewrite' | 'expand' | 'simplify' | 'investor_friendly' | 'whole-doc' | 'chat',
  timestamp: string,        // ISO 8601
}
```

### CitationCard
```js
{
  doc: string,              // source document name
  reg: string,              // regulation number
  chapter: string,
  page: string,
  confidence: number,       // 0 – 100
}
```

### SuggestionCard
```js
{
  severity: 'critical' | 'warning' | 'info',
  title: string,
  description: string,
}
```

## Interfaces and Integration Points

### TipTap → Canvas Integration
- `editor.getJSON()` → used for Version snapshots and auto-save.
- `editor.getText()` → used as `full_text` in Whole Document Prompt payload and for export plain-text fallback.
- `editor.getHTML()` → used as `content` in Section export payloads.
- `editor.commands.setContent(json)` → used by Version restore and AI prompt response loading.
- `editor.setEditable(boolean)` → toggled when previewing a historical Version.
- `editor.chain().setHighlight({ color }).run()` → triggered by Evidence Panel citation click.

### react-diff-view Integration
The `DiffViewerModal` generates a unified diff string from `original` and `proposed` texts, then passes it to `parseDiff()` from `react-diff-view`. The resulting hunks are rendered via `<Diff viewType="unified">` with custom `renderToken` to apply the project's colour variables.

```js
import { parseDiff, Diff, Hunk } from 'react-diff-view';
import { diffLines, formatLines } from 'unidiff';

function buildDiffText(original, proposed) {
  return formatLines(diffLines(original, proposed), { context: 3 });
}
```

The `unidiff` package (lightweight, no backend needed) is used to produce the diff string.

### TanStack Query Setup
`QueryClient` is instantiated at the `CanvasRoot` level and wrapped in a `QueryClientProvider`. All Canvas-internal data fetches (sections, evidence, suggestions) use `useQuery`. Mutations (rewrite, prompt, etc.) use `useMutation` with `onError` → mock fallback invoked in the `onError` handler.


## Error Handling

### API Failures (All Endpoints)
Every `canvasApi.js` function wraps its `fetch` call in try/catch and returns a mock response on any network error or non-2xx status. The component consuming the API never receives a thrown error — it always receives data (either real or mocked). This ensures the demo flow has zero interruptions.

### First-Mount Failure Detection
`CanvasRoot` inspects whether the sections fetch succeeded. If it fails (caught in the `onError` TanStack Query callback), it calls `canvasApi.getSections` mock, then checks `useCanvasStore.offlineNotified`. If `false`, shows the offline toast and sets `offlineNotified: true`.

### Image Upload Failure
If `POST /api/canvas/upload-image` fails, `EditorPanel` catches the error and falls back to `FileReader.readAsDataURL(file)`, inserting the base64 result as the image source. The file size limit (5MB) is validated client-side before attempting the upload.

### Export Failure
`ExportDropdown` wraps the fetch in try/catch. On failure, it creates a `Blob` from `editor.getText()`, triggers the download with the mock filename, and displays the warning toast.

### Version Store Overflow
The `addVersion` action in `versionStore.js` slices the array to 50 entries after each push (newest-first), ensuring the oldest entry is discarded silently when the limit is reached.

### Inline AI / Rewrite During Locked Section
If `section.locked === true`, AI edit buttons in the toolbar are hidden (replaced by an "Approved & Locked" badge). The `SelectionPopup` checks `section.locked` before rendering.

## Dependency Installation

The following packages must be added to `frontend/package.json` as production dependencies:

```json
"@tiptap/react": "^2.11.7",
"@tiptap/starter-kit": "^2.11.7",
"@tiptap/extension-highlight": "^2.11.7",
"@tiptap/extension-table": "^2.11.7",
"@tiptap/extension-image": "^2.11.7",
"framer-motion": "^12.23.6",
"react-diff-view": "^3.3.0",
"unidiff": "^1.0.4",
"zustand": "^5.0.6",
"@tanstack/react-query": "^5.83.0"
```

These are pinned to exact minor versions matching the latest stable releases.

## App.jsx Integration

`App.jsx` is updated to import `CanvasRoot` and replace the `<Workspace>` route:

```jsx
import CanvasRoot from './canvas/CanvasRoot';

// In Routes:
<Route
  path="/workspace"
  element={
    <CanvasRoot
      companyId={companyId}
      companyName={companyName}
      sections={sections}
      setSections={setSections}
      onCurrentSectionChange={setCurrentSection}
    />
  }
/>
```

The existing `Workspace.jsx` file is retained but no longer routed to.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property Reflection:**

Before writing the properties, the following redundancies were resolved:

- Properties about "rewrite Diff Viewer" (3.4, 3.9) and "inline AI Diff Viewer" (11.5) can be merged into one property about the Diff Viewer rendering correctly for any original/proposed pair, regardless of how it was triggered.
- Properties about "API payload correctness" across rewrite (3.2), prompt (4.2), copilot (5.2), and inline AI (11.3) follow the same pattern and are kept separate but scoped tightly to avoid overlap.
- Version entry creation properties (6.2–6.5) are merged into a single property about source/label correctness across all creation event types.
- Export toast properties (13.8, 13.9) are kept separate as they test distinct states (success vs. failure).
- Sidebar sort (1.3) and Version History sort (6.7) and Prompt History sort (8.1) are distinct properties but follow the same pattern — kept separate to maintain requirement traceability.
- Section data pre-population (14.3) and sidebar display (1.3) test different aspects of the same data flow — kept both.

---

### Property 1: Section Sidebar preserves SECTIONS_25 order

*For any* set of section data returned by the API (including empty, partial, or full), the Section Sidebar SHALL render exactly all 25 SEBI DRHP section names in the order defined by `SECTIONS_25`, with missing sections filled in as stubs.

**Validates: Requirements 1.3**

---

### Property 2: Section selection loads correct content

*For any* valid section index (0–24), selecting that section in the Section Sidebar SHALL load that section's draft content into the Editor and update `activeSectionIdx` in the Zustand Store to that index.

**Validates: Requirements 1.4**

---

### Property 3: Status indicator matches section state

*For any* section in the sidebar, its status indicator SHALL be `✓` (success colour) when `locked === true`, `~` (warning colour) when `draft_text` is non-empty and `locked === false`, and `○` (muted colour) when `draft_text` is empty.

**Validates: Requirements 1.5**

---

### Property 4: Formatting toolbar buttons apply TipTap commands

*For any* formatting button in the AI Toolbar, clicking it when the Editor is focused SHALL invoke the corresponding TipTap chain command, and the button's active state SHALL reflect `editor.isActive()` for that mark or node.

**Validates: Requirements 2.3**

---

### Property 5: markdownToTipTap round-trip

*For any* non-empty Markdown string that uses only headings, paragraphs, bold, italic, bullet lists, and tables, `markdownToTipTap(text)` SHALL return a valid TipTap document JSON object whose `type` is `'doc'` and whose `content` array is non-empty.

**Validates: Requirements 2.6**

---

### Property 6: Text selection triggers Rewrite Popup with all four actions

*For any* non-empty text selection inside the Editor (of any length, content, or position), the Rewrite Popup SHALL appear and contain exactly the four action buttons: Rewrite, Expand, Simplify, and Investor Friendly.

**Validates: Requirements 3.1**

---

### Property 7: Rewrite API payload is always well-formed

*For any* combination of `companyId`, `sectionName`, `selectedText`, and action type in `{rewrite, expand, simplify, investor_friendly}`, the POST request body sent to `/api/canvas/rewrite` SHALL contain all four fields with the correct values.

**Validates: Requirements 3.2**

---

### Property 8: Diff Viewer renders any original/proposed pair with correct highlighting

*For any* pair of strings (original, proposed) passed to `DiffViewerModal`, the removed lines SHALL have a red-tinted background and the added lines SHALL have a green-tinted background, and both strings SHALL be visually distinguishable via `react-diff-view`.

**Validates: Requirements 3.4, 7.2**

---

### Property 9: Accept creates a Version entry and updates Editor content

*For any* proposed replacement text accepted via the Diff Viewer (from any source: rewrite, inline AI), the Editor's content SHALL be updated with the proposed text, and the Version Store for the active section SHALL grow by exactly one entry whose `content` matches the new Editor JSON.

**Validates: Requirements 3.5**

---

### Property 10: Reject leaves Editor content unchanged

*For any* proposed replacement text rejected via the Diff Viewer, the Editor content SHALL remain identical to its pre-action state, and the Version Store SHALL not gain a new entry.

**Validates: Requirements 3.6**

---

### Property 11: Whole Document Prompt payload is always well-formed

*For any* `promptText` and any current Editor `full_text`, the POST request body sent to `/api/canvas/prompt` SHALL contain `company_id`, `section_name`, `prompt`, and `full_text` with the correct values, where `full_text` is derived from `editor.getText()`.

**Validates: Requirements 4.2**

---

### Property 12: Successful prompt response updates Editor, Version Store, and Prompt History

*For any* successful response from the Whole Document Prompt API (real or mocked), the Editor SHALL contain the returned text, the Version Store for the active section SHALL gain one `ai_prompt` entry, and the Prompt History list SHALL grow by one entry.

**Validates: Requirements 4.4**

---

### Property 13: Chat API payload includes current section name

*For any* message submitted in the AI Side Chat, the POST request body sent to `/api/copilot/ask` SHALL contain `company_id`, `current_section` (the currently active section's name), and `question` (the submitted message text).

**Validates: Requirements 5.2**

---

### Property 14: Quick-prompt chip click submits the chip text as a chat message

*For any* of the four quick-prompt chips, clicking it SHALL result in a chat message being sent with the chip's exact text as the question, identically to if the user had typed and submitted it manually.

**Validates: Requirements 5.6**

---

### Property 15: Chat auto-scrolls to the latest message

*For any* message appended to the AI Side Chat (user or AI), the chat container's scroll position SHALL be at its maximum (bottom) after the message is rendered.

**Validates: Requirements 5.8**

---

### Property 16: Version entry structure is always complete

*For any* Version entry creation event (ai_rewrite, ai_prompt, manual_save, approval, restore), the resulting `VersionEntry` object SHALL contain all seven required fields: `id` (non-empty string), `sectionName` (non-empty string), `label` (non-empty string), `timestamp` (valid ISO 8601 string), `source` (one of the five defined values), `content` (object with `type: 'doc'`), and `authorLabel` (non-empty string).

**Validates: Requirements 6.1**

---

### Property 17: Version label and source match the creation event type

*For any* Version entry creation event, the `source` field SHALL match the event type and the `label` field SHALL match the spec-defined pattern: `"AI Rewrite — {action}"` for `ai_rewrite`, `"AI Prompt — {prompt truncated to 40 chars}"` for `ai_prompt`, `"Manual Save"` for `manual_save`, `"Approved & Locked"` for `approval`, and `"Restored from: {original label}"` for restore.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.9**

---

### Property 18: Version Store never exceeds 50 entries per section

*For any* sequence of Version entry creation events for a single section, the Version Store SHALL contain at most 50 entries for that section at any point, discarding the oldest (lowest index after sorting) entry when the limit is exceeded.

**Validates: Requirements 6.6**

---

### Property 19: Version History is always sorted by timestamp descending

*For any* Version Store state with N entries for a given section (N >= 2), the entries as rendered in the Version History panel SHALL be ordered so that each entry's `timestamp` is greater than or equal to the next entry's `timestamp`.

**Validates: Requirements 6.7**

---

### Property 20: Version count badge matches Version Store entry count

*For any* Version Store state with N entries for the active section, the badge on the Version History panel header SHALL display exactly N.

**Validates: Requirements 6.10**

---

### Property 21: Diff Viewer keyboard navigation

*For any* open `DiffViewerModal` instance, pressing `Enter` SHALL trigger the Accept callback and pressing `Escape` SHALL trigger the Reject callback, regardless of which element in the modal has focus.

**Validates: Requirements 7.6**

---

### Property 22: Diff Viewer header shows section name and action label

*For any* `DiffViewerModal` open state, the modal header SHALL contain both the active section's name and the action label string passed as a prop.

**Validates: Requirements 7.7**

---

### Property 23: Prompt History is always sorted by timestamp descending

*For any* Prompt History state with N entries (N >= 2), the entries as rendered in the Prompt History panel SHALL be ordered so that each entry's `timestamp` is greater than or equal to the next entry's `timestamp`.

**Validates: Requirements 8.1**

---

### Property 24: Prompt History entry contains all required display fields

*For any* Prompt History entry, the rendered card SHALL display the prompt text (truncated at 80 characters with ellipsis if longer), the section name it was applied to, the action type, and a human-readable relative timestamp.

**Validates: Requirements 8.2**

---

### Property 25: Re-apply submits the correct prompt against the current active section

*For any* Prompt History entry, clicking "Re-apply" SHALL trigger the same API call as a new submission, using the entry's `promptText` as the prompt and the currently active section (not the section the prompt was originally applied to) as the `section_name`.

**Validates: Requirements 8.3**

---

### Property 26: Citation cards display all five required fields

*For any* citation card data object, the rendered card SHALL display: source document name, regulation number, chapter name, page reference, and confidence score as a percentage string.

**Validates: Requirements 9.3**

---

### Property 27: Verified badge appears only for confidence >= 90

*For any* citation card, the "Verified against regulatory corpus" badge SHALL be present if and only if `confidence >= 90`. For `confidence < 90`, the badge SHALL not be rendered.

**Validates: Requirements 9.4**

---

### Property 28: Citation card click highlights matching editor spans

*For any* citation card click with regulation number X, all Editor text spans matching the pattern `[Reg X | ICDR...]` SHALL have the TipTap Highlight extension applied, and any previously applied highlights SHALL be cleared first.

**Validates: Requirements 9.5**

---

### Property 29: Suggestion cards display severity, title, and description

*For any* suggestion card data object, the rendered card SHALL display a severity badge with one of the three valid severity values (`critical`, `warning`, `info`), a title, and a description.

**Validates: Requirements 10.3**

---

### Property 30: Fix with AI pre-populates and submits the Whole Document Prompt

*For any* suggestion card, clicking "Fix with AI" SHALL set the Whole Document Prompt input to a string derived from the suggestion title and trigger the Whole Document Prompt submission flow identically to a manual submission.

**Validates: Requirements 10.4**

---

### Property 31: Suggestions badge count matches the suggestions array length

*For any* suggestions response (real or mocked) of length N, the Smart Suggestions sub-panel header badge SHALL display exactly N.

**Validates: Requirements 10.6**

---

### Property 32: Cmd+K opens Inline AI palette in any focused Editor state

*For any* state where the Editor is focused, pressing `Cmd+K` (or `Ctrl+K`) SHALL render the `InlineAIPalette` component positioned near the current cursor coordinates.

**Validates: Requirements 11.1**

---

### Property 33: Inline AI API payload includes the cursor paragraph as context_text

*For any* instruction submitted via the Inline AI palette, the POST request body sent to `/api/canvas/inline-ai` SHALL include `company_id`, `section_name`, `instruction` (the typed instruction text), and `context_text` (the full text of the paragraph node containing the cursor at the time the palette was opened).

**Validates: Requirements 11.3**

---

### Property 34: All global keyboard shortcuts fire the correct Canvas action

*For any* keyboard shortcut in the defined set (`Cmd+S`, `Cmd+K`, `Cmd+Z`, `Cmd+Shift+Z`, `Cmd+Enter`, `Escape`), pressing that combination when the Canvas is mounted SHALL trigger exactly the action specified for it, and `Cmd+S` SHALL call `event.preventDefault()` before triggering its action.

**Validates: Requirements 12.1, 12.4**

---

### Property 35: Export API calls use correct endpoints and payloads

*For any* selected export option (section DOCX, section PDF, full DOCX, full PDF), the API call SHALL use the correct endpoint path and the payload SHALL include the required fields: `{ company_id, section_name, content }` for section exports (where `content` is `editor.getHTML()`) and `{ company_id }` for full exports.

**Validates: Requirements 13.2, 13.3, 13.4, 13.5**

---

### Property 36: Successful export triggers a 3-second success toast

*For any* export request that completes with a 2xx response from the backend, a success toast with text "Export complete" SHALL be displayed and SHALL automatically dismiss after exactly 3000 milliseconds.

**Validates: Requirements 13.8**

---

### Property 37: Failed export mock fallback triggers a 3-second warning toast

*For any* export request that fails (non-2xx or network error), the Canvas SHALL trigger a browser download of a plain-text blob AND display a warning toast with text "Backend unavailable — exported as plain text" that dismisses after exactly 3000 milliseconds.

**Validates: Requirements 13.6, 13.9**

---

### Property 38: Canvas never throws on API failures

*For any* API endpoint that returns a non-2xx status or throws a network error, the Canvas SHALL continue rendering without uncaught JavaScript exceptions, using the defined mock response for that endpoint.

**Validates: Requirements 14.1**

---

### Property 39: Offline toast appears exactly once per session

*For any* session in which one or more critical API calls fail, the "Backend offline — using demo mode" toast SHALL be displayed exactly once and SHALL not be shown again for subsequent failures within the same session.

**Validates: Requirements 14.4**

---

### Property 40: Section data pre-populates sidebar with all returned fields

*For any* non-empty sections API response, every returned section object's `draft_text`, `score`, `locked`, and `flagged_gaps` values SHALL be reflected in the Section Sidebar and Editor for that section.

**Validates: Requirements 14.3**

