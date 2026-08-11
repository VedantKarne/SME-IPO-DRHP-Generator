import { create } from 'zustand';

/**
 * useCanvasStore — Global UI state for the AI Authoring Canvas.
 *
 * State shape:
 *   companyId          {string}         – active company ID
 *   companyName        {string}         – display name of the company
 *   sections           {Section[]}      – merged SECTIONS_25 + API data
 *   activeSectionIdx   {number}         – index into sections (0-based)
 *   aiPanelVisibility  {object}         – per-panel open/close flags
 *   promptHistory      {PromptEntry[]}  – session-scoped log, newest-first
 *   offlineNotified    {boolean}        – suppresses repeated offline toast
 *
 * PromptEntry shape:
 *   id          {string}  – crypto.randomUUID()
 *   promptText  {string}
 *   sectionName {string}
 *   actionType  {'rewrite'|'expand'|'simplify'|'investor_friendly'|'whole-doc'|'chat'}
 *   timestamp   {string}  – ISO 8601
 *
 * Requirements: 1.9, 8.5
 */
const useCanvasStore = create((set) => ({
  // ─── State ────────────────────────────────────────────────────────────────

  companyId: '',
  companyName: '',

  /** Merged array of Section objects (SECTIONS_25 stubs + API data). */
  sections: [],

  /** Currently viewed section index (0 = first section). */
  activeSectionIdx: 0,

  /**
   * Visibility flags for the four AI sub-panels.
   * All start open (true) so the panel is fully expanded on first load.
   */
  aiPanelVisibility: {
    chat: true,
    promptHistory: true,
    evidence: true,
    suggestions: true,
  },

  /**
   * Session-scoped prompt history, sorted newest-first.
   * Entries are prepended by appendPromptHistory.
   */
  promptHistory: [],

  /**
   * Whether the "Backend offline — using demo mode" toast has already
   * been shown this session. Prevents repeated toasts on every failed call.
   */
  offlineNotified: false,

  /**
   * Whether the app's main nav (GlobalSidebar) is collapsed to an icon-only
   * rail in favour of showing the Sections panel. Read by both GlobalSidebar
   * (which isn't a descendant of CanvasLayout — they're routed as siblings)
   * and CanvasLayout, so it lives here rather than as local component state.
   * Defaults true: arriving at /workspace should always start in rail mode.
   */
  navRailCollapsed: true,

  /**
   * Set of section names currently checked in the sidebar.
   */
  selectedSections: new Set(),

  /**
   * Queue of section names waiting to be generated.
   */
  batchGenerationQueue: [],

  /**
   * True if a batch generation is currently running.
   */
  isBatchGenerating: false,

  // ─── Actions ──────────────────────────────────────────────────────────────

  /**
   * setActiveSectionIdx(idx)
   * Switch the active section by its index in the sections array.
   *
   * @param {number} idx – target section index (0–24)
   */
  setActiveSectionIdx: (idx) => set({ activeSectionIdx: idx }),

  /**
   * setNavRailCollapsed(collapsed)
   * true  → main nav is an icon-only rail, Sections panel is visible.
   * false → main nav is fully expanded, Sections panel is hidden.
   */
  setNavRailCollapsed: (collapsed) => set({ navRailCollapsed: collapsed }),

  /**
   * upsertSection(sectionData)
   * Update an existing section in the sections array by matching on `name`,
   * or append it to the end if no match is found.
   *
   * @param {object} sectionData – partial or full Section object; must include `name`
   */
  upsertSection: (sectionData) =>
    set((state) => {
      const idx = state.sections.findIndex((s) => s.name === sectionData.name);
      if (idx === -1) {
        // Section not found — append as new entry
        return { sections: [...state.sections, sectionData] };
      }
      // Section found — merge incoming data over the existing entry
      const updated = [...state.sections];
      updated[idx] = { ...updated[idx], ...sectionData };
      return { sections: updated };
    }),

  /**
   * appendPromptHistory(entry)
   * Prepend a PromptEntry to promptHistory so the list stays newest-first.
   *
   * @param {object} entry – PromptEntry object (caller is responsible for
   *                         setting id via crypto.randomUUID() and timestamp)
   */
  appendPromptHistory: (entry) =>
    set((state) => ({
      promptHistory: [entry, ...state.promptHistory],
    })),

  /**
   * setAIPanelVisibility(panelKey, visible)
   * Toggle the visibility of a single AI sub-panel without affecting others.
   *
   * @param {'chat'|'promptHistory'|'evidence'|'suggestions'} panelKey
   * @param {boolean} visible
   */
  setAIPanelVisibility: (panelKey, visible) =>
    set((state) => ({
      aiPanelVisibility: {
        ...state.aiPanelVisibility,
        [panelKey]: visible,
      },
    })),

  /**
   * setOfflineNotified(value)
   * Mark that the offline toast has been shown so it isn't repeated.
   *
   * @param {boolean} value
   */
  setOfflineNotified: (value) => set({ offlineNotified: value }),

  /**
   * toggleSectionSelection(name)
   * Check or uncheck a section in the sidebar.
   */
  toggleSectionSelection: (name) =>
    set((state) => {
      const next = new Set(state.selectedSections);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return { selectedSections: next };
    }),

  /**
   * clearSectionSelection()
   */
  clearSectionSelection: () => set({ selectedSections: new Set() }),

  /**
   * setBatchGenerationQueue(queue)
   */
  setBatchGenerationQueue: (queue) => set({ batchGenerationQueue: queue }),

  /**
   * setIsBatchGenerating(bool)
   */
  setIsBatchGenerating: (bool) => set({ isBatchGenerating: bool }),
}));

export default useCanvasStore;
