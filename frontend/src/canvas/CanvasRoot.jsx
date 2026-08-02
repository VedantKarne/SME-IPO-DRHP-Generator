/**
 * CanvasRoot.jsx
 *
 * Entry point for the AI Authoring Canvas.
 * Seeds canvasStore with section data, then delegates entirely to CanvasLayout
 * which implements the new Word/Docs-inspired single-document experience.
 *
 * Props:
 *   companyId   {string}
 *   sections    {object[]}  – pre-loaded section stubs from App.jsx (may be [])
 *   companyName {string}
 */

import { useEffect } from 'react';
import useCanvasStore from './services/canvasStore.js';
import { SECTIONS_25 } from './services/canvasApi.js';
import CanvasLayout from './document/CanvasLayout.jsx';

// Import the new canvas CSS (A4 paper, workspace, toolbar, copilot)
import './document/canvas.css';

export default function CanvasRoot({
  companyId   = '',
  sections: propSections = [],
  companyName = '',
}) {
  const upsertSection = useCanvasStore((s) => s.upsertSection);

  // Stable serialisation key — only re-runs when section data actually changes
  const propSectionsKey = JSON.stringify(
    propSections.map((s) => ({
      name:       s.name,
      draft_text: s.draft_text,
      locked:     s.locked,
      score:      s.score,
    }))
  );

  useEffect(() => {
    if (propSections && propSections.length > 0) {
      // Seed store with API-provided section data
      propSections.forEach((s) => upsertSection(s));
    } else if (useCanvasStore.getState().sections.length === 0) {
      // Fallback: seed all 25 DRHP sections as empty stubs
      SECTIONS_25.forEach((name) =>
        upsertSection({
          name,
          title:       name,
          status:      'pending',
          draft_text:  '',
          score:       0,
          locked:      false,
          flagged_gaps: [],
        })
      );
    }
  }, [propSectionsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CanvasLayout
      companyId={companyId}
      companyName={companyName}
    />
  );
}
