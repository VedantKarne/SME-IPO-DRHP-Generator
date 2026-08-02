import { create } from 'zustand';

/**
 * Version Store — tracks TipTap content snapshots per section.
 *
 * VersionEntry shape:
 * {
 *   id:          string,   // crypto.randomUUID()
 *   sectionName: string,
 *   label:       string,   // e.g. "AI Rewrite — Investor Friendly"
 *   timestamp:   string,   // ISO 8601
 *   source:      'ai_rewrite' | 'ai_prompt' | 'manual_save' | 'ai_chat' | 'approval',
 *   content:     object,   // TipTap JSON { type: 'doc', content: [...] }
 *   authorLabel: string,   // 'AI' | 'User'
 * }
 */

const MAX_VERSIONS_PER_SECTION = 50;

const useVersionStore = create((set, get) => ({
  /** @type {Record<string, VersionEntry[]>} Keyed by sectionName, sorted newest-first */
  versions: {},

  /**
   * Add a new version entry for a section.
   * Prepends the entry (newest-first) and trims to MAX_VERSIONS_PER_SECTION.
   *
   * @param {string} sectionName
   * @param {object} entry - VersionEntry object
   */
  addVersion: (sectionName, entry) => {
    set((state) => {
      const existing = state.versions[sectionName] || [];
      const updated = [entry, ...existing].slice(0, MAX_VERSIONS_PER_SECTION);
      return {
        versions: {
          ...state.versions,
          [sectionName]: updated,
        },
      };
    });
  },

  /**
   * Get all version entries for a section, sorted newest-first.
   *
   * @param {string} sectionName
   * @returns {object[]} Array of VersionEntry objects (may be empty)
   */
  getVersions: (sectionName) => {
    return get().versions[sectionName] || [];
  },
}));

export default useVersionStore;
