import pytest
from src.retrieval.raptor import build_raptor_tree, RaptorTree
from src.retrieval.flashrank_reranker import FlashRankReranker, HAS_FLASHRANK
from src.retrieval.router import QueryRouter

dummy_chunks = [
    {"id": "c1", "text": "Risk Factors: Dependence on suppliers.", "metadata": {"chapter": "Risk Factors"}},
    {"id": "c2", "text": "Risk Factors: Litigation against directors.", "metadata": {"chapter": "Risk Factors"}},
    {"id": "c3", "text": "Financials: 3 years restated statements.", "metadata": {"chapter": "Financial Info"}},
]

def test_raptor_tree_building():
    tree = build_raptor_tree(dummy_chunks)
    assert isinstance(tree, RaptorTree)
    assert len(tree.leaf_nodes) == 3
    # Two categories: Risk Factors and Financial Info -> 2 level-2 nodes
    assert len(tree.level2_nodes) == 2
    # One thematic category (Core Regulations) -> 1 level-1 node
    assert len(tree.level1_nodes) == 1
    assert tree.root["metadata"]["chunk_level"] == "raptor_root"
    assert tree.level1_nodes[0]["metadata"]["chunk_level"] == "raptor_level_1"

def test_router():
    router = QueryRouter()
    
    strat, mode, corpus = router.route("What does the Risk Factors section require?")
    assert strat == "section_draft"
    
    strat, mode, corpus = router.route("Are we eligible with an EBITDA threshold?")
    assert strat == "eligibility_check"
    assert corpus == "regulatory"
    
    strat, mode, corpus = router.route("Show me a DRHP example for risk factors")
    assert strat == "precedent_lookup"
    assert corpus == "precedent"

@pytest.mark.skipif(not HAS_FLASHRANK, reason="FlashRank not installed")
def test_flashrank():
    reranker = FlashRankReranker()
    passages = [
        {"id": "1", "text": "Apple is a fruit.", "metadata": {}},
        {"id": "2", "text": "FlashRank is a lightweight reranker.", "metadata": {}}
    ]
    results = reranker.rerank("What is FlashRank?", passages)
    assert len(results) == 2
    # FlashRank should rank the second passage higher for this query
    assert results[0]["id"] == "2"
