# PROJECT_CONTEXT.md

# Nirmaan AI — Project Context

> **Purpose**
>
> This document serves as the living memory of the frontend redesign.
> It should be updated throughout development so future Claude Code sessions can understand the current project state without scanning the entire repository.

---

# Project Overview

**Project:** Nirmaan AI

**Current Version:** v1 (Existing Application)

**Target Version:** v2 (Frontend Redesign)

This project is a redesign of the existing Nirmaan AI application.

The goal is to transform the current MVP into a production-quality enterprise application while preserving all existing functionality.

This is **NOT** a rewrite.

---

# Objective

Create an enterprise-grade regulatory drafting platform that feels trustworthy, precise and document-centric.

The redesign should reflect the design philosophy defined in `design.md`.

The application should resemble professional software used by:

- Merchant Bankers
- Lawyers
- Chartered Accountants
- Company Secretaries

and should avoid looking like a generic AI product.

---

# Current Status

**Overall Progress**

🟨 Planning

Current Phase:

- Repository cloned
- Design direction finalized
- Development guidelines established
- Frontend redesign yet to begin

---

# Redesign Checklist

## Core Screens

- [ ] Dashboard
- [ ] Workspace
- [ ] Review Workspace
- [ ] Evidence Panel
- [ ] AI Copilot Panel
- [ ] Settings
- [ ] Authentication Screens

## Shared Components

- [ ] Sidebar
- [ ] Top Navigation
- [ ] Buttons
- [ ] Forms
- [ ] Tables
- [ ] Cards
- [ ] Modals
- [ ] Status Indicators
- [ ] Citation Components
- [ ] Empty States
- [ ] Loading States
- [ ] Error States

## Design System Migration

- [ ] Color Tokens
- [ ] Typography
- [ ] Lucide Icons
- [ ] Spacing System
- [ ] Border Radius
- [ ] Shadows Removal
- [ ] Paper Theme Applied

## Technical Improvements

- [ ] Responsive Design
- [ ] Accessibility Review
- [ ] Performance Review
- [ ] Mock Data Review
- [ ] Legacy Styling Cleanup

---

# Screens Updated

| Screen | Status | Last Updated |
|---------|--------|--------------|
| Landing Page (marketing, `/`) | ✅ Done | 2026-08-05 |
| Dashboard | ⏳ Pending | - |
| Workspace | ⏳ Pending | - |
| Review Workspace | ⏳ Pending | - |
| Settings | ⏳ Pending | - |
| Authentication | ⏳ Pending (unchanged, dark theme) | - |

---

# Current Focus

Initial frontend redesign.

Priority order:

1. Dashboard
2. Navigation
3. Workspace
4. Shared Components
5. Remaining Screens
6. Responsive Polish
7. Accessibility Audit

---

# Important Decisions

## Design

- The application follows the design system defined in `design.md`.
- The interface is document-first.
- Paper Mode is the primary experience.
- Night Workspace is intentionally deferred to a future version.
- Avoid AI-product visual clichés (gradients, glassmorphism, neon accents, emoji icons).

## Development

- Existing application architecture should be preserved.
- Improve existing components wherever possible.
- Avoid unnecessary rewrites.
- Preserve existing functionality.

## Landing Page & Routing (2026-08-05)

