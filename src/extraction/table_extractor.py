"""
src/extraction/table_extractor.py

Gemini 2.5 Flash powered structured table extraction.
Handles semantically complex tables requiring LLM understanding:
  - Director / KMP shareholding tables
  - Capital structure tables
  - Promoter holding tables
  - Financial statement summary tables

Complements financial_table_parser.py (which handles PyMuPDF / pdfplumber
multi-level extraction). This module adds Gemini-level semantic understanding
on top so that rows can be directly upserted into DB models like DirectorKMP.
"""
import os
import logging
from typing import List

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

from pydantic import BaseModel


class TableRow(BaseModel):
    columns: List[str]


class ExtractedTable(BaseModel):
    table_title: str
    headers: List[str]
    rows: List[TableRow]
    page_num: int


class TableExtractionResult(BaseModel):
    tables: List[ExtractedTable]


# ─── Core Gemini Extraction ────────────────────────────────────────────────────


def extract_tables_from_pdf(file_path: str) -> TableExtractionResult:
    """
    Uses Gemini 2.5 Flash to extract ALL structured tables from a PDF.
    Returns strictly validated Pydantic models.

    Use cases:
      - Director shareholding → populate DirectorKMP table
      - Financial summary → populate FinancialStatement table
      - Capital structure → populate OfferDetails table
      - Promoter holdings → populate related disclosures

    Args:
        file_path: Absolute path to the PDF file.

    Returns:
        TableExtractionResult with a list of ExtractedTable objects.

    Raises:
        RuntimeError if Gemini API key is missing.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY not set. Cannot run Gemini table extraction."
        )

    import google.generativeai as genai
    genai.configure(api_key=api_key)

    model = genai.GenerativeModel(
        "gemini-2.5-flash",
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            response_schema=TableExtractionResult,
        ),
    )

    with open(file_path, "rb") as f:
        doc = genai.upload_file(f, mime_type="application/pdf")

    try:
        prompt = (
            "Extract ALL tables from this document. "
            "For each table, identify: the table title, all column headers, "
            "all data rows (each row as a list of cell value strings in order), "
            "and the page number where the table appears. "
            "Include: shareholding tables, financial statement tables, "
            "capital structure tables, promoter holding tables, "
            "director/KMP tables, and any other tabular data present."
        )
        response = model.generate_content([prompt, doc])
        result = TableExtractionResult.model_validate_json(response.text)
        logger.info(
            f"Gemini extracted {len(result.tables)} tables from "
            f"'{os.path.basename(file_path)}'"
        )
        return result
    finally:
        try:
            genai.delete_file(doc.name)
        except Exception:
            pass


# ─── DB Integration Helpers ────────────────────────────────────────────────────


def extract_and_populate_directors(
    file_path: str,
    company_id_uuid,
    db,
) -> int:
    """
    Extracts director / KMP / shareholding tables using Gemini and upserts
    the results into the DirectorKMP database table.

    Args:
        file_path: Path to the uploaded PDF.
        company_id_uuid: UUID object for the company.
        db: SQLAlchemy Session.

    Returns:
        Number of DirectorKMP records upserted.
    """
    from src.extraction.schema import DirectorKMP

    try:
        result = extract_tables_from_pdf(file_path)
    except Exception as e:
        logger.warning(
            f"Gemini table extraction failed for director upsert: {e}"
        )
        return 0

    count = 0
    for table in result.tables:
        # Only process tables that look like director / shareholder tables
        title_lower = table.table_title.lower()
        if not any(
            kw in title_lower
            for kw in ["director", "kmp", "shareholding", "promoter", "board"]
        ):
            continue

        headers_lower = [h.lower() for h in table.headers]

        # Locate column indices by header keyword
        name_col = next(
            (i for i, h in enumerate(headers_lower) if "name" in h), None
        )
        din_col = next(
            (i for i, h in enumerate(headers_lower) if "din" in h), None
        )
        desig_col = next(
            (
                i
                for i, h in enumerate(headers_lower)
                if "designation" in h or "role" in h or "position" in h
            ),
            None,
        )

        for row in table.rows:
            cells = row.columns

            name = (
                cells[name_col].strip()
                if name_col is not None and name_col < len(cells)
                else ""
            )
            if not name:
                continue

            din = (
                cells[din_col].strip()
                if din_col is not None and din_col < len(cells)
                else None
            )
            designation = (
                cells[desig_col].strip()
                if desig_col is not None and desig_col < len(cells)
                else None
            )

            # Upsert: update if DIN matches an existing record, otherwise insert
            existing = None
            if din:
                existing = (
                    db.query(DirectorKMP)
                    .filter(
                        DirectorKMP.company_id == company_id_uuid,
                        DirectorKMP.din == din,
                    )
                    .first()
                )

            if existing:
                if designation:
                    existing.designation = designation
                logger.debug(f"Updated DirectorKMP: {name} (DIN: {din})")
            else:
                db.add(
                    DirectorKMP(
                        company_id=company_id_uuid,
                        name=name,
                        din=din,
                        designation=designation,
                    )
                )
                logger.debug(f"Inserted DirectorKMP: {name} (DIN: {din})")
            count += 1

    db.commit()
    logger.info(
        f"Upserted {count} DirectorKMP records from "
        f"'{os.path.basename(file_path)}'"
    )
    return count
