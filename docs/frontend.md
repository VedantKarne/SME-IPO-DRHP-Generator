# 💅 Frontend Guide

> **React (Vite) frontend architecture** — screens, design system, state management, and component reference.

---

## Overview

The frontend is a **React 19 SPA** built with **Vite 8**, using **React Router DOM v7** for client-side routing. All global state is managed in `App.jsx` and passed down as props — no Redux, Zustand, or Context API is used, keeping the architecture simple and hackathon-friendly.

**Stack:**
- React 19 + Vite 8 (build tooling)
- React Router DOM v7 (`createBrowserRouter`, `<RouterProvider>`)
- react-markdown + remark-gfm (for DRHP section rendering)
- Vanilla CSS design system (`index.css`)

---

## Project Structure

```
frontend/src/
├── App.jsx           # Router + global state + data fetching
├── index.css         # Complete design system (tokens, components, animations)
├── main.jsx          # React 19 root (createRoot)
├── screens/
│   ├── Landing.jsx   # Onboarding interview screen
│   ├── Dashboard.jsx # IPO Readiness overview screen
│   ├── Workspace.jsx # 25-section DRHP editor
│   ├── Eligibility.jsx # SEBI eligibility check report
│   ├── Documents.jsx # Document upload & intelligence
│   └── Review.jsx    # Merchant Banker review portal
└── components/
    └── AppShell.jsx  # Navigation sidebar + layout wrapper
```

---

## Routing (`App.jsx`)

```jsx
const router = createBrowserRouter([
  { path: "/", element: <Landing onComplete={handleOnboardingComplete} /> },
  {
    path: "/",
    element: <AppShell currentSection={currentSection} companyName={companyName} />,
    children: [
      { path: "dashboard", element: <Dashboard ... /> },
      { path: "workspace", element: <Workspace ... /> },
      { path: "eligibility", element: <Eligibility ... /> },
      { path: "documents", element: <Documents ... /> },
      { path: "review", element: <Review ... /> },
    ]
  }
]);
```

The root route `/` shows the `Landing` interview. After completion, `handleOnboardingComplete()` navigates to `/dashboard`.

---

## Global State (`App.jsx`)

Five pieces of state are managed at the App level and passed as props:

| State | Type | Description |
|---|---|---|
| `companyId` | `string \| null` | Current company UUID from demo init |
| `companyName` | `string` | Display name for header/greeting |
| `sections` | `GeneratedSection[]` | All generated sections from API |
| `readiness` | `ReadinessData` | Readiness scores from API |
| `eligibility` | `EligibilityReport` | SEBI check results from API |

**Data fetching** occurs in `useEffect` hooks triggered by `companyId` changes:
```jsx
useEffect(() => {
  if (!companyId) return;
  fetchSections();
  fetchReadiness();
  fetchEligibility();
}, [companyId]);
```

---

## Screen Reference

### `Landing.jsx` — Onboarding Interview

A scripted conversational interview that collects 5 key data points from the SME promoter.

**Key Components:**
- `INTERVIEW_SCRIPT` array: Pre-defined AI messages for each step
- `showAIMessage()`: State machine that advances through the script with typing simulation
- Eligibility check animation at step 5 (2.2s timeout simulation)
- `POST /api/demo/init` with collected answers → creates/updates company in DB

**State:**
```jsx
const [step, setStep] = useState(0);
const [messages, setMessages] = useState([]);
const [inputVal, setInputVal] = useState('');
const [isTyping, setIsTyping] = useState(false);
const [isChecking, setIsChecking] = useState(false);
const [userAnswers, setUserAnswers] = useState([]);
```

**Skip**: The "Skip to demo workspace →" button calls `onComplete()` directly for demos where the interview has already been completed.

---

### `Dashboard.jsx` — IPO Readiness Overview

The main home screen after onboarding. Shows the company's overall IPO preparation progress.

**Key Components:**
- `ScoreRing`: SVG-based animated circular progress ring
  - Uses `strokeDashoffset` with CSS `transition` for smooth animation
  - `setTimeout(() => setAnim(score), 300)` triggers animation after mount
- Sub-score rings: 4 rings for Financial / Legal / Management / Compliance
- Section Pipeline: Approved/Draft/Pending counts
- Next Actions: Hardcoded urgent items list

**`ScoreRing` Props:**
| Prop | Default | Description |
|---|---|---|
| `score` | required | 0–100 integer percentage |
| `size` | 140 | SVG width/height in px |
| `stroke` | 10 | Ring stroke width in px |
| `color` | `var(--accent)` | Ring color (CSS variable or hex) |

---

### `Workspace.jsx` — DRHP Section Editor

The core working screen. Displays all 25 DRHP sections in a 3-column layout: section list (left), editor panel (center), AI chat (bottom of center).

**Layout:**
```
.workspace-layout
├── .section-list          (25-item sidebar)
└── .editor-panel          (main content area)
    ├── .editor-toolbar    (Generate / Edit / History / Approve buttons)
    ├── gap-banner         (conditional — only when gaps > 0)
    ├── .editor-body       (draft content area)
    │   ├── Empty state    (when no draft)
    │   ├── <DraftRenderer> (preview mode)
    │   └── <textarea>     (edit mode)
    └── .card.card-sm      (AI chat panel)
```

**Key Sub-Components:**

**`DraftRenderer`**: Renders section text as React Markdown, making `[Reg X | ICDR 2018]` citation tags clickable (triggers `EvidencePopover`).

