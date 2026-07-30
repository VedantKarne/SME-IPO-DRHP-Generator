"""
tests/Phase_tests/test_phase_11_upload_pipeline.py

Tests the complete upload pipeline:
  Document Upload → Classification → Parsing (+ OCR fallback)
  → Table Extraction → KPI Extraction → DB Storage → AuditLog

Structure:
  Part A: Unit — DocClassifier (keyword + Gemini mock)
  Part B: Unit — OCR fallback in pdf_parser
  Part C: Unit — TableExtractor Pydantic schemas + Gemini mock
  Part D: Integration — background processing job (full pipeline, mocked AI)
  Part E: Integration — AuditLog written on upload
  Part F: Integration — FinancialTable rows persisted after financial upload
  Part G: Integration — auto-classification via doc_type=auto
  Part H: API  — POST /api/documents/upload/{company_id}
  Part I: API  — GET /api/documents/status/{company_id}
  Part J: API  — GET /api/admin/collections + POST /api/admin/search
"""
import io
import os
import sys
import uuid
import json
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


# ─── Shared fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def test_db():
    """In-memory SQLite DB isolated from the real app_state.db."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy.pool import StaticPool
    from src.extraction.schema import Base, Company, CompanyUser
    import bcrypt

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    company = Company(
        cin=f"U{uuid.uuid4().hex[:10].upper()}MH2024PLC",
        name="Pipeline Test Corp",
    )
    db.add(company)
    db.commit()
    db.refresh(company)

    hashed = bcrypt.hashpw(b"testpass123", bcrypt.gensalt()).decode("utf-8")
    user = CompanyUser(
        company_id=company.id,
        email=f"test_{uuid.uuid4().hex[:6]}@corp.com",
        hashed_password=hashed,
        role="promoter",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    yield db, company, user
    db.close()


@pytest.fixture(scope="module")
def auth_token(test_db):
    """Valid JWT for the test user."""
    from src.api.auth_router import create_access_token
    from datetime import timedelta

    _, company, user = test_db
    return create_access_token(
        data={
            "sub": str(user.id),
            "company_id": str(company.id),
            "company_name": company.name,
            "role": user.role,
        },
        expires_delta=timedelta(days=1),
    )


@pytest.fixture(scope="module")
def api_client(test_db):
    """TestClient with DB override covering all router get_db functions."""
    from fastapi.testclient import TestClient
    from src.api.server import app
    from src.extraction.db_session import get_db as db_session_get_db
    import src.api.document_upload_router as upload_mod
    import src.api.auth_router as auth_mod
    import src.api.session_router as session_mod

    db, _, _ = test_db

    def override_get_db():
        yield db

    # Override every get_db variant used by each router
    app.dependency_overrides[db_session_get_db] = override_get_db
    app.dependency_overrides[upload_mod.get_db] = override_get_db
    app.dependency_overrides[auth_mod.get_db] = override_get_db
    app.dependency_overrides[session_mod.get_db] = override_get_db
    
    from unittest.mock import patch, MagicMock
    fake_db = MagicMock(wraps=db)
    fake_db.close = MagicMock()
    with patch("src.api.document_upload_router.SessionLocal", return_value=fake_db):
        yield TestClient(app)
        
    app.dependency_overrides.clear()


@pytest.fixture
def minimal_pdf(tmp_path):
    """Real one-page PDF with selectable text."""
    try:
        import fitz

        doc = fitz.open()
        page = doc.new_page()
        page.insert_text(
            (72, 72),
            "AUDITED FINANCIAL STATEMENTS FY2024\n"
            "Revenue: 5200 Lakhs | EBITDA: 940 Lakhs | PAT: 620 Lakhs\n"
            "Net Worth: 3100 Lakhs | Paid-up Capital: 500 Lakhs\n"
            "Balance Sheet as at March 31, 2024",
            fontsize=11,
        )
        path = tmp_path / "test_financial.pdf"
        doc.save(str(path))
        doc.close()
        return str(path)
    except ImportError:
        pytest.skip("PyMuPDF not installed")


@pytest.fixture
def minimal_scanned_pdf(tmp_path):
    """PDF with a raster image page (no selectable text) simulating a scanned document."""
    try:
        import fitz
        from PIL import Image, ImageDraw
        import io as io_mod

        img = Image.new("RGB", (800, 600), "white")
        draw = ImageDraw.Draw(img)
        draw.text((50, 50), "Board Resolution\nResolved that the company proceeds with IPO.", fill="black")
        buf = io_mod.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        pdf = fitz.open()
        page = pdf.new_page(width=800, height=600)
        page.insert_image(page.rect, stream=buf.read())
        path = tmp_path / "test_scanned.pdf"
        pdf.save(str(path))
        pdf.close()
        return str(path)
    except ImportError:
        pytest.skip("PyMuPDF or Pillow not installed")


# ═══════════════════════════════════════════════════════════════════════════════
# Part A: DocClassifier Unit Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestDocClassifier:

    def test_keyword_financial_statement(self):
        from src.extraction.doc_classifier import DocClassifier
        c = DocClassifier()
        result = c.classify_from_text(
            "Balance Sheet as at March 31 2024. Revenue EBITDA PAT Net Worth audit report."
        )
        assert result == "financial_statement", f"Got '{result}'"

    def test_keyword_board_resolution(self):
        from src.extraction.doc_classifier import DocClassifier
        c = DocClassifier()
        result = c.classify_from_text(
            "Board Resolution. Resolved that the company shall proceed with the IPO."
        )
        assert result == "board_resolution"

    def test_keyword_moa_aoa(self):
        from src.extraction.doc_classifier import DocClassifier
        c = DocClassifier()
        result = c.classify_from_text(
            "Memorandum of Association. Objects Clause. Share Capital. Registered Office."
        )
        assert result == "moa_aoa"

    def test_keyword_legal_notice(self):
        from src.extraction.doc_classifier import DocClassifier
        c = DocClassifier()
        result = c.classify_from_text(
            "Legal Notice. Writ Petition filed in High Court. Litigation pending."
        )
        assert result == "legal_notice"

    def test_keyword_insurance_policy(self):
        from src.extraction.doc_classifier import DocClassifier
        c = DocClassifier()
        result = c.classify_from_text(
            "Insurance Policy. Policy Number. Sum Insured 5 Crores. Fire Insurance Premium."
        )
        assert result == "insurance_policy"

    def test_keyword_factory_license(self):
        from src.extraction.doc_classifier import DocClassifier
        c = DocClassifier()
        result = c.classify_from_text(
            "Factory License. Registration Certificate. Industrial Licence granted."
        )
        assert result == "factory_license"

    def test_ambiguous_returns_other_without_api_key(self):
        from src.extraction.doc_classifier import DocClassifier
        with patch.dict(os.environ, {"GROQ_API_KEY": "", "GEMINI_API_KEY": ""}):
            c = DocClassifier()
            result = c.classify_from_text("Random document with no clear category information.")
        assert result == "other"

    def test_all_returned_categories_are_valid(self):
        from src.extraction.doc_classifier import DocClassifier, DOC_CATEGORIES
        c = DocClassifier()
        test_texts = [
            "balance sheet profit and loss audit net worth",
            "board resolution resolved that agm",
            "factory license registration certificate industrial",
            "memorandum articles of association moa aoa share capital",
            "legal notice writ petition court litigation",
            "insurance policy sum insured premium fire",
            "completely unrelated text about cooking and recipes",
        ]
        for text in test_texts:
            result = c.classify_from_text(text)
            assert result in DOC_CATEGORIES, (
                f"'{result}' not in DOC_CATEGORIES for text: '{text[:50]}'"
            )

    @patch("google.generativeai.GenerativeModel")
    @patch("google.generativeai.upload_file")
    @patch("google.generativeai.delete_file")
    @patch("google.generativeai.configure")
    def test_gemini_classify_from_path(self, mock_configure, mock_delete, mock_upload, mock_gm, tmp_path):
        from src.extraction.doc_classifier import DocClassifier
        mock_file = MagicMock()
        mock_file.name = "test_gemini_file"
        mock_upload.return_value = mock_file
        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "financial_statement"
        mock_model.generate_content.return_value = mock_response
        mock_gm.return_value = mock_model

        dummy_pdf = tmp_path / "dummy.pdf"
        dummy_pdf.write_bytes(b"%PDF-1.4 dummy content")

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key_for_test"}):
            c = DocClassifier()
            result = c.classify_from_path(str(dummy_pdf))

        assert result == "financial_statement"
        mock_delete.assert_called_once_with("test_gemini_file")

    @patch("google.generativeai.GenerativeModel")
    @patch("google.generativeai.upload_file")
    @patch("google.generativeai.delete_file")
    @patch("google.generativeai.configure")
    def test_gemini_invalid_response_falls_back_to_other(self, mock_configure, mock_delete, mock_upload, mock_gm, tmp_path):
        from src.extraction.doc_classifier import DocClassifier
        mock_file = MagicMock(); mock_file.name = "f"
        mock_upload.return_value = mock_file
        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "NOT_A_VALID_CATEGORY"
        mock_model.generate_content.return_value = mock_response
        mock_gm.return_value = mock_model

        dummy_pdf = tmp_path / "dummy2.pdf"
        dummy_pdf.write_bytes(b"%PDF-1.4 dummy")

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
            c = DocClassifier()
            result = c.classify_from_path(str(dummy_pdf))

        assert result == "other"


# ═══════════════════════════════════════════════════════════════════════════════
# Part B: OCR Fallback Unit Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestOCRFallback:

    @patch("pdf2image.convert_from_path")
    @patch("pytesseract.image_to_string")
    def test_ocr_extract_returns_parsed_documents(self, mock_image_to_string, mock_convert_from_path, minimal_scanned_pdf):
        pytest.importorskip("pytesseract", reason="pytesseract not installed")
        pytest.importorskip("pdf2image", reason="pdf2image not installed")

        from src.ingestion.pdf_parser import ocr_extract, ParsedDocument
        from unittest.mock import MagicMock
        mock_convert_from_path.return_value = [MagicMock(), MagicMock()] # 2 pages
        mock_image_to_string.return_value = "Mocked OCR text"

        results = ocr_extract(minimal_scanned_pdf, doc_id="test_ocr", source="client")
        assert isinstance(results, list)
        assert len(results) > 0
        for doc in results:
            assert isinstance(doc, ParsedDocument)
            assert doc.extraction_method == "tesseract_ocr"
            assert isinstance(doc.page, int) and doc.page >= 1
            assert isinstance(doc.text, str)

    def test_ocr_fallback_triggered_when_docling_sparse(self, minimal_scanned_pdf):
        from src.ingestion.pdf_parser import parse_pdf, ParsedDocument

        sparse_doc = ParsedDocument(
            doc_id="sparse", source="client", page=1, text="x" * 10,
            extraction_method="docling", heading_path=[], tables=[],
        )
        with patch("src.ingestion.pdf_parser.docling_extract_full", return_value=[sparse_doc]), \
             patch("src.ingestion.pdf_parser.ocr_extract") as mock_ocr:
            mock_ocr.return_value = [ParsedDocument(
                doc_id="ocr", source="client", page=1,
                text="Board Resolution text recovered via OCR.",
                extraction_method="tesseract_ocr", heading_path=[], tables=[],
            )]
            results = parse_pdf(minimal_scanned_pdf, source="client")

        mock_ocr.assert_called_once()
        assert any(d.extraction_method == "tesseract_ocr" for d in results)

    def test_ocr_NOT_triggered_when_docling_rich(self, minimal_pdf):
        from src.ingestion.pdf_parser import parse_pdf, ParsedDocument

        rich_doc = ParsedDocument(
            doc_id="rich", source="client", page=1, text="x" * 600,
            extraction_method="docling", heading_path=[], tables=[],
        )
        with patch("src.ingestion.pdf_parser.docling_extract_full", return_value=[rich_doc]), \
             patch("src.ingestion.pdf_parser.ocr_extract") as mock_ocr:
            parse_pdf(minimal_pdf, source="client")

        mock_ocr.assert_not_called()

    def test_ocr_returns_empty_list_when_import_fails(self, minimal_pdf):
        """ocr_extract should return [] and log error if pytesseract is not available."""
        from src.ingestion.pdf_parser import ocr_extract

        with patch("builtins.__import__", side_effect=ImportError("No module named 'pdf2image'")):
            # Only affect pdf2image import, use real builtins otherwise
            pass

        # Test via mocking the convert_from_path import path
        with patch.dict("sys.modules", {"pdf2image": None}):
            results = ocr_extract(minimal_pdf, doc_id="test", source="client")
        assert results == []

    @patch("pdf2image.convert_from_path")
    @patch("pytesseract.image_to_string")
    def test_ocr_extract_specific_page_numbers(self, mock_image_to_string, mock_convert_from_path, minimal_scanned_pdf):
        """page_numbers parameter should limit OCR to specified pages."""
        pytest.importorskip("pytesseract", reason="pytesseract not installed")
        pytest.importorskip("pdf2image", reason="pdf2image not installed")

        from src.ingestion.pdf_parser import ocr_extract
        from unittest.mock import MagicMock
        mock_convert_from_path.return_value = [MagicMock()] # 1 page returned by pdf2image when page_numbers is limited
        mock_image_to_string.return_value = "Mocked OCR text"

        results = ocr_extract(
            minimal_scanned_pdf, doc_id="page_test", source="client", page_numbers=[0]
        )
        assert len(results) == 1
        assert results[0].page == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Part C: TableExtractor Pydantic Schema Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestTableExtractorSchemas:

    def test_table_row_schema(self):
        from src.extraction.table_extractor import TableRow
        row = TableRow(columns=["Jane Doe", "00123456", "Managing Director"])
        assert row.columns == ["Jane Doe", "00123456", "Managing Director"]

    def test_extracted_table_schema(self):
        from src.extraction.table_extractor import ExtractedTable, TableRow
        table = ExtractedTable(
            table_title="Director Shareholding",
            headers=["Name", "DIN", "Designation", "Shares"],
            rows=[TableRow(columns=["Jane Doe", "00123456", "MD", "50000"])],
            page_num=3,
        )
        assert table.table_title == "Director Shareholding"
        assert len(table.rows) == 1
        assert table.page_num == 3

    def test_table_extraction_result_schema(self):
        from src.extraction.table_extractor import TableExtractionResult, ExtractedTable, TableRow
        result = TableExtractionResult(tables=[
            ExtractedTable(
                table_title="Director Details",
                headers=["Name", "DIN"],
                rows=[TableRow(columns=["John Smith", "01234567"])],
                page_num=5,
            )
        ])
        assert len(result.tables) == 1
        assert result.tables[0].page_num == 5

    @patch("google.generativeai.GenerativeModel")
    @patch("google.generativeai.upload_file")
    @patch("google.generativeai.delete_file")
    @patch("google.generativeai.configure")
    def test_extract_tables_from_pdf_calls_gemini_and_deletes_file(self, mock_configure, mock_delete, mock_upload, mock_gm, tmp_path):
        from src.extraction.table_extractor import extract_tables_from_pdf, TableExtractionResult

        mock_file = MagicMock()
        mock_file.name = "gemini_table_file"
        mock_upload.return_value = mock_file
        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = json.dumps({"tables": [
            {
                "table_title": "Director Shareholding",
                "headers": ["Name", "DIN", "Designation"],
                "rows": [{"columns": ["Jane Doe", "01234567", "MD"]}],
                "page_num": 2,
            }
        ]})
        mock_model.generate_content.return_value = mock_response
        mock_gm.return_value = mock_model

        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
            dummy = tmp_path / "board.pdf"
            dummy.write_bytes(b"%PDF-1.4 dummy")
            result = extract_tables_from_pdf(str(dummy))

        assert isinstance(result, TableExtractionResult)
        assert len(result.tables) == 1
        assert result.tables[0].table_title == "Director Shareholding"
        mock_delete.assert_called_once_with("gemini_table_file")

    def test_missing_gemini_key_raises_runtime_error(self, tmp_path):
        from src.extraction.table_extractor import extract_tables_from_pdf

        dummy = tmp_path / "nodoc.pdf"
        dummy.write_bytes(b"%PDF-1.4 dummy")

        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
                extract_tables_from_pdf(str(dummy))


# ═══════════════════════════════════════════════════════════════════════════════
# Part D: Background Processing Integration Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestBackgroundProcessing:

    @patch("src.api.document_upload_router.ClientDataChunker")
    @patch("src.api.document_upload_router._extract_text_from_file")
    def test_background_job_marks_done_on_success(self, mock_extract, mock_chunker, test_db):
        from src.api.document_upload_router import _process_document_background
        from src.extraction.schema import UploadedDocument
        db, company, _ = test_db

        record = UploadedDocument(
            company_id=company.id, filename="bg_done_test.pdf",
            doc_type="other", status="pending",
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        mock_extract.return_value = "Some document content about general business matters."
        mock_chunker.return_value.process.return_value = []

        # Patch SessionLocal to prevent background job from closing the test DB
        with patch("src.api.document_upload_router.SessionLocal", return_value=MagicMock(wraps=db, close=MagicMock())):
            _process_document_background(
                file_path="/fake/path/bg_done_test.pdf",
                upload_id=str(record.id),
                company_id_str=str(company.id),
                company_name=company.name,
                filename="bg_done_test.pdf",
            )

        db.refresh(record)
        assert record.status == "done", f"Expected 'done', got '{record.status}'"

    @patch("src.api.document_upload_router._extract_text_from_file")
    def test_background_job_marks_error_on_empty_text(self, mock_extract, test_db):
        from src.api.document_upload_router import _process_document_background
        from src.extraction.schema import UploadedDocument
        db, company, _ = test_db

        record = UploadedDocument(
            company_id=company.id, filename="bg_empty_test.pdf",
            doc_type="other", status="pending",
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        mock_extract.return_value = "   "

        with patch("src.api.document_upload_router.SessionLocal", return_value=MagicMock(wraps=db, close=MagicMock())):
            _process_document_background(
                file_path="/fake/path/bg_empty_test.pdf",
                upload_id=str(record.id),
                company_id_str=str(company.id),
                company_name=company.name,
                filename="bg_empty_test.pdf",
            )

        db.refresh(record)
        assert record.status == "error"

    @patch("src.ingestion.financial_table_parser.FinancialTableParser.extract", return_value=[])
    @patch("src.api.document_upload_router.ClientDataChunker")
    @patch("src.api.document_upload_router._extract_text_from_file")
    def test_financial_table_parser_called_for_financial_docs(
        self, mock_extract, mock_chunker, mock_ft_extract, test_db
    ):
        from src.api.document_upload_router import _process_document_background
        from src.extraction.schema import UploadedDocument
        db, company, _ = test_db

        record = UploadedDocument(
            company_id=company.id, filename="ft_call_test.pdf",
            doc_type="financial_statement", status="pending",
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        mock_extract.return_value = "Revenue 5200 Lakhs EBITDA 940 PAT 620 Net Worth 3100"
        mock_chunker.return_value.process.return_value = []

        with patch("src.api.document_upload_router.SessionLocal", return_value=MagicMock(wraps=db, close=MagicMock())):
            _process_document_background(
                file_path="/fake/path/ft_call_test.pdf",
                upload_id=str(record.id),
                company_id_str=str(company.id),
                company_name=company.name,
                filename="ft_call_test.pdf",
            )

        mock_ft_extract.assert_called_once()

    @patch("src.ingestion.financial_table_parser.FinancialTableParser.extract")
    @patch("src.api.document_upload_router.ClientDataChunker")
    @patch("src.api.document_upload_router._extract_text_from_file")
    def test_financial_tables_persisted_to_db(
        self, mock_extract, mock_chunker, mock_ft_extract, test_db
    ):
        """FinancialTable DB rows must be created after processing a financial doc."""
        from src.api.document_upload_router import _process_document_background
        from src.extraction.schema import UploadedDocument, FinancialTable as FTModel
        db, company, _ = test_db

        record = UploadedDocument(
            company_id=company.id, filename="ft_persist_test.pdf",
            doc_type="financial_statement", status="pending",
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        mock_extract.return_value = "Revenue 5200 Lakhs EBITDA 940 PAT 620"
        mock_chunker.return_value.process.return_value = []

        # Build a FinancialTable-like object the parser would return
        class FakeFT:
            page = 4
            statement_type = "Profit & Loss"
            years = [2022, 2023, 2024]
            units = "₹ Lakhs"
            currency = "INR"
            source_file = "pnl_2024.pdf"
            table_title = "P&L Statement"

            def to_dict(self):
                return {"rows": [{"Revenue": 5200}]}

        mock_ft_extract.return_value = [FakeFT()]

        before_count = db.query(FTModel).filter(
            FTModel.company_id == company.id
        ).count()

        with patch("src.api.document_upload_router.SessionLocal", return_value=MagicMock(wraps=db, close=MagicMock())):
            _process_document_background(
                file_path="/fake/path/pnl_2024.pdf",
                upload_id=str(record.id),
                company_id_str=str(company.id),
                company_name=company.name,
                filename="pnl_2024.pdf",
            )

        after_count = db.query(FTModel).filter(
            FTModel.company_id == company.id
        ).count()
        assert after_count == before_count + 1, (
            f"Expected {before_count + 1} FinancialTable rows after processing, "
            f"got {after_count}"
        )
        saved = db.query(FTModel).filter(
            FTModel.company_id == company.id,
            FTModel.source_file == "pnl_2024.pdf",
        ).first()
        assert saved is not None
        assert saved.statement_type == "Profit & Loss"


# ═══════════════════════════════════════════════════════════════════════════════
# Part E: AuditLog Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestAuditLog:

    def test_audit_log_written_on_upload(self, api_client, auth_token, test_db, minimal_pdf):
        from src.extraction.schema import AuditLog
        db, company, _ = test_db

        before_count = db.query(AuditLog).filter(
            AuditLog.company_id == company.id
        ).count()

        with open(minimal_pdf, "rb") as f:
            response = api_client.post(
                f"/api/documents/upload/{company.id}",
                headers={"Authorization": f"Bearer {auth_token}"},
                data={"doc_type": "financial_statement"},
                files={"file": ("financials_audit_test.pdf", f, "application/pdf")},
            )
        assert response.status_code in (200, 202), f"Upload failed: {response.text}"

        after_count = db.query(AuditLog).filter(
            AuditLog.company_id == company.id
        ).count()
        assert after_count > before_count, (
            f"AuditLog row not written. Before: {before_count}, After: {after_count}"
        )
        log = (
            db.query(AuditLog)
            .filter(
                AuditLog.company_id == company.id,
                AuditLog.event_type == "document_upload",
            )
            .order_by(AuditLog.timestamp.desc())
            .first()
        )
        assert log is not None
        assert "financials_audit_test.pdf" in (log.source_file or "")


# ═══════════════════════════════════════════════════════════════════════════════
# Part F: Auto-classification Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestAutoClassification:

    @patch("src.extraction.doc_classifier.DocClassifier.classify_from_path")
    def test_auto_doc_type_triggers_classifier(
        self, mock_classify, api_client, auth_token, test_db, minimal_pdf
    ):
        mock_classify.return_value = "financial_statement"
        _, company, _ = test_db

        with open(minimal_pdf, "rb") as f:
            response = api_client.post(
                f"/api/documents/upload/{company.id}",
                headers={"Authorization": f"Bearer {auth_token}"},
                data={"doc_type": "auto"},
                files={"file": ("auto_classify_test.pdf", f, "application/pdf")},
            )
        assert response.status_code in (200, 202)
        mock_classify.assert_called_once()

    def test_explicit_doc_type_bypasses_classifier(
        self, api_client, auth_token, test_db, minimal_pdf
    ):
        with patch(
            "src.extraction.doc_classifier.DocClassifier.classify_from_path"
        ) as mock_classify:
            _, company, _ = test_db
            with open(minimal_pdf, "rb") as f:
                api_client.post(
                    f"/api/documents/upload/{company.id}",
                    headers={"Authorization": f"Bearer {auth_token}"},
                    data={"doc_type": "board_resolution"},
                    files={"file": ("explicit_type.pdf", f, "application/pdf")},
                )
            mock_classify.assert_not_called()


# ═══════════════════════════════════════════════════════════════════════════════
# Part G: Upload API Endpoint Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestUploadAPIEndpoints:

    def test_upload_returns_upload_id_and_status(self, api_client, auth_token, test_db, minimal_pdf):
        _, company, _ = test_db
        with open(minimal_pdf, "rb") as f:
            response = api_client.post(
                f"/api/documents/upload/{company.id}",
                headers={"Authorization": f"Bearer {auth_token}"},
                data={"doc_type": "financial_statement"},
                files={"file": ("shape_test.pdf", f, "application/pdf")},
            )
        assert response.status_code in (200, 202), f"Got: {response.text}"
        data = response.json()
        assert "upload_id" in data, f"Missing 'upload_id' in: {data}"
        assert "filename" in data
        assert "status" in data
        assert data["status"] in ("pending", "processing", "done")

    def test_upload_rejects_unsupported_extension(self, api_client, auth_token, test_db, tmp_path):
        _, company, _ = test_db
        bad_file = tmp_path / "malware.exe"
        bad_file.write_bytes(b"MZ not a document")
        with open(bad_file, "rb") as f:
            response = api_client.post(
                f"/api/documents/upload/{company.id}",
                headers={"Authorization": f"Bearer {auth_token}"},
                data={"doc_type": "other"},
                files={"file": ("malware.exe", f, "application/octet-stream")},
            )
        assert response.status_code == 400

    def test_upload_rejects_wrong_company(self, api_client, auth_token):
        """JWT for company A must not allow upload for a different company B."""
        wrong_id = str(uuid.uuid4())
        dummy_file = io.BytesIO(b"%PDF-1.4 content")
        response = api_client.post(
            f"/api/documents/upload/{wrong_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
            data={"doc_type": "other"},
            files={"file": ("test.pdf", dummy_file, "application/pdf")},
        )
        assert response.status_code == 403

    def test_status_endpoint_returns_list_with_correct_schema(
        self, api_client, auth_token, test_db, minimal_pdf
    ):
        _, company, _ = test_db
        # Upload first so there's at least one record
        with open(minimal_pdf, "rb") as f:
            api_client.post(
                f"/api/documents/upload/{company.id}",
                headers={"Authorization": f"Bearer {auth_token}"},
                data={"doc_type": "other"},
                files={"file": ("status_schema.pdf", f, "application/pdf")},
            )
        response = api_client.get(
            f"/api/documents/status/{company.id}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        items = response.json()
        assert isinstance(items, list)
        assert len(items) > 0
        item = items[0]
        assert "upload_id" in item or "id" in item
        assert "filename" in item
        assert "doc_type" in item
        assert "status" in item
        assert item["status"] in ("pending", "processing", "done", "error")

    def test_upload_without_auth_rejected(self, api_client, test_db, minimal_pdf):
        _, company, _ = test_db
        with open(minimal_pdf, "rb") as f:
            response = api_client.post(
                f"/api/documents/upload/{company.id}",
                data={"doc_type": "other"},
                files={"file": ("noauth.pdf", f, "application/pdf")},
            )
        assert response.status_code in (401, 403)


# ═══════════════════════════════════════════════════════════════════════════════
# Part H: Admin API Tests
# ═══════════════════════════════════════════════════════════════════════════════

class TestAdminAPI:

    @patch("src.retrieval.vector_store.VectorStore")
    def test_list_collections_endpoint(self, mock_vs_cls, api_client, auth_token):
        mock_col = MagicMock()
        mock_col.name = "regulatory_clauses"
        mock_vs = MagicMock()
        mock_vs.client.list_collections.return_value = [mock_col]
        mock_vs.count.return_value = 42
        mock_vs_cls.return_value = mock_vs

        # Patch the import inside admin_router endpoint
        with patch("src.api.admin_router.VectorStore", mock_vs_cls):
            response = api_client.get(
                "/api/admin/collections",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert data[0]["name"] == "regulatory_clauses"
        assert data[0]["count"] == 42

    def test_admin_search_returns_chunks(self, api_client, auth_token):
        mock_results = [{
            "id": "chunk_001",
            "rrf_score": 0.87,
            "text": "SEBI ICDR Regulation 229 states SME IPO eligibility...",
            "metadata": {"source": "icdr.pdf", "page": 12},
        }]
        mock_searcher_instance = MagicMock()
        mock_searcher_instance.search.return_value = mock_results

        with patch("src.api.admin_router.VectorStore"), \
             patch("src.api.admin_router.BGEM3Embedder"), \
             patch("src.api.admin_router.HybridSearcher", return_value=mock_searcher_instance):
            response = api_client.post(
                "/api/admin/search",
                headers={"Authorization": f"Bearer {auth_token}"},
                json={"collection": "regulatory_clauses", "query": "SEBI eligibility", "k": 5},
            )
        assert response.status_code == 200
        results = response.json()
        assert isinstance(results, list)
        assert len(results) == 1
        assert "id" in results[0]
        assert "score" in results[0]
        assert "text" in results[0]
        assert "metadata" in results[0]
        assert results[0]["score"] == pytest.approx(0.87, abs=0.01)

    def test_list_collections_handles_vector_store_error(self, api_client, auth_token):
        with patch("src.api.admin_router.VectorStore", side_effect=Exception("ChromaDB not initialized")):
            response = api_client.get(
                "/api/admin/collections",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        assert response.status_code == 500
        assert "VectorStore error" in response.json()["detail"]
