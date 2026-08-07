import os
import pytest
from datetime import datetime
from src.retrieval.parent_doc_store import ParentDocStore
from src.ingestion.context_enricher import enrich_chunk_text
from src.ingestion.regulatory_chunker import RegulatoryChunker, save_regulatory_chunks

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
TEST_RESULT_DIR = f"tests/results/phase_2_run_{timestamp}"
if not os.path.exists(TEST_RESULT_DIR):
    os.makedirs(TEST_RESULT_DIR)

DB_PATH = f"{TEST_RESULT_DIR}/test_parent_doc_store.db"

@pytest.fixture(scope="module")
def parent_store():
    store = ParentDocStore(db_path=DB_PATH)
    yield store
    # Teardown logic if needed

def test_parent_doc_store(parent_store):
    parent_store.store("child_1", "child text", "parent_1", "parent text full")
    
    # Test expansion
    expanded = parent_store.expand_to_parent("child_1")
    assert expanded == "parent text full"
    
    # Test retrieving child text
    child_txt = parent_store.get_child_text("child_1")
    assert child_txt == "child text"
    
    # Test non-existent child
    assert parent_store.expand_to_parent("fake_child") == ""

def test_context_enricher():
    metadata = {
        "chapter": "IX",
        "regulation": "229(2)(a)",
        "heading_path": ["Chapter IX", "Regulation 229"]
    }
    raw_text = "The issuer has operating profit."
    
    enriched = enrich_chunk_text(raw_text, metadata)
    
    assert "Chapter IX" in enriched
    assert "Regulation 229(2)(a)" in enriched
    assert "Path: Chapter IX > Regulation 229" in enriched
    assert raw_text in enriched

def test_regulatory_chunker():
    """
    The chunker groups a whole regulation into one hierarchy unit and then splits
    it by word count. It no longer emits one chunk per blank-line paragraph —
    that behaviour is what produced 575 page-sized chunks all labelled
    "Chapter I / Regulation 1" across the real corpus.
    """
    mock_text = """CHAPTER IX\nSME IPOs\n\n229.\nConditions for listing on SME Exchange\n\n(1) The issuer must be a company.\n\n(2) The issuer has operating profit."""

    chunker = RegulatoryChunker(db_path=DB_PATH)
    chunks = chunker.process_text(mock_text, source_doc="mock_icdr")

    assert chunks, "expected at least one chunk"

    clause_chunk = chunks[0]
    assert clause_chunk.chapter == "IX"
    assert clause_chunk.regulation_number == "229"
    assert clause_chunk.regulation_title == "Conditions for listing on SME Exchange"
    # Chapter IX is the SME chapter, so applicability is derived, not hardcoded.
    assert clause_chunk.applicability == "SME"
    # Nothing in the pipeline classifies disclosure category; it must stay empty
    # rather than defaulting every clause to "General".
    assert clause_chunk.disclosure_category == ""

    # Both sub-clauses belong to regulation 229 and stay in the same unit.
    assert "(1) The issuer must be a company." in clause_chunk.text
    assert "(2) The issuer has operating profit." in clause_chunk.text
    assert "Chapter IX" in clause_chunk.enriched_text
    assert "Regulation 229" in clause_chunk.enriched_text

    # Parent expansion must widen context, never narrow it.
    parent_text = chunker.parent_store.expand_to_parent(clause_chunk.clause_id)
    assert "(1) The issuer must be a company." in parent_text
    assert len(parent_text.split()) >= len(clause_chunk.text.split())


def test_regulatory_chunker_ignores_schedule_list_numbering():
    """
    Numbered items inside schedules restart at 1 repeatedly. Without the
    monotonic guard they would be mistaken for regulation boundaries.
    """
    mock_text = (
        "CHAPTER IX\nSME IPOs\n\n"
        "229. Conditions for listing\n\nThe issuer must be a company.\n\n"
        "SCHEDULE I\nForms\n\n"
        "1. First item in a schedule list.\n\n"
        "2. Second item in a schedule list.\n"
    )
    chunker = RegulatoryChunker(db_path=DB_PATH)
    chunks = chunker.process_text(mock_text, source_doc="mock_icdr_sched")

    regulations = {c.regulation_number for c in chunks if c.regulation_number}
    assert regulations == {"229"}, f"schedule list items leaked in: {regulations}"
    assert any(c.chapter == "SCHEDULE I" for c in chunks)

    # save_regulatory_chunks writes one file per source document.
    save_regulatory_chunks(chunks, f"{TEST_RESULT_DIR}/03_CHUNKED/regulatory")
    assert os.path.exists(
        f"{TEST_RESULT_DIR}/03_CHUNKED/regulatory/mock_icdr_sched_reg_chunks.jsonl"
    )
