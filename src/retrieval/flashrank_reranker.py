import logging
import os
from typing import List, Dict, Any

try:
    from flashrank import Ranker, RerankRequest
    HAS_FLASHRANK = True
except ImportError:
    HAS_FLASHRANK = False

logger = logging.getLogger(__name__)

class FlashRankReranker:
    def __init__(self, model_name: str = "ms-marco-MiniLM-L-12-v2", cache_dir: str = "./models"):
        if not HAS_FLASHRANK:
            logger.warning("flashrank is not installed. Reranker will be a no-op.")
            self.ranker = None
            return
            
        logger.info(f"Initializing FlashRank with model {model_name}")
        os.makedirs(cache_dir, exist_ok=True)
        self.ranker = Ranker(model_name=model_name, cache_dir=cache_dir)
        
    def rerank(self, query: str, passages: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
        if not passages:
            return []
            
        if not self.ranker:
            logger.warning("FlashRank not initialized, returning original passages (truncated to top_k).")
            return passages[:top_k]
            
        formatted_passages = []
        for p in passages:
            formatted_passages.append({
                "id": str(p.get("id")),
                "text": p.get("text", ""),
                "meta": p.get("metadata", {})
            })
            
        request = RerankRequest(query=query, passages=formatted_passages)
        results = self.ranker.rerank(request)
        
        final_results = []
        for r in results[:top_k]:
            final_results.append({
                "id": r["id"],
                "text": r["text"],
                "metadata": r.get("meta", {}),
                "flashrank_score": r.get("score")
            })
            
        return final_results
