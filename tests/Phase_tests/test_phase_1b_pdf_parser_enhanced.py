"""
tests/Phase_tests/test_phase_1b_pdf_parser_enhanced.py

Stress-tests for the enhanced pdf_parser.py.
Covers: hybrid page-level routing, PyMuPDF table extraction, Docling page chunking,
heading_path population, docling_document field, and make_temp_pdf_specific_pages utility.

Run with: pytest tests/Phase_tests/test_phase_1b_pdf_parser_enhanced.py -v
"""
import os
import json
import pytest
import tempfile
from unittest.mock import patch, MagicMock
from datetime import datetime

import fitz  # PyMuPDF

from src.ingestion.pdf_parser import (
    parse_pdf,
    pymupdf_extract,
    docling_extract_full,
    make_temp_pdf_specific_pages,
    ParsedDocument,
    TableData,
    save_parsed_documents,
)

# ─── Fixtures ────────────────────────────────────────────────────────────────

timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
OUTPUT_DIR = f"tests/results/phase_1b_enhanced_{timestamp}"


@pytest.fixture(scope="module", autouse=True)
def setup_output_dir():
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def _make_digital_pdf(path: str, num_pages: int = 3, text_per_page: str = None) -> str:
    """Helper: create a real multi-page digital PDF using PyMuPDF."""
    doc = fitz.open()
    for i in range(num_pages):
        page = doc.new_page()
        content = text_per_page or (
            f"Page {i + 1} content.\n\n"
            f"This is a digital text page with enough content to satisfy the 50-char threshold. "
            f"It also contains a regulatory clause reference such as Regulation {i + 1}(a). "
            f"Profit and Loss: Revenue 1000 Lakhs, EBITDA 200 Lakhs, PAT 80 Lakhs."
        )
        page.insert_text((72, 72), content, fontsize=11)
    doc.save(path)
    doc.close()
    return path


def _make_blank_pdf(path: str, num_pages: int = 2) -> str:
    """Helper: create a blank/scanned-like PDF (no extractable text)."""
    doc = fitz.open()
    for _ in range(num_pages):
        doc.new_page()
    doc.save(path)
    doc.close()
    return path


# ─── Section 1: Hybrid Routing ────────────────────────────────────────────────

class TestHybridRouting:
    """Verifies that parse_pdf routes pages individually, not on a sampled average."""

    def test_all_digital_routes_to_pymupdf_only(self, tmp_path):
        """All digital pages should produce only 'pymupdf' extraction_method."""
        pdf_path = str(tmp_path / "digital.pdf")
        _make_digital_pdf(pdf_path, num_pages=3)
        result = parse_pdf(pdf_path, source="test")

        assert len(result) > 0, "Expected at least one parsed document"
        assert all(d.extraction_method == "pymupdf" for d in result), (
            "All digital pages should use PyMuPDF"
        )

    def test_all_blank_routes_to_docling_only(self, tmp_path):
        """All blank pages should call docling_extract_full and not pymupdf_extract."""
        pdf_path = str(tmp_path / "blank.pdf")
        _make_blank_pdf(pdf_path, num_pages=2)

        mock_docling_result = [
            ParsedDocument(
                doc_id="blank", source="test", page=p,
                text=f"Docling text page {p}", extraction_method="docling",
            )
            for p in [1, 2]
        ]
        with patch("src.ingestion.pdf_parser.docling_extract_full", return_value=mock_docling_result) as mock_docling, \
             patch("src.ingestion.pdf_parser.pymupdf_extract") as mock_pymupdf:
            parse_pdf(pdf_path, source="test")
            mock_docling.assert_called_once()
            mock_pymupdf.assert_not_called()

    def test_mixed_pdf_routes_per_page(self, tmp_path):
        """Mixed PDF: digital pages get PyMuPDF, blank pages get Docling."""
        pdf_path = str(tmp_path / "mixed.pdf")
        doc = fitz.open()
        p0 = doc.new_page()
        p0.insert_text(
            (72, 72),
            "This page has lots of extractable text content that easily exceeds fifty characters.",
            fontsize=11
        )
        doc.new_page()  # blank
        doc.save(pdf_path)
        doc.close()

        mock_docling_result = [
            ParsedDocument(doc_id="mixed", source="test", page=2, text="OCR text", extraction_method="docling")
        ]
        with patch("src.ingestion.pdf_parser.docling_extract_full", return_value=mock_docling_result):
            result = parse_pdf(pdf_path, source="test")
            methods = {d.extraction_method for d in result}
            assert "pymupdf" in methods, "Expected at least one pymupdf page"
            assert "docling" in methods, "Expected at least one docling page"

    def test_result_is_sorted_by_page_number(self, tmp_path):
        """Output pages must always be sorted ascending by page number."""
        pdf_path = str(tmp_path / "sorted.pdf")
        _make_digital_pdf(pdf_path, num_pages=5)
        result = parse_pdf(pdf_path, source="test")
        pages = [d.page for d in result]
        assert pages == sorted(pages), f"Pages are not sorted: {pages}"

    def test_max_pages_respected(self, tmp_path):
        """max_pages parameter must limit the number of pages processed."""
        pdf_path = str(tmp_path / "long.pdf")
        _make_digital_pdf(pdf_path, num_pages=10)
        result = parse_pdf(pdf_path, source="test", max_pages=3)
        assert len(result) <= 3, f"Expected at most 3 pages, got {len(result)}"

    def test_nonexistent_file_returns_empty_list(self, tmp_path):
        """A nonexistent PDF path should return an empty list without crashing."""
        pdf_path = str(tmp_path / "does_not_exist.pdf")
        result = parse_pdf(pdf_path, source="test")
        assert result == [], f"Expected empty list for missing file, got {result}"