```jsx
function DraftRenderer({ text, onCitationClick }) {
  // Splits text on citation patterns
  const parts = text.split(/([\[Reg\s+\w+...]/g);
  // Citation tags render as clickable <span class="citation-tag">
  // Everything else renders as <ReactMarkdown>
}
```

**`EvidencePopover`**: Appears on citation click. Shows regulation number, chapter, document, page reference, and confidence percentage. Positioned absolutely near the clicked citation.

**`VersionHistory`**: Lists 3 simulated version entries. Clicking a version updates `editText` to simulate time-travel (v1 = first half of text, v2 = formal version, v3 = current).

**Section List Merging:**
```jsx
// Merges API sections with the full 25-section template
const mergedSections = SECTIONS_25.map(name => {
  const existing = sections.find(s => s.name === name);
  return existing || { id: null, name, status: 'pending', draft_text: '', score: 0 };
});
```

This ensures all 25 sections are always visible — even those not yet generated.

**Status Indicators:**
- `✓` (green) = Approved & locked
- `~` (yellow) = In draft
- `○` (muted) = Not yet generated

---

### `Eligibility.jsx` — SEBI Check Report

Calls `GET /api/eligibility/{companyId}` and renders the full `EligibilityReport`.

**Sections:**
1. Overall eligibility badge (large ✅ or ❌)
2. Per-check table with pass/fail badges
3. Regulatory citations list
4. Remediation guidance for failed checks (hardcoded lookup by `clause_id`)

---

### `Documents.jsx` — Document Intelligence

Simulates a document upload and AI extraction workflow.

**Features:**
- Drag-and-drop upload zones for regulatory PDFs + financial documents
- "Uploading..." → "Processing with Gemini..." → "Extracted" state progression (`setTimeout` simulation)
- Hidden `<input type="file">` elements for realistic file selection UX
- Extracted KPI summary card (mocked data, consistent with demo DB)

---

### `Review.jsx` — Merchant Banker Portal

A multi-column Kanban-style review board for the banker approval workflow.

**Columns:**
- 📋 **Awaiting Review**: Sections with `draft_text` but not locked
- ✅ **Approved**: Locked sections
- 🔄 **Returned to Issuer**: Sections rejected with comments

**Actions (simulated in React state):**
- "Approve" → moves section to Approved column
- "Request Changes" → opens inline comment textarea
- "Return to Issuer" → moves to Returned column with rejection reason

---

### `AppShell.jsx` — Navigation Sidebar + Layout

A persistent left sidebar visible across all authenticated routes. Uses `useNavigate()` and `useLocation()` for active link highlighting.

**Navigation Links:**
```jsx
const NAV_ITEMS = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/workspace', icon: '📝', label: 'Workspace' },
  { path: '/eligibility', icon: '⚖️', label: 'Eligibility' },
  { path: '/documents', icon: '📂', label: 'Documents' },
  { path: '/review', icon: '🔍', label: 'Banker Review' },
];
```

The shell also displays:
- Nirmaan AI logo + version
- Company name (from `companyName` prop)
- Current section badge (from `currentSection` prop, updated by Workspace)

---

## Design System (`index.css`)

The design system uses CSS custom properties (variables) for theming:

### Color Tokens
```css
:root {
  --bg-primary: #0A0A0F;        /* Deep dark background */
  --bg-secondary: #101018;      /* Card backgrounds */
  --bg-tertiary: #161624;       /* Input/panel backgrounds */
  --accent: #4F7EFF;            /* Primary blue accent */
  --accent-dim: rgba(79,126,255,0.1);  /* Translucent accent */
  --success: #10B981;           /* Green (approved) */
  --warning: #F59E0B;           /* Amber (in draft) */
  --error: #F43F5E;             /* Red (gaps/failed) */
  --purple: #8B5CF6;            /* Purple (management score) */
  --glass-bg: rgba(255,255,255,0.03);  /* Glassmorphism card bg */
  --glass-border: rgba(255,255,255,0.08);  /* Glassmorphism border */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #475569;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
}
```

### Glassmorphism Effect
Applied to `.card`:
```css
.card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 20px;
}
```

### Animations
```css
/* Fade-in: used on AI-generated content + panel transitions */
.fade-in { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; } }

/* Spinning loader: used on Generate buttons */
.spin { display: inline-block; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Typing indicator: three bouncing dots */
.typing-dot {
  width: 6px; height: 6px; background: var(--accent);
  border-radius: 50%; animation: typingBounce 1.2s ease-in-out infinite;
}
```

### Component Classes

| Class | Usage |
|---|---|
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-success` | Buttons |
| `.btn-sm`, `.btn-lg` | Button sizes |
| `.badge`, `.badge-accent`, `.badge-success`, `.badge-warning`, `.badge-error` | Status pills |
| `.card`, `.card-sm` | Glassmorphism cards |
| `.citation-tag` | Clickable regulatory citation tags |
| `.chat-msg`, `.chat-msg-user`, `.chat-msg-ai` | Chat bubbles |
| `.typing-indicator`, `.typing-dot` | AI typing animation |
| `.workspace-layout` | 2-column workspace grid |
| `.section-list`, `.section-list-item` | 25-section sidebar |
| `.editor-panel`, `.editor-toolbar`, `.editor-body` | Editor layout |
| `.landing`, `.landing-bg`, `.landing-grid` | Landing page |
| `.interview-window` | Chat interview container |

---

## Running the Frontend

```bash
cd frontend
npm install          # First time only
npm run dev          # Start dev server at http://localhost:5173
```

To change the API base URL:
```jsx
// frontend/src/screens/*.jsx — change this line at the top
const API = 'http://localhost:8000';
```
