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
    // Throws ApiError on failure — callers render an error state rather than
    // showing an empty list, which would read as "no versions yet".
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
  addVersion: async (companyId, sectionName, entry) => {
    // Optimistic insert so the UI stays responsive.
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

    if (!companyId) return;

    try {
      await canvasApi.saveVersion(companyId, sectionName, entry);
    } catch (e) {
      // Roll the optimistic entry back out. Leaving it would show a version
      // in the history panel that was never persisted — it would vanish on
      // the next reload, and the user would believe it had been saved.
      set((state) => ({
        versions: {
          ...state.versions,
          [sectionName]: (state.versions[sectionName] || []).filter(
            (v) => v.id !== entry.id
          ),
        },
      }));
      throw e;
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
