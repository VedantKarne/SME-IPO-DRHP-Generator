import logging
from typing import List, Dict, Any, Literal, Optional

from src.retrieval.bge_m3_embedder import BGEM3Embedder
from src.retrieval.vector_store import VectorStore
from src.retrieval.parent_doc_store import ParentDocStore
from src.retrieval.flashrank_reranker import FlashRankReranker

logger = logging.getLogger(__name__)

class HybridRetriever:
    def __init__(self, embedder: BGEM3Embedder, vector_store: VectorStore, parent_store: ParentDocStore, reranker: FlashRankReranker):
        self.embedder = embedder
        self.vector_store = vector_store
        self.parent_store = parent_store
        self.reranker = reranker

    def _compute_sparse_score(self, query_sparse: Dict[str, float], doc_sparse: Dict[str, float]) -> float:
        score = 0.0
        for token, q_weight in query_sparse.items():
            if token in doc_sparse:
                score += q_weight * doc_sparse[token]
        return score

    def _single_corpus_hybrid_search(
        self, collection_name: str, query_dense: List[float], query_sparse: Dict[str, float], 
        filters: Optional[dict], k: int, weights: dict
    ) -> List[Dict[str, Any]]:
        
        # 1. Retrieve Dense Results
        dense_results = self.vector_store.query_dense(
            collection_name=collection_name,
            query_dense_vec=query_dense,
            n_results=k,
            where=filters
        )
        
        dense_ranked_ids = dense_results["ids"][0] if dense_results["ids"] else []
        dense_docs = dense_results["documents"][0] if dense_results["documents"] else []
        dense_metadatas = dense_results["metadatas"][0] if dense_results["metadatas"] else []
        
        doc_lookup = {}
        for i, doc_id in enumerate(dense_ranked_ids):
            doc_lookup[doc_id] = {
                "id": doc_id,
                "text": dense_docs[i],
                "metadata": dense_metadatas[i]
            }
            
        # 2. Retrieve Sparse Results (Fallback logic)
        sparse_scores = []
        # Optimization: in a real system we'd filter the sparse index by collection
        # Here we just iterate over all and score, then rely on doc_lookup to filter to dense candidates
        for doc_id, doc_sparse in self.vector_store.fallback_sparse_index.items():
            score = self._compute_sparse_score(query_sparse, doc_sparse)
            if score > 0:
                sparse_scores.append((doc_id, score))
                
        sparse_scores.sort(key=lambda x: x[1], reverse=True)
        sparse_ranked_ids = [x[0] for x in sparse_scores[:k]]
        
        # 3. Reciprocal Rank Fusion (RRF)
        rrf_scores = {}
        rrf_k = 60
        dense_weight = weights.get("dense", 0.5)
        sparse_weight = weights.get("sparse", 0.5)
        
        for rank, doc_id in enumerate(dense_ranked_ids):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + dense_weight * (1.0 / (rrf_k + rank + 1))
            
        for rank, doc_id in enumerate(sparse_ranked_ids):
            if doc_id in doc_lookup:
                rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + sparse_weight * (1.0 / (rrf_k + rank + 1))
                
        sorted_rrf = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        
        fused = []
        for doc_id, score in sorted_rrf:
            if doc_id in doc_lookup:
                doc = doc_lookup[doc_id].copy()
                doc["rrf_score"] = score
                fused.append(doc)
            if len(fused) >= k:
                break
        return fused

    def hybrid_retrieve(
        self, 
        query: str, 
        corpus: Literal["regulatory", "precedent", "both"],
        filters: Optional[dict] = None, 
        k: int = 5,
        mode: Literal["compliance", "precedent", "gap"] = "compliance"
    ) -> List[Dict[str, Any]]:
        
        weights = {
            "compliance": {"dense": 0.35, "sparse": 0.65},
            "precedent":  {"dense": 0.65, "sparse": 0.35},
            "gap":        {"dense": 0.50, "sparse": 0.50},
        }.get(mode, {"dense": 0.50, "sparse": 0.50})
        
        query_vectors = self.embedder.embed_chunks([query])
        # embed_chunks returns a dict with 'dense' and 'sparse' arrays
        query_dense = query_vectors["dense"][0]
        query_sparse = query_vectors["sparse"][0]
        
        candidates = []
        
        if corpus in ["regulatory", "both"]:
            reg_fused = self._single_corpus_hybrid_search(
                "regulatory_clauses", query_dense, query_sparse, filters, k * 3, weights
            )
            candidates.extend(reg_fused)
            
        if corpus in ["precedent", "both"]:
            prec_fused = self._single_corpus_hybrid_search(
                "precedent_chunks", query_dense, query_sparse, filters, k * 3, weights
            )
            candidates.extend(prec_fused)
            
        # Parent expansion
        expanded_candidates = []
        for doc in candidates:
            doc_id = doc["id"]
            parent_text = self.parent_store.expand_to_parent(doc_id)
            if parent_text:
                # Replace child chunk text with full parent context for LLM
                doc["text"] = parent_text 
            expanded_candidates.append(doc)
            
        # FlashRank reranking
        reranked = self.reranker.rerank(query, expanded_candidates, top_k=k)
        
        return reranked
