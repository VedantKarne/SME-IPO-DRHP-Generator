# CLAUDE.md

# Nirmaan AI – Frontend Redesign Guide

## Project Context

This repository contains the existing implementation (v1) of **Nirmaan AI**, an AI-assisted DRHP drafting and IPO disclosure platform.

The purpose of this work is **NOT** to rebuild the application from scratch.

The objective is to redesign and improve the existing frontend while preserving all existing product functionality and backend integrations.

Treat this as a production UI redesign of an existing enterprise application.

---

# Primary Goal

Improve the user experience by:

- Redesigning the interface
- Improving visual hierarchy
- Applying the new design system
- Improving readability
- Improving layout consistency
- Improving responsiveness
- Improving accessibility
- Creating a document-first experience

without changing how the application works.

---

# Scope

This project is **frontend-only**.

Allowed work includes:

- React components
- JSX / TSX
- CSS
- Tailwind classes
- Design tokens
- Layout improvements
- Component styling
- Typography
- Icons
- Navigation
- Responsiveness
- Animations (subtle only)
- UI states
- Empty states
- Loading states
- Error presentation

---

# Out of Scope

DO NOT modify:

- Backend logic
- API endpoints
- Database schema
- Authentication flow
- Business logic
- AI pipeline
- Document generation logic
- Retrieval pipeline
- Prompt engineering
- Server configuration
- Python backend
- Express/FastAPI routes
- Environment variables
- Deployment configuration

Assume backend behavior is correct unless explicitly instructed otherwise.

---

# Backend Contract

Frontend changes must preserve all existing backend integrations.

Do not:

- rename API fields
- modify request payloads
- change response parsing
- remove existing API calls
- change endpoint URLs
- introduce breaking interface changes

If a backend limitation blocks a UI improvement:

- build the frontend around the existing API
- use placeholders if necessary
- clearly document assumptions
- never invent backend functionality

---

# Mock Data Policy

Some new UI features introduced during the redesign may require backend data that is not yet available.

In such cases, it is acceptable to use temporary mock data **only for frontend development**.

However, mock data must follow these rules:

- Keep mock data isolated from UI components whenever possible (e.g. `/src/mocks`, `/mock-data`, or similar).
- Structure mock objects to closely match the expected backend API response.
- Avoid hardcoding mock values directly inside components unless absolutely necessary.
- Components should consume mock data the same way they would consume API data, making future replacement straightforward.

Every temporary mock implementation must include a clear comment indicating that it is a placeholder.

Example:

```ts
// TODO(Backend):
// Temporary mock data for frontend development.
// Replace with actual API response once the backend endpoint is available.
```

or

```ts
// MOCK DATA
// Replace with backend API integration when endpoint becomes available.
```

When backend APIs become available, replacing mock data should require minimal code changes.

Preferred migration path:

Mock Data
        ↓
API Service
        ↓
Existing UI Component

The UI component itself should require little or no modification.

Never build UI components that are tightly coupled to temporary mock data.

If an expected API contract is unknown:

- create a reasonable placeholder structure
- document assumptions
- keep the data model easy to replace
- do not invent backend functionality beyond what is required to render the interface

Mock data is a temporary development aid, not part of the final implementation.

# API Compatibility

When introducing new frontend features that will later consume backend APIs:

- Design components around props and data models rather than static values.
- Separate presentation from data fetching.
- Avoid mixing API calls with UI rendering logic.
- Prefer a service or hook layer (`services/`, `api/`, or `hooks/`) for future backend integration.

This allows mock data to be replaced with live API responses without requiring component rewrites.

# Existing Components

Prefer improving existing components instead of replacing them.

When editing:

1. understand the current component
2. preserve its behavior
3. improve its UI
4. simplify only when functionality remains identical

Avoid unnecessary rewrites.

Refactor only when it improves maintainability without changing functionality.

---

# Design Philosophy

Follow the project's Design System.

Core principles:

- The document is the interface.
- The document is always visually dominant.
- The UI should resemble a professional regulatory drafting workspace.
- Avoid AI-product visual clichés.
- Every visual decision should reinforce trust, precision and evidence.

---

# Visual Style

Avoid:

- gradients
- glassmorphism
- backdrop blur
- neon colors
- purple AI styling
- oversized shadows
- oversized rounded corners
- emoji icons