- The new marketing `LandingPage` (`frontend/src/screens/landing/`) is the **only** redesigned screen so far. It is scoped entirely under a `.landing-v2` wrapper class with its own `landing.css`, imported only by that route — it does not touch or override the existing dark/glassmorphism `index.css` used by every other screen.
- Discovered during planning that the app already has a **real, working backend auth system** (`src/api/auth_router.py`: JWT + bcrypt, `CompanyUser.role` column supporting `'promoter' | 'merchant_banker' | 'admin'`) and a real `Auth.jsx` login/register screen — contrary to an initial assumption that no auth existed. Decision (confirmed with the user): the landing page's "Founder / Promoter" role card routes to the real `/auth` screen rather than faking a login-free flow. The "Merchant Banker" card shows a "coming soon" toast and does not navigate, since no banker-facing dashboard/review flow exists yet — there's a `// TODO(Backend)` comment at that spot in `LoginSection.jsx` noting `CompanyUser.role` already models this for whenever that flow ships.
- `App.jsx` was restructured from a local-state gate (`showAuth`/`showLanding` early-returns) to real routes: `BrowserRouter` now wraps `<App/>` in `main.jsx`, and `App.jsx` uses `Routes`/`useNavigate` directly. New route map: `/` (public marketing page), `/auth` (public, existing `Auth.jsx`, unchanged), `/onboarding` (protected, the old scripted interview, relocated to `screens/Onboarding.jsx` — logic untouched, just renamed from `Landing.jsx`), everything else (`/dashboard`, `/workspace`, `/eligibility`, `/review`, `/documents`, `/knowledge-base`) unchanged but now wrapped in a new `frontend/src/routes/ProtectedRoute.jsx` guard (redirects to `/auth` if no valid JWT, reusing existing `utils/auth.js` — no new backend calls).
- `frontend/src/screens/Landing.jsx` no longer exists — replaced by `screens/landing/LandingPage.jsx` (marketing) and `screens/Onboarding.jsx` (interview, same logic).
- Hero animation (`HeroAnimation.jsx`) is a pure CSS/JS timeline (no animation library), respects `prefers-reduced-motion` and collapses to the same static end-state below 640px.

---

# Backend Status

Backend is considered stable and out of scope.

Frontend development must not require backend modifications.

Existing API contracts should remain unchanged.

If backend limitations block a UI improvement:

- Keep backend untouched.
- Use temporary mock data if required.
- Clearly document assumptions.

---

# Mock Data Tracker

Whenever temporary mock data is introduced, record it here.

| Feature | File | Backend Status | Notes |
|----------|------|----------------|-------|
| None | - | - | - |

Remove entries once replaced by backend APIs.

---

# Known Technical Debt

Record frontend technical debt discovered during redesign.

Example:

- Legacy styling still exists in Dashboard.
- Duplicate button variants.
- Inconsistent spacing.
- Old color palette still used in Workspace.

