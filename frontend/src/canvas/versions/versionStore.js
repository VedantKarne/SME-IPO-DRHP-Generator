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

import * as canvasApi from '../services/canvasApi.js';

const useVersionStore = create((set, get) => ({
  /** @type {Record<string, VersionEntry[]>} Keyed by sectionName, sorted newest-first */
  versions: {},

  /**
   * Load versions from the backend for a specific section.
   *
   * @param {string} companyId
   * @param {string} sectionName
   */
  loadVersions: async (companyId, sectionName) => {
    if (!companyId || !sectionName) return;
    const data = await canvasApi.getVersions(companyId, sectionName);
    set((state) => ({
      versions: {
        ...state.versions,
        [sectionName]: data,
      },
    }));
  },

  /**
   * Add a new version entry for a section and persist to backend.
   * Optimistically updates the UI.
   *
   * @param {string} companyId
   * @param {string} sectionName
   * @param {object} entry - VersionEntry object
   */
  addVersion: (companyId, sectionName, entry) => {
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
    
    // Save to backend asynchronously
    if (companyId) {
      canvasApi.saveVersion(companyId, sectionName, entry);
    }
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
