"""
src/api/admin_router.py

Admin API for Knowledge Base (ChromaDB) inspection.

All endpoints require a valid bearer token. These expose the contents of the
shared regulatory/precedent corpus and allow arbitrary semantic search over
it, so they are not safe to leave open.

Endpoints:
  GET  /api/admin/collections  — list all ChromaDB collections with doc counts
  POST /api/admin/search       — hybrid semantic search within a named collection
"""
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.api.auth_router import get_current_user

# Top-level imports so tests can patch these at module scope
from src.retrieval.vector_store import VectorStore
from src.retrieval.bge_m3_embedder import BGEM3Embedder
from src.retrieval.hybrid_search import HybridSearcher

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ─── Request / Response Models ────────────────────────────────────────────────


class CollectionInfo(BaseModel):
    name: str
    count: int


class SearchRequest(BaseModel):
    collection: str
    query: str
    k: int = 20


class ChunkResult(BaseModel):
    id: str
    score: float
    text: str
    metadata: dict


# ─── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/collections", response_model=List[CollectionInfo])
def list_collections(current_user: dict = Depends(get_current_user)):
    """
    Returns all ChromaDB collections with their document (chunk) counts.
    Used by KnowledgeBase.jsx to populate the collection selector.
    """
    try:
        store = VectorStore()
        collections = store.client.list_collections()
        return [
            CollectionInfo(
                name=col.name,
                count=store.count(col.name),
            )
            for col in collections
        ]
    except Exception as e:
        logger.error(f"Failed to list ChromaDB collections: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"VectorStore error: {str(e)}",
        )


@router.post("/search", response_model=List[ChunkResult])
def admin_search(
    request: SearchRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Hybrid (dense + sparse RRF) search within a named ChromaDB collection.
    Accepts { collection, query, k } and returns top-k results with scores.

    Used by KnowledgeBase.jsx search bar.
    """
    try:
        store = VectorStore()
        embedder = BGEM3Embedder(use_fp16=True)
        searcher = HybridSearcher(embedder=embedder, vector_store=store)

        results = searcher.search(
            collection_name=request.collection,
            query_text=request.query,
            top_k=request.k,
        )

        return [
            ChunkResult(
                id=r["id"],
                score=round(r.get("rrf_score", 0.0), 4),
                text=r.get("text", ""),
                metadata=r.get("metadata", {}),
            )
            for r in results
        ]
    except Exception as e:
        logger.error(f"Admin search failed for collection '{request.collection}': {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Search error: {str(e)}",
        )
