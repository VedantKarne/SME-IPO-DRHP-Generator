import os
import json
import logging
from typing import List, Dict, Any, Optional

try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_VERSION = chromadb.__version__
except ImportError:
    chromadb = None
    CHROMA_VERSION = "0.0.0"

logger = logging.getLogger(__name__)

class VectorStore:
    def __init__(self, persist_dir: str = "Databases/.chroma"):
        if not chromadb:
            raise RuntimeError("chromadb is not installed.")
            
        self.persist_dir = persist_dir
        self.client = chromadb.PersistentClient(path=self.persist_dir)
        
        # Check sparse support (requires 0.5.0+)
        version_parts = [int(p) for p in CHROMA_VERSION.split(".")[:2]]
        if version_parts[0] > 0 or (version_parts[0] == 0 and version_parts[1] >= 5):
            self.supports_sparse = True
            logger.info(f"ChromaDB version {CHROMA_VERSION} supports native sparse vectors.")
        else:
            self.supports_sparse = False
            logger.warning(f"ChromaDB version {CHROMA_VERSION} DOES NOT support sparse vectors natively.")
            logger.warning("Falling back to dense-only Chroma + separate local sparse JSON index.")
            
        # Initialize fallback store universally as the Chroma python client API for native sparse is experimental
        self.fallback_sparse_index = {}
        self._load_fallback_sparse()
            
        self._init_collections()

    def _init_collections(self):
        # We use default L2 distance for dense. 
        # For sparse, Chroma handles it internally (usually inner product or similar) if supported.
        self.reg_collection = self.client.get_or_create_collection(name="regulatory_clauses")
        self.prec_collection = self.client.get_or_create_collection(name="precedent_chunks")
        
    def _load_fallback_sparse(self):
        fallback_path = os.path.join(self.persist_dir, "fallback_sparse.json")
        if os.path.exists(fallback_path):
            with open(fallback_path, 'r', encoding='utf-8') as f:
                self.fallback_sparse_index = json.load(f)
                
    def _save_fallback_sparse(self):
        if not os.path.exists(self.persist_dir):
            os.makedirs(self.persist_dir)
        fallback_path = os.path.join(self.persist_dir, "fallback_sparse.json")
        with open(fallback_path, 'w', encoding='utf-8') as f:
            json.dump(self.fallback_sparse_index, f)

    def add_chunks(self, collection_name: str, ids: List[str], documents: List[str], 
                   metadatas: List[Dict[str, Any]], dense_vecs: List[List[float]], 
                   sparse_vecs: List[Dict[str, float]]):
        """
        Ingests vectors into ChromaDB. Handles fallback if sparse is not natively supported.
        """
        if not ids:
            return
            
        collection = self.reg_collection if collection_name == "regulatory_clauses" else self.prec_collection
        
        # Ensure metadata values are basic types (str, int, float, bool)
        clean_metadatas = []
        for m in metadatas:
            clean_m = {}
            for k, v in m.items():
                if v is None:
                    continue
                if isinstance(v, (str, int, float, bool)):
                    clean_m[k] = v
                elif isinstance(v, list):
                    # Convert lists to comma-separated strings for Chroma metadata
                    clean_m[k] = ",".join(str(x) for x in v)
                else:
                    clean_m[k] = str(v)
            clean_metadatas.append(clean_m)

        if self.supports_sparse:
            # Native sparse support: Chroma Python client doesn't yet expose sparse directly in standard add(), 
            # or rather, it might require specific kwargs if it's an advanced feature.
            # Assuming hypothetical future/current API:
            # (Note: Current chromadb python API doesn't officially document a separate sparse_embeddings parameter in standard Collection.add. 
            # It usually requires using a specific embedding function or passing it via embeddings.
            # We will pass dense as embeddings. For now, we will store sparse in fallback if the client throws or just use fallback to be safe if the API is volatile.)
            
            # Since the exact kwarg for sparse in Chroma 0.5+ python client is still experimental/undocumented for direct insertion alongside dense,
            # we will store dense in Chroma and use the fallback for sparse universally to guarantee stability for the hackathon,
            # or try to pass it if we know the exact API. 
            # We'll use the fallback universally for sparse to be 100% safe, making it robust.
            pass
            
        # Upsert dense to Chroma (avoids DuplicateIDError if re-running pipeline)
        collection.upsert(
            ids=ids,
            documents=documents,
            metadatas=clean_metadatas,
            embeddings=dense_vecs
        )
        
        # Add sparse to fallback index
        for i, doc_id in enumerate(ids):
            self.fallback_sparse_index[doc_id] = sparse_vecs[i]
            
        self._save_fallback_sparse()

    def query_dense(self, collection_name: str, query_dense_vec: List[float], n_results: int = 5, where: Optional[Dict] = None):
        collection = self.reg_collection if collection_name == "regulatory_clauses" else self.prec_collection
        
        results = collection.query(
            query_embeddings=[query_dense_vec],
            n_results=n_results,
            where=where,
            include=["documents", "metadatas", "distances"]
        )
        return results

    def get_sparse_vector(self, doc_id: str) -> Dict[str, float]:
        """Retrieve the sparse vector from the fallback store."""
        return self.fallback_sparse_index.get(doc_id, {})
        
    def count(self, collection_name: str) -> int:
        collection = self.reg_collection if collection_name == "regulatory_clauses" else self.prec_collection
        return collection.count()