# ─── Section 2: PyMuPDF Table Extraction ──────────────────────────────────────

class TestPyMuPDFTableExtraction:

    def test_table_data_model_structure(self):
        """TableData must have caption and data fields."""
        tbl = TableData(caption="Test Table", data=[["A", "B"], ["1", "2"]])
        assert tbl.data[0] == ["A", "B"]

    def test_pymupdf_extract_returns_per_page_docs(self, tmp_path):
        """pymupdf_extract must return one ParsedDocument per page."""
        pdf_path = str(tmp_path / "pages.pdf")
        _make_digital_pdf(pdf_path, num_pages=4)
        result = pymupdf_extract(pdf_path, "test_doc", "test")
        assert len(result) == 4, f"Expected 4 docs, got {len(result)}"
        assert [d.page for d in result] == [1, 2, 3, 4]

    def test_pymupdf_extract_page_numbers_filter(self, tmp_path):
        """pymupdf_extract with page_numbers should only process specified pages."""
        pdf_path = str(tmp_path / "filtered.pdf")
        _make_digital_pdf(pdf_path, num_pages=5)
        result = pymupdf_extract(pdf_path, "test_doc", "test", page_numbers=[0, 2, 4])
        assert len(result) == 3
        assert result[0].page == 1
        assert result[1].page == 3
        assert result[2].page == 5

    def test_table_cells_are_strings_not_none(self, tmp_path):
        """All table cells must be non-None strings even if PyMuPDF returns None cells."""
        pdf_path = str(tmp_path / "table_none.pdf")
        _make_digital_pdf(pdf_path, num_pages=1)

        mock_tab = MagicMock()
        mock_tab.extract.return_value = [[None, "Header B"], ["Val A", None]]
        mock_tabs = MagicMock()
        mock_tabs.tables = [mock_tab]

        with patch("fitz.Page.find_tables", return_value=mock_tabs):
            result = pymupdf_extract(pdf_path, "doc", "test")
            for doc in result:
                for tbl in doc.tables:
                    for row in tbl.data:
                        for cell in row:
                            assert isinstance(cell, str), f"Cell is not string: {cell!r}"

    def test_table_extraction_failure_does_not_crash(self, tmp_path):
        """If find_tables() raises an exception, extraction must continue gracefully."""
        pdf_path = str(tmp_path / "crash_test.pdf")
        _make_digital_pdf(pdf_path, num_pages=2)

        with patch("fitz.Page.find_tables", side_effect=Exception("mock table crash")):
            result = pymupdf_extract(pdf_path, "doc", "test")
            assert len(result) > 0
            for doc in result:
                assert doc.tables == []


# ─── Section 3: Docling Page-Level Chunking ──────────────────────────────────

class TestDoclingPageChunking:

    def _make_mock_docling_result(self, pages: dict):
        mock_result = MagicMock()
        mock_doc = MagicMock()
        text_items = []
        for page_no, data in pages.items():
            for label, text in data.get("texts", []):
                item = MagicMock()
                item.text = text
                item.label = label
                prov = MagicMock()
                prov.page_no = page_no
                item.prov = [prov]
                text_items.append(item)
        mock_doc.texts = text_items
        mock_doc.tables = []
        mock_doc.export_to_dict.return_value = {"mock": "dict"}
        mock_result.document = mock_doc
        return mock_result

    def test_produces_one_doc_per_unique_page(self, tmp_path):
        """Each unique page number in Docling elements becomes its own ParsedDocument."""
        pdf_path = str(tmp_path / "docling_pages.pdf")
        _make_blank_pdf(pdf_path, num_pages=3)
        mock_result = self._make_mock_docling_result({
            1: {"texts": [("text", "Page 1 content")]},
            2: {"texts": [("text", "Page 2 content")]},
            3: {"texts": [("text", "Page 3 content")]},
        })
        with patch("src.ingestion.pdf_parser.DocumentConverter") as MockConverter:
            MockConverter.return_value.convert.return_value = mock_result
            result = docling_extract_full(pdf_path, "test", "test")
        assert len(result) == 3, f"Expected 3 page docs, got {len(result)}"
        assert sorted(d.page for d in result) == [1, 2, 3]

    def test_heading_path_populated_for_section_headers(self, tmp_path):
        """Elements labelled 'section_header' must populate heading_path."""
        pdf_path = str(tmp_path / "headings.pdf")
        _make_blank_pdf(pdf_path, num_pages=1)
        mock_result = self._make_mock_docling_result({
            1: {"texts": [
                ("section_header", "Chapter I: Business Overview"),
                ("text", "The company was incorporated in 2010."),
            ]},
        })
        with patch("src.ingestion.pdf_parser.DocumentConverter") as MockConverter:
            MockConverter.return_value.convert.return_value = mock_result
            result = docling_extract_full(pdf_path, "test", "test")
        assert len(result) == 1
        assert "Chapter I: Business Overview" in result[0].heading_path

    def test_heading_path_empty_for_plain_text(self, tmp_path):
        """Plain text elements must NOT populate heading_path."""
        pdf_path = str(tmp_path / "no_headings.pdf")
        _make_blank_pdf(pdf_path, num_pages=1)
        mock_result = self._make_mock_docling_result({
            1: {"texts": [("text", "Just plain text content here.")]},
        })
        with patch("src.ingestion.pdf_parser.DocumentConverter") as MockConverter:
            MockConverter.return_value.convert.return_value = mock_result
            result = docling_extract_full(pdf_path, "test", "test")
        assert result[0].heading_path == []

    def test_docling_document_dict_on_first_page_only(self, tmp_path):
        """docling_document must be populated on the first page only."""
        pdf_path = str(tmp_path / "docdict.pdf")
        _make_blank_pdf(pdf_path, num_pages=3)
        mock_result = self._make_mock_docling_result({
            1: {"texts": [("text", "Page 1")]},
            2: {"texts": [("text", "Page 2")]},
            3: {"texts": [("text", "Page 3")]},
        })
        with patch("src.ingestion.pdf_parser.DocumentConverter") as MockConverter:
            MockConverter.return_value.convert.return_value = mock_result
            result = docling_extract_full(pdf_path, "test", "test")
        sorted_result = sorted(result, key=lambda d: d.page)
        assert sorted_result[0].docling_document is not None
        for doc in sorted_result[1:]:
            assert doc.docling_document is None, f"Page {doc.page} should have None docling_document"

    def test_page_numbers_remapped_to_original(self, tmp_path):
        """page_numbers=[2,4] (0-indexed) → Docling internal page 1 maps to original page 3."""
        pdf_path = str(tmp_path / "remap.pdf")
        _make_blank_pdf(pdf_path, num_pages=5)
        mock_result = self._make_mock_docling_result({
            1: {"texts": [("text", "slice page 1 = original page 3")]},
            2: {"texts": [("text", "slice page 2 = original page 5")]},
        })
        mock_result.document.export_to_dict.return_value = {}
        with patch("src.ingestion.pdf_parser.make_temp_pdf_specific_pages", return_value=pdf_path), \
             patch("src.ingestion.pdf_parser.DocumentConverter") as MockConverter:
            MockConverter.return_value.convert.return_value = mock_result
            result = docling_extract_full(pdf_path, "test", "test", page_numbers=[2, 4])
        pages = sorted(d.page for d in result)
        assert pages == [3, 5], f"Expected original pages [3,5], got {pages}"

    def test_docling_export_to_dict_failure_does_not_crash(self, tmp_path):
        """If export_to_dict() raises, extraction should continue with docling_document=None."""
        pdf_path = str(tmp_path / "no_dict.pdf")
        _make_blank_pdf(pdf_path, num_pages=1)
        mock_result = self._make_mock_docling_result({
            1: {"texts": [("text", "Some text")]},
        })
        mock_result.document.export_to_dict.side_effect = Exception("serialization error")
        with patch("src.ingestion.pdf_parser.DocumentConverter") as MockConverter:
            MockConverter.return_value.convert.return_value = mock_result
            result = docling_extract_full(pdf_path, "test", "test")
        assert len(result) == 1
        assert result[0].docling_document is None


# ─── Section 4: make_temp_pdf_specific_pages ──────────────────────────────────

class TestMakeTempPDFSpecificPages:

    def test_creates_pdf_with_correct_page_count(self, tmp_path):
        src = str(tmp_path / "source.pdf")
        _make_digital_pdf(src, num_pages=10)
        out_path = make_temp_pdf_specific_pages(src, [0, 3, 7])
        assert os.path.exists(out_path)
        out_doc = fitz.open(out_path)
        assert len(out_doc) == 3
        out_doc.close()

    def test_reuses_existing_sliced_file(self, tmp_path):
        src = str(tmp_path / "source2.pdf")
        _make_digital_pdf(src, num_pages=5)
        path1 = make_temp_pdf_specific_pages(src, [0, 1])
        mtime1 = os.path.getmtime(path1)
        path2 = make_temp_pdf_specific_pages(src, [0, 1])
        mtime2 = os.path.getmtime(path2)
        assert path1 == path2
        assert mtime1 == mtime2, "Sliced file was unnecessarily re-created"

    def test_skips_invalid_page_numbers(self, tmp_path):
        src = str(tmp_path / "small.pdf")
        _make_digital_pdf(src, num_pages=3)
        out_path = make_temp_pdf_specific_pages(src, [0, 99, 100])
        out_doc = fitz.open(out_path)
        assert len(out_doc) == 1  # Only page 0 valid
        out_doc.close()


# ─── Section 5: Schema & Serialization ────────────────────────────────────────

class TestSchemaAndSerialization:

    def test_all_new_fields_serialize_correctly(self):
        """ParsedDocument with all new fields should roundtrip through JSON cleanly."""
        doc = ParsedDocument(
            doc_id="test", source="regulatory", page=1,
            text="Some regulatory text.", extraction_method="docling",
            heading_path=["Chapter I", "Regulation 5"],
            docling_document={"schema": "v2", "pages": 10},
            tables=[TableData(caption="P&L", data=[["Revenue", "1000"]])],
        )
        parsed = json.loads(doc.model_dump_json())
        assert parsed["heading_path"] == ["Chapter I", "Regulation 5"]
        assert parsed["docling_document"]["schema"] == "v2"
        assert parsed["tables"][0]["caption"] == "P&L"

    def test_save_and_reload_parsed_documents(self, tmp_path):
        """Documents saved to JSONL must reload with identical fields."""
        docs = [
            ParsedDocument(
                doc_id="save_test", source="precedent", page=i,
                text=f"Page {i} text", extraction_method="pymupdf",
                heading_path=[f"Heading {i}"],
            )
            for i in range(1, 4)
        ]
        save_parsed_documents(docs, str(tmp_path))
        jsonl_path = str(tmp_path / "save_test.jsonl")
        assert os.path.exists(jsonl_path)

        loaded = []
        with open(jsonl_path, "r") as f:
            for line in f:
                loaded.append(ParsedDocument.model_validate_json(line))

        assert len(loaded) == 3
        for orig, reloaded in zip(docs, loaded):
            assert orig.page == reloaded.page
            assert orig.heading_path == reloaded.heading_path

    def test_default_values_for_optional_fields(self):
        """Default values: tables=[], heading_path=[], docling_document=None."""
        doc = ParsedDocument(doc_id="d", source="s", page=1, text="t", extraction_method="pymupdf")
        assert doc.tables == []
        assert doc.heading_path == []
        assert doc.docling_document is None

    def test_multiple_docs_same_doc_id_append_to_same_jsonl(self, tmp_path):
        """All pages from the same doc_id should be written to a single JSONL file."""
        docs = [
            ParsedDocument(
                doc_id="multi", source="test", page=i,
                text=f"page {i}", extraction_method="pymupdf"
            )
            for i in range(1, 6)
        ]
        save_parsed_documents(docs, str(tmp_path))
        jsonl_path = str(tmp_path / "multi.jsonl")
        with open(jsonl_path) as f:
            lines = [l for l in f if l.strip()]
        assert len(lines) == 5, f"Expected 5 lines in JSONL, got {len(lines)}"
