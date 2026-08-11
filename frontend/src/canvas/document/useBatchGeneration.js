import { useEffect } from 'react';
import useCanvasStore from '../services/canvasStore.js';
import * as canvasApi from '../services/canvasApi.js';
import { markdownToTipTap } from '../editor/markdownToTipTap.js';

export function useBatchGeneration(companyId, editorRefs, showToast) {
  const batchGenerationQueue = useCanvasStore((s) => s.batchGenerationQueue);
  const setBatchGenerationQueue = useCanvasStore((s) => s.setBatchGenerationQueue);
  const isBatchGenerating = useCanvasStore((s) => s.isBatchGenerating);
  const setIsBatchGenerating = useCanvasStore((s) => s.setIsBatchGenerating);
  const upsertSection = useCanvasStore((s) => s.upsertSection);

  useEffect(() => {
    let active = true;

    const processNext = async () => {
      if (batchGenerationQueue.length === 0) {
        setIsBatchGenerating(false);
        showToast('Batch generation complete!', 'success');
        return;
      }

      const sectionName = batchGenerationQueue[0];
      let accumulatedText = "";
      let finalRes = null;

      try {
        const editor = editorRefs?.current?.[sectionName];
        if (editor) {
          editor.commands.setContent('', false);
        }

        await canvasApi.generateSectionStream(companyId, sectionName, (type, payload) => {
          if (!active) return;
          if (type === 'token') {
            accumulatedText += payload;
            if (editorRefs?.current?.[sectionName]) {
              const content = markdownToTipTap(accumulatedText);
              editorRefs.current[sectionName].commands.setContent(content, false);
            }
          } else if (type === 'final') {
            finalRes = payload;
          }
        });

        if (!active) return;

        if (finalRes) {
          const content = markdownToTipTap(finalRes.draft_text);
          if (editorRefs?.current?.[sectionName]) {
            editorRefs.current[sectionName].commands.setContent(content, false);
          }
          // The backend generateSectionStream does not automatically update DB unless it's handled 
          // internally. Wait, /api/agent/run saves to DB. 
          // But we update frontend state anyway to lock it in.
          upsertSection({
            name: sectionName,
            draft_text: finalRes.draft_text,
            content,
            score: finalRes.completeness_score,
            supporting_clause_ids: finalRes.supporting_clause_ids
          });
        }
      } catch (e) {
        if (!active) return;
        console.error('Batch generation failed for', sectionName, e);
        showToast(`Failed to generate ${sectionName}. Generation paused.`, 'error');
        setIsBatchGenerating(false); // Pause the queue
        return; // Exit early
      }

      if (active) {
        // Pop the queue and let the effect re-run
        setBatchGenerationQueue(batchGenerationQueue.slice(1));
      }
    };

    if (isBatchGenerating && batchGenerationQueue.length > 0) {
      processNext();
    } else if (isBatchGenerating && batchGenerationQueue.length === 0) {
      setIsBatchGenerating(false);
    }

    return () => {
      active = false;
    };
  }, [isBatchGenerating, batchGenerationQueue, companyId, editorRefs, upsertSection, setBatchGenerationQueue, setIsBatchGenerating, showToast]);

  return { isBatchGenerating, batchGenerationQueue };
}
