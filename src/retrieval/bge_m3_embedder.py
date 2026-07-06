import logging
from typing import List, Dict

try:
    from FlagEmbedding import BGEM3FlagModel
    HAS_BGE = True
except ImportError:
    HAS_BGE = False

logger = logging.getLogger(__name__)

class BGEM3Embedder:
    def __init__(self, use_fp16: bool = True):
        if not HAS_BGE:
            logger.warning("FlagEmbedding not installed. BGEM3Embedder will fail if called.")
            self.model = None
            return
            
        logger.info("Loading BGE-M3 model...")
        self.model = BGEM3FlagModel(
            'BAAI/bge-m3',
            use_fp16=use_fp16
        )
        logger.info("BGE-M3 model loaded.")

    def embed_chunks(self, texts: List[str], batch_size: int = 12) -> Dict:
        """
        Generates dense embeddings and sparse lexical weights.
        Explicitly disables ColBERT multi-vectors by default to save memory.
        """
        if not self.model:
            raise RuntimeError("FlagEmbedding is not installed.")
            
        if not texts:
            return {"dense": [], "sparse": []}

        output = self.model.encode(
            texts,
            batch_size=batch_size,
            max_length=8192,
            return_dense=True,
            return_sparse=True,
            return_colbert_vecs=False  # Disabled as per Phase 3 plan
        )
        
        # Convert dense vectors to basic lists for easy JSON/DB ingestion
        dense_vecs = [list(map(float, vec)) for vec in output["dense_vecs"]]
        
        # Sparse vectors are returned as list of dicts: {token: weight}
        # In BGE-M3, tokens are represented as string indices or words depending on tokenizer config.
        # Ensure we return native Python types.
        sparse_vecs = []
        for sp in output["lexical_weights"]:
            # Convert token string keys and float weights
            sparse_dict = {str(k): float(v) for k, v in sp.items()}
            sparse_vecs.append(sparse_dict)

        return {
            "dense": dense_vecs,
            "sparse": sparse_vecs
        }