- `design-system.md` at the repo root is saved as **UTF-16LE**, unlike every other `.md` file in the repo (UTF-8). Tools that assume UTF-8 will show it as garbled/space-separated text. Not fixed (out of scope for a frontend-only session to alter root-level docs without being asked), but worth normalizing to UTF-8 in a future pass.
- **Pre-existing backend bug found during manual testing (not caused by this session's changes):** `GET /api/session/restore` throws `sqlalchemy.exc.OperationalError: no such column: generated_section.updated_at` — the SQLite schema is missing a column the `GeneratedSection` model expects, so `bootstrap()` in `App.jsx` fails with "Failed to fetch"/500 after login. Login, registration, onboarding and navigation all still work because the original code already wrapped this fetch in try/catch, but readiness/section data won't populate on the Dashboard until this is fixed (likely needs a migration or `Base.metadata.create_all` re-run against a fresh DB). Backend is out of scope for this frontend session — flagging for whoever owns `src/`.

---

# Deferred Features

These are intentionally postponed and should not be implemented during the current redesign unless explicitly requested.

- Night Workspace theme
- Backend architectural changes
- New backend APIs
- AI pipeline improvements
- Business logic changes

---

## Working Directory

Primary development work is inside:

/frontend

The backend should only be referenced to understand existing API contracts.

Unless explicitly requested, development work should remain within the frontend codebase.

# Session Notes

Add a short summary after every meaningful development session.

Template:

---

## YYYY-MM-DD

### Completed

-

### Decisions

-

### Mock Data Added

-

### Technical Debt Found

-

### Next Priority

-

---

## 2026-08-05

### Completed

- Built the new marketing `LandingPage` (`frontend/src/screens/landing/`): header, hero with a custom CSS/JS document-knowledge-graph animation, features, how-it-works, security, and a "Continue as" role-selection section (Founder/Promoter, Merchant Banker) — fully scoped under `.landing-v2` per `design-system.md`'s paper/oxblood tokens.
- Relocated the scripted onboarding interview from `screens/Landing.jsx` to `screens/Onboarding.jsx` (logic unchanged) and restructured `App.jsx`/`main.jsx` to real routes (`/`, `/auth`, `/onboarding`, plus a new `ProtectedRoute` guard around everything else).
- Verified end-to-end in-browser: landing → Founder card → real register/login → onboarding → dashboard; Merchant Banker toast; logged-out redirect from protected routes; mobile layout (animation degrades to static end-state, nav collapses); confirmed zero style leakage into Dashboard/Onboarding (still on the original dark theme).

### Decisions

- Confirmed with the user: the landing page's Founder card routes into the real existing `Auth.jsx` login/register flow rather than a fake no-auth stub, since a working JWT-based auth system already existed (see "Landing Page & Routing" under Important Decisions above). This overrode the original task brief's assumption of no auth.

### Mock Data Added

- None. All landing page content (features, how-it-works steps, security points) is static marketing copy, not data intended to come from an API.

### Technical Debt Found

- `design-system.md` is UTF-16LE-encoded (inconsistent with the rest of the repo).
- Pre-existing backend bug: `/api/session/restore` fails (`no such column: generated_section.updated_at`) — see Known Technical Debt above. Not caused by this session.

### Next Priority

- Dashboard redesign (next in the checklist's priority order).

---

## 2026-08-05 (cont'd) — Landing page decluttering pass

### Completed

- Between the first pass above and this one, the landing page components were migrated to **Tailwind CSS v4** (`@tailwindcss/vite` + `@theme` in `landing.css`) and **framer-motion**, and grew a "Traditional Filing vs. Nirmaan AI" comparison table (`MetricsSection.jsx`) plus a dense 2×2 feature grid with terminal-style jargon (`RULES_ENGINE.DLL`, `PROVENANCE_RESOLVED`, `LINKAGE_SCORE`) and a tabbed "ENTRY PORTAL" login. User flagged this as reading like a generic SaaS/hacker-terminal page rather than the calm "filing room" look `design-system.md` calls for.
- Decluttered per user's explicit direction: deleted `MetricsSection.jsx` (comparison table) and the orphaned `FeaturesSection.jsx`/`RoleCard.jsx`. Rewrote `InnovationGrid.jsx` (the features section, still mounted at `id="features"`) down to 5 calm cards (icon, title, one sentence) — no mini-visualizations, no scanner animations, no jargon. Rewrote `LoginSection.jsx` back to a plain two-card "Continue as" layout (dropped the tabs/metrics-grid/mono readouts), keeping the Founder→`/auth` and Merchant Banker "coming soon" toast behavior unchanged.
- Added the two effects requested: (1) the header wordmark now scales up slightly (`scale 1→1.18`) via `framer-motion`'s `useScroll` as the page scrolls (`LandingHeader.jsx`); (2) a subtle low-opacity grid-line background texture on `.landing-v2` (`landing.css`); (3) a scroll-driven "growing dark circle" reveal behind the features section heading, using a `position: sticky` pin zone (`160vh` container, framer-motion `useScroll`/`useTransform` scaling a circle 0→2.6), after which the 5 feature cards continue on the same dark surface — modeled on the referenced freefrontend sticky-scroll-reveal technique. Has a `prefers-reduced-motion` fallback (`StaticFeatures`) that skips straight to the fully-revealed dark section.
- Cleaned up `landing.css`: removed ~250 lines of dead CSS left over from the abandoned Tailwind migration (`.lv-visual-container`, `.compliance-panel`, `.governance-board`, `.audit-log-panel`, `.lv-role-*`, `.lv-steps`/`.lv-step*`, `.lv-btn*`, `.lv-hero-*`, `.lv-toast`) that no longer matched any live component after the migration. Kept only what `LandingHeader.jsx`, `SecuritySection.jsx` (still plain-CSS, untouched), and `LandingFooter.jsx` actually use.
- **Fixed a real bug during verification**: `.landing-v2 h1, h2, h3 { color: var(--ink) }` in `landing.css` had higher CSS specificity than the Tailwind text-color utility classes used inline on dark-background sections, forcing dark ink text onto the new dark features section — headings and card titles were rendering dark-on-dark (invisible). Fixed by removing the hardcoded color from that base rule and relying on inheritance from `.landing-v2`'s own `color` property, which every section already overrides explicitly where needed. Verified via computed-style probes (not just visual screenshot) that both the dark section (now `#FAF8F3` text) and the light `SecuritySection` (still correctly inheriting `#1C1B19`) render correctly.

### Decisions

- Kept Tailwind + framer-motion going forward for the landing page rather than reverting to plain CSS, since the external migration was already in place and system reminders indicated it was intentional — noted the departure from CLAUDE.md's original "no Tailwind" instruction once, did not re-litigate further.

### Technical Debt Found

- The Vite Browser preview tool in this environment produced visually broken/stale screenshots after calling `resize_window` (content appeared squeezed into a narrow column with the rest rendering as flat dark navy) even though DOM/computed-style inspection proved the actual page was laid out correctly. Fresh tabs at native size rendered fine. This is a tooling artifact, not a page bug — worth remembering for future sessions: don't trust a screenshot taken immediately after `resize_window` in this environment; verify with computed styles or a fresh tab instead.
- Several other landing components (`LandingHero.jsx`, `HowItWorksSection.jsx`) now use hardcoded hex colors inline (e.g. `text-[#1C1B19]`) instead of the CSS custom properties, inconsistent with CLAUDE.md's "use design tokens only" rule. Values are correct (match design-system.md exactly), just not token-referenced. Not fixed this pass — flagging for a future cleanup pass, not blocking.

---

## 2026-08-05 (cont'd 2) — Layout/alignment fixes + zig-zag features rebuild

### Completed

- **Root-caused and fixed the "misaligned" complaint**: `index.css` (global, loaded for the whole app) has an unlayered `*, *::before, *::after { margin: 0; padding: 0 }` reset. Per the CSS Cascade Layers spec, unlayered rules always beat layered rules regardless of specificity, and Tailwind v4 wraps every utility in `@layer utilities` — so **every Tailwind padding/margin utility on the landing page was being silently zeroed out** (confirmed: `.p-6` generates `padding: calc(var(--spacing) * 6)` but computed padding was `0px`; `mx-auto` generated `margin-inline: auto` but had no centering effect). `gap-*`, `max-w-*`, colors, flex/grid, and border-radius utilities were unaffected (the reset only touches `box-sizing`/`margin`/`padding`) — that's why some things looked fine and others didn't. Fixed with unlayered, `.landing-v2`-scoped restatements of the exact values Tailwind generates for every `p-*`/`px-*`/`py-*`/`pt-*`/`pb-*`/`mx-*`/`mt-*`/`mb-*`/`ml-*`/`mr-*` class actually used (including `sm:`/`md:` responsive variants), using `[class~="x"]` attribute matching in `landing.css`. Did not touch `index.css` — out of scope, the rest of the app depends on that reset as-is.
- Fixed `HeroAnimation.jsx`: the knowledge-graph connector line was cutting straight through the "GST Returns" document chip. Chips and graph nodes previously shared no consistent coordinate system (chips positioned by CSS %, SVG nodes by viewBox units, on a container whose aspect ratio isn't fixed) and happened to collide. Repositioned chips into a left lane (0-40% width) and graph nodes into a separate right lane (~64-91% width) so they never overlap regardless of container aspect ratio.
- Fixed a broken nav link: the header's "How it Works" link scrolled to `#how-it-works`, but the section's actual id was `pipeline` (typo from the earlier Tailwind migration) — silently did nothing. Renamed the section id to match.
- Rebuilt the features section (`InnovationGrid.jsx`) per explicit user spec: the 5 features now render as a vertical zig-zag list (alternating left/right aligned, `whileInView` fade-slide per item, thin center connector line) instead of a 3-column grid. Reduced-motion and small-screen (`<900px`) fallback (`StaticFeatures`) reuses the same `ZigzagFeatures` list, non-animated.
- Reworked the growing-circle effect after user feedback, twice:
  1. **Gap between circle and features block**: original version used two separate elements (a `position: sticky` pinned box that morphed `width`/`height`/`borderRadius`, followed by a second static box) — the pinned box only filled part of its `h-screen` sticky viewport, leaving visible paper-colored space around it before the second box began. Replaced with a single element: one `motion.div` (holding the heading AND all 5 zig-zag features from the start, natural/auto height) whose `clip-path` is driven by *its own* scroll-into-view progress (`useScroll({ target: boxRef, offset: ['start 0.85', 'start 0.3'] })`) — no pin/sticky, no second element, so there is no seam or gap by construction.
  2. **Reveal direction looked bottom-up / "cut"**: the circle was anchored at `50% 18%` (18% down from the box's top). Since the box is simultaneously scrolling up into view while the circle grows, and the anchor had room to expand both above *and* below itself, the combined motion read as growing upward. Tried anchoring at `50% 0%` (the top edge) next — but a circle centered exactly on the box's own top boundary is half-clipped by that boundary (only the bottom semicircle can ever render), producing a dome shape, not a full circle, confirmed by the user's screenshot.
  3. Dropped `clip-path` entirely. `AnimatedFeatures` now animates real `width`/`height`/`borderRadius` on a small, free-standing circle — not clipped by any container edge, so it's genuinely round. It starts at `opacity: 0` (fully hidden before the section scrolls into view), fades in as a complete small circle once scroll begins, then grows into the full card. The card's target width/height are *measured* live via `ResizeObserver` on a width-reference wrapper and the real content wrapper (not guessed/hardcoded), read inside the `useTransform` mapping functions via a ref so a resize never uses a stale value. Growth is anchored top-down by construction (block-level element, `mx-auto` for horizontal centering only, so its top edge never moves — it only grows taller downward, never upward).
  4. **Starting size too small — heading text visibly re-wrapped as it grew**: `SEED` (starting circle size) was 90px, forcing "Built for the filing room, not a chat window" to lay out across many narrow lines that dramatically reflowed as the box widened. Bumped `SEED` to 260px so the heading has real room from the first visible frame.
  5. **Circle→rectangle transition looked instant, not smooth**: `border-radius` was interpolated linearly from a constant `9999px` down to `32px`. But a `border-radius` larger than half the box's own current size is automatically clamped by the browser to render as a full pill/circle — since the box starts small and grows, the raw 9999→32 value stayed far above that per-frame clamp threshold for roughly 90% of the scroll range (visually no change at all), then dropped below it in the last ~10%, snapping abruptly to a rounded rectangle. Fixed by computing "fully round" relative to the box's *current* size each frame (`Math.min(width, height) / 2`) and interpolating from *that* down to `32px`, so the effective visual roundedness now decreases smoothly and monotonically across the entire scroll range instead of only in the final moment. Verified the interpolation numerically (relative roundedness steps 50% → 46% → ... → 4% across `t = 0…1`) since the animated (desktop, ≥900px) path can't be visually screenshotted in this environment — see the tooling note below.
- Made the light/dark grid-line background texture actually show across the whole page: previously only visible behind `SecuritySection` (the one section with no explicit background color painted over `.landing-v2`'s base grid). Added `.lv-grid-light` / `.lv-grid-dark` classes (light near-black lines vs. faint white lines) applied per-section, since every other section paints its own opaque background color over the shared base.

### Decisions

- None of the underlying architecture changed — this was a bug-fix + one requested layout rebuild pass, not a new direction. See the "Layout/alignment root cause" note above for the standing gotcha: **any new Tailwind spacing utility added to this landing page in the future needs a matching unlayered override added to `landing.css`'s cascade-layer-fix block, or it will silently do nothing.** This is a direct consequence of `index.css`'s global reset being unlayered and out of scope to change; worth remembering before assuming a padding/margin utility "isn't working" is a typo.

### Technical Debt Found

- Confirmed again: this environment's Browser preview tool renders correctly at its native/default pane size, but screenshots taken after `resize_window` (any preset or custom width/height, not just custom pixels as first suspected) show a broken/stale composite. Used computed-style probes (`getComputedStyle`, `elementFromPoint`) as the reliable verification method instead, matching the note from the previous session entry.

### Next Priority

- Dashboard redesign (next in the checklist's priority order).

### Next Priority

- Dashboard redesign (next in the checklist's priority order).

---

Keep session notes concise.

Focus on architectural decisions, completed redesign work, and anything future development sessions should know.

Avoid logging minor styling changes.