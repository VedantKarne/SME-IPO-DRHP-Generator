import os
import time
import pytest
import shutil
from src.retrieval.bge_m3_embedder import BGEM3Embedder, HAS_BGE
from src.retrieval.vector_store import VectorStore
from src.retrieval.hybrid_search import HybridSearcher
from src.retrieval.schemas import ICDRChunkMetadata

TEST_DB_PATH = "tests/results/chroma_db_test"

@pytest.fixture(scope="module")
def vector_store():
    if os.path.exists(TEST_DB_PATH):
        shutil.rmtree(TEST_DB_PATH)
    store = VectorStore(persist_dir=TEST_DB_PATH)
    yield store
    if os.path.exists(TEST_DB_PATH):
        try:
            shutil.rmtree(TEST_DB_PATH)
        except Exception:
            pass # Windows file lock issue might happen, ignore

@pytest.fixture(scope="module")
def embedder():
    if not HAS_BGE:
        pytest.skip("FlagEmbedding is not installed. Run `pip install FlagEmbedding`")
    # use fp16=False for testing if on CPU without GPU, but True is usually fine if torch falls back or if we mock it.
    # For CI/CD, we'd mock the embedder. But we want to test real generation if BGE is installed.
    # We will initialize it. It might be slow.
    emb = BGEM3Embedder(use_fp16=False) 
    yield emb

def test_schemas():
    # Verify metadata is preserved/validated
    meta = ICDRChunkMetadata(
        parent_id="reg_229",
        regulation_no="229",
        chapter="IX",
        section_type="eligibility",
        chunk_level="clause"
    )
    assert meta.doc_type == "regulation"
    assert meta.source == "ICDR"

def test_bge_generation(embedder):
    texts = ["Regulation 229 profitability requirements", "General risk factors"]
    out = embedder.embed_chunks(texts)
    
    assert "dense" in out
    assert "sparse" in out
    
    # Dense vectors generated with dimension 1024
    assert len(out["dense"]) == 2
    assert len(out["dense"][0]) == 1024
    
    # Sparse lexical weights generated and non-empty
    assert len(out["sparse"]) == 2
    assert len(out["sparse"][0]) > 0

def test_ingestion_and_hybrid_search(embedder, vector_store):
    start_time = time.time()
    
    # Setup test corpus
    docs = [
        "The issuer must have an operating profit (EBITDA) of at least 1 crore for 2 out of 3 years.",
        "General definitions and applicability of the SME segment.",
        "[Context: Chapter IX > Regulation 229:] The issuer has operating profit for listing on SME exchange."
    ]
    ids = ["doc_1", "doc_2", "doc_3"]
    
    # Validating metadata schema preservation
    metadatas = [
        ICDRChunkMetadata(parent_id="p1", chunk_level="clause", regulation_no="229_x").model_dump(),
        ICDRChunkMetadata(parent_id="p2", chunk_level="chapter", chapter="IX").model_dump(),
        ICDRChunkMetadata(parent_id="p3", chunk_level="clause", regulation_no="229").model_dump()
    ]
    
    # Embed
    vectors = embedder.embed_chunks(docs)
    
    # Ingest
    vector_store.add_chunks(
        collection_name="regulatory_clauses",
        ids=ids,
        documents=docs,
        metadatas=metadatas,
        dense_vecs=vectors["dense"],
        sparse_vecs=vectors["sparse"]
    )
    
    # Collections created and count > 0
    assert vector_store.count("regulatory_clauses") == 3
    
    # Test Fallback exists (if sparse not natively supported, fallback index is used)
    if not vector_store.supports_sparse:
        assert len(vector_store.fallback_sparse_index) == 3
        
    searcher = HybridSearcher(embedder, vector_store)
    
    # Test Hybrid Search Check
    query = "Regulation 229 profitability SME listing"
    results = searcher.search(
        collection_name="regulatory_clauses",
        query_text=query,
        top_k=2
    )
    
    # Query latency < 3 seconds
    latency = time.time() - start_time
    assert latency < 3.0, f"Query took {latency}s, which is > 3s"
    
    # Expected: The result containing both semantic match and exact regulation number should rank #1
    assert len(results) > 0
    top_result = results[0]
    
    # doc_3 contains the exact string 'Regulation 229' and 'profitability' and 'SME'
    assert top_result["id"] == "doc_3"
    
    # Metadata preserved
    assert top_result["metadata"]["doc_type"] == "regulation"
    assert top_result["metadata"]["regulation_no"] == "229"
