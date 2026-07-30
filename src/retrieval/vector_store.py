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

# Known collection names as constants for convenient reference by other modules
COLLECTION_REGULATORY = "regulatory_clauses"
COLLECTION_PRECEDENT = "precedent_chunks"
COLLECTION_CLIENT = "client_documents"

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
        
        # In-memory cache of collection objects to avoid repeated get_or_create calls
        self._collection_cache: Dict[str, Any] = {}
        
        # Pre-initialize the known core collections
        self._get_or_create_collection(COLLECTION_REGULATORY)
        self._get_or_create_collection(COLLECTION_PRECEDENT)
        self._get_or_create_collection(COLLECTION_CLIENT)

    def _get_or_create_collection(self, name: str):
        """Returns a ChromaDB collection by name, creating it if it doesn't exist.
        Results are cached to avoid repeated round-trips.
        """
        if name not in self._collection_cache:
            self._collection_cache[name] = self.client.get_or_create_collection(name=name)
        return self._collection_cache[name]

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
        Ingests vectors into ChromaDB. Supports any collection name dynamically.
        """
        if not ids:
            return
            
        collection = self._get_or_create_collection(collection_name)
        
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
        """Query a collection by dense vector. Supports any collection name and optional metadata filter."""
        collection = self._get_or_create_collection(collection_name)
        
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
        """Return the number of documents in a named collection."""
        collection = self._get_or_create_collection(collection_name)
        return collection.count()

    def delete_by_metadata(self, collection_name: str, where: Dict):
        """Delete chunks matching metadata filter from Chroma and sparse store."""
        collection = self._get_or_create_collection(collection_name)
        # Get IDs first to delete from sparse fallback
        try:
            results = collection.get(where=where, include=[])
            if results and results["ids"]:
                for chunk_id in results["ids"]:
                    if chunk_id in self.fallback_sparse_index:
                        del self.fallback_sparse_index[chunk_id]
                self._save_fallback_sparse()
                
                # Delete from Chroma
                collection.delete(where=where)
                return len(results["ids"])
            return 0
        except Exception as e:
            print(f"Error during vector deletion: {e}")
            return 0