Prefer:

- paper-like surfaces
- hairline borders
- restrained spacing
- serif document typography
- sans-serif UI chrome
- subtle interactions
- calm hierarchy

---

# Component Principles

Every component should answer:

Does this help someone review or draft a regulatory document?

If not, simplify it.

Chrome should never compete with document content.

---

# Typography

Document content:
- Source Serif 4

UI:
- Inter

Numbers:
- IBM Plex Mono

Respect the typography scale defined in design.md.

---

# Color Rules

Use design tokens only.

Never hardcode colors unless absolutely necessary.

Primary accent:

--signal

Status colors:

Approved
Draft
Gap
Pending

Never introduce additional accent colors.

---

# Layout

Maintain consistent spacing using the design token scale.

Prefer:

- grids
- alignment
- whitespace
- hierarchy

over decorative elements.

---

# Icons

Use Lucide.

Never use:

- emojis
- filled icon packs
- decorative illustrations unless requested.

---

# Shadows

Do not use shadows for hierarchy.

Prefer:

- borders
- spacing
- contrast
- alignment

---

# Responsiveness

Every UI change should work across:

- desktop
- tablet
- mobile (where applicable)

Avoid desktop-only assumptions.

---

# Accessibility

Preserve or improve:

- keyboard navigation
- semantic HTML
- focus states
- color contrast
- screen-reader compatibility

Never reduce accessibility.

---

# Performance

Avoid unnecessary:

- rerenders
- dependencies
- animations
- large component rewrites

Prefer incremental improvements.

---

# Code Style

When modifying code:

- preserve existing architecture
- follow existing folder structure
- avoid introducing unnecessary abstractions
- keep components readable
- avoid premature optimization

---

# Before Creating New Components

Always check whether an existing component can be extended first.

Prefer reuse over duplication.

---

# Before Deleting Code

Assume existing functionality is required.

If something appears unused:

- verify first
- do not remove backend-related logic
- avoid deleting API interactions

---

# When Unsure

If a requested UI improvement would require backend changes:

DO NOT implement backend changes.

Instead:

- keep backend untouched
- suggest a frontend-compatible solution
- explain the limitation

---

# Success Criteria

The finished application should feel like:

"A professional document drafting platform used by merchant bankers, lawyers, company secretaries and CAs."

It should **not** resemble:

- an AI chatbot
- a generic SaaS dashboard
- a startup landing page
- a crypto platform
- a productivity template

The interface should communicate:

- trust
- precision
- auditability
- evidence
- governance
- professionalism

before it communicates AI.

# Project Context Maintenance

This repository contains a `PROJECT_CONTEXT.md` file that serves as the living memory of the project.

Before starting any implementation task:

1. Read `PROJECT_CONTEXT.md` to understand:
   - Current redesign progress
   - Completed work
   - Pending work
   - Important design decisions
   - Known technical debt
   - Active implementation focus

Do not rely solely on scanning the codebase to understand the project state.

---

## Keeping PROJECT_CONTEXT.md Updated

Whenever a meaningful frontend change is completed, update `PROJECT_CONTEXT.md`.

Examples include:

- A redesigned screen
- A completed component migration
- A new design decision
- Introduction of new design tokens
- Mock data added for a feature
- Important architectural decisions
- UX improvements
- Newly discovered technical debt
- Backend assumptions
- Deferred features

Updates should be concise and high-level.

Do **not** log every small CSS or styling change.

Instead, record decisions that would help future development sessions quickly understand the current state of the project.

---

## Session Workflow

For every development session, follow this order:

1. Read `CLAUDE.md`.
2. Read `PROJECT_CONTEXT.md`.
3. Review `design.md` when implementing UI changes.
4. Inspect only the relevant parts of the codebase.
5. Implement the requested frontend changes.
6. Update `PROJECT_CONTEXT.md` if the work changes the project's overall progress or decisions.

The goal is to minimize repeated repository scanning and maintain continuity across development sessions.

## Documentation Rule

If a significant design or implementation decision is made during development, document it in `PROJECT_CONTEXT.md` immediately rather than relying on future sessions to rediscover it.

Treat `PROJECT_CONTEXT.md` as the project's single source of truth for redesign progress and architectural decisions.