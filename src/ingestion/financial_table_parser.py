"""
src/ingestion/financial_table_parser.py

Dedicated Financial Table Intelligence Pipeline (Levels 1-5).

Level 1 — Multi-library extraction: pdfplumber (primary) → PyMuPDF (fallback), openpyxl for Excel
Level 2 — Structured JSON output: {table_title, columns, rows, units, currency, page}
Level 3 — Hierarchy detection: distinguishes parent/summary rows from child/detail rows
Level 4 — Financial normalisation: converts "₹1,245 Lakhs", "1.24 Cr" → canonical {value, scale}
Level 5 — LLM-assisted metadata: Groq classifies statement_type, years, key metrics per table
"""
import os
import re
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


# ─── Level 4: Financial Value Normalisation ───────────────────────────────────

_CRORE_PATTERN = re.compile(r"([\d,]+\.?\d*)\s*(cr\.?|crore)", re.IGNORECASE)
_LAKH_PATTERN = re.compile(r"([\d,]+\.?\d*)\s*(l|lakh|lakhs)", re.IGNORECASE)
_PLAIN_PATTERN = re.compile(r"^[\s₹\$]*([\d,]+\.?\d*)[\s]*$")


def _parse_financial_value(raw: str) -> Optional[float]:
    """
    Normalises a financial cell to a float in Lakhs.
    Handles: "₹1,245.40", "1,245", "1.24 Cr", "1245 Lakhs", "0.80 Crore".
    Returns None if the cell is not a recognisable number.
    """
    if raw is None:
        return None
    raw = str(raw).strip().replace(",", "").replace("₹", "").replace("$", "")
    raw = raw.strip()

    m = _CRORE_PATTERN.search(raw)
    if m:
        return float(m.group(1)) * 100  # Convert Crores → Lakhs

    m = _LAKH_PATTERN.search(raw)
    if m:
        return float(m.group(1))

    m = _PLAIN_PATTERN.match(raw)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass

    return None


def _detect_units(text_block: str) -> str:
    """Scan surrounding text to detect the unit of measurement (Lakhs, Crores, etc.)."""
    text_lower = text_block.lower()
    if "crore" in text_lower or " cr " in text_lower:
        return "₹ Crores"
    if "lakh" in text_lower or " l " in text_lower:
        return "₹ Lakhs"
    if "million" in text_lower:
        return "₹ Millions"
    return "₹ Lakhs"  # default for Indian financial documents


# ─── Level 3: Hierarchy Detection ────────────────────────────────────────────

def _classify_row_level(row: List[str], all_rows: List[List[str]], idx: int) -> str:
    """
    Heuristic to classify a row as 'header', 'parent', 'child', or 'total'.
    Uses: leading whitespace, all-caps text, surrounding blank rows.
    """
    if not row or not any(cell.strip() for cell in row):
        return "blank"

    first_cell = str(row[0]) if row else ""

    # If all numeric cells are empty → likely a section header/parent row
    numeric_cells = [c for c in row[1:] if c.strip()]
    if not numeric_cells:
        return "parent"

    # Bold/uppercase first cell often indicates totals or headers
    if first_cell.strip().isupper() or first_cell.strip().startswith("Total") or first_cell.strip().startswith("Net"):
        return "total"

    # Leading whitespace in the first cell indicates a sub-item / child row
    if str(row[0]).startswith("  ") or str(row[0]).startswith("\t"):
        return "child"

    return "leaf"


# ─── Level 5: LLM-Assisted Metadata ──────────────────────────────────────────

def _classify_table_with_llm(table_text: str) -> Dict[str, Any]:
    """
    Sends the table's text representation to Groq to extract structured metadata.
    Returns dict with: statement_type, years, metrics, units.
    Falls back to empty dict on failure.
    """
    try:
        import os as _os
        api_key = _os.getenv("GROQ_API_KEY")
        if not api_key:
            return {}

        import json
        from groq import Groq
        client = Groq(api_key=api_key)
        prompt = (
            "You are a financial statement expert. Analyse this table excerpt and return ONLY a JSON object (no markdown) like:\n"
            '{"statement_type": "Profit & Loss", "years": [2022, 2023, 2024], "metrics": ["Revenue", "EBITDA", "PAT"], "units": "₹ Lakhs"}\n\n'
            "statement_type must be one of: Profit & Loss | Balance Sheet | Cash Flow | Notes | Other\n\n"
            f"Table:\n{table_text[:3000]}"
        )
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=200,
        )
        raw = completion.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"LLM table classification failed: {e}")
        return {}


# ─── Level 1 & 2: Multi-Library Extraction + Structured JSON Output ───────────

class FinancialTable:
    """In-memory representation of a single extracted financial table."""

    def __init__(self):
        self.table_title: str = ""
        self.columns: List[str] = []
        self.rows: List[Dict[str, Any]] = []
        self.hierarchy_rows: List[Dict[str, Any]] = []  # rows with level metadata
        self.page: Optional[int] = None
        self.source_file: str = ""
        self.units: str = "₹ Lakhs"
        self.currency: str = "INR"
        self.statement_type: Optional[str] = None
        self.years: Optional[List[int]] = None
        self.metrics: Optional[List[str]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "table_title": self.table_title,
            "columns": self.columns,
            "rows": self.rows,
            "hierarchy_rows": self.hierarchy_rows,
            "page": self.page,
            "source_file": self.source_file,
            "units": self.units,
            "currency": self.currency,
            "statement_type": self.statement_type,
            "years": self.years,
            "metrics": self.metrics,
        }

    def to_summary_text(self) -> str:
        """Creates a natural-language summary for embedding (Level 6 prep)."""
        parts = []
        if self.statement_type:
            parts.append(f"{self.statement_type} statement")
        if self.years:
            parts.append(f"for years {', '.join(str(y) for y in self.years)}")
        if self.metrics:
            parts.append(f"covering {', '.join(self.metrics[:5])}")
        if self.units:
            parts.append(f"in {self.units}")
        if self.table_title:
            parts.append(f"(Title: {self.table_title})")
        return " ".join(parts) if parts else "Financial table"


def _process_raw_table(
    raw_rows: List[List[str]],
    page: Optional[int],
    source_file: str,
    surrounding_text: str = "",
) -> Optional[FinancialTable]:
    """
    Converts a raw 2D list of strings into a structured FinancialTable.
    Applies hierarchy detection, normalisation, and LLM metadata.
    """
    if not raw_rows or len(raw_rows) < 2:
        return None

    table = FinancialTable()
    table.page = page
    table.source_file = source_file
    table.units = _detect_units(surrounding_text)

    # First row is treated as header (columns)
    header_row = [str(c).strip() if c else "" for c in raw_rows[0]]
    table.columns = header_row

    data_rows = raw_rows[1:]

    for i, raw_row in enumerate(data_rows):
        if len(raw_row) < len(header_row):
            raw_row = raw_row + [""] * (len(header_row) - len(raw_row))

        row_level = _classify_row_level(raw_row, data_rows, i)
        row_dict = {}
        for j, col in enumerate(header_row):
            cell = str(raw_row[j]).strip() if j < len(raw_row) else ""
            # For the first column (label), keep as-is
            if j == 0:
                row_dict[col] = cell
            else:
                # Try normalising numeric cells
                parsed = _parse_financial_value(cell)
                row_dict[col] = parsed if parsed is not None else cell

        table.rows.append(row_dict)
        table.hierarchy_rows.append({**row_dict, "_level": row_level})

    # Level 5: LLM metadata classification
    table_text = "\n".join(
        "\t".join(str(c) for c in r) for r in raw_rows[:20]
    )
    llm_meta = _classify_table_with_llm(table_text)
    if llm_meta:
        table.statement_type = llm_meta.get("statement_type")
        table.years = llm_meta.get("years")
        table.metrics = llm_meta.get("metrics")
        if llm_meta.get("units"):
            table.units = llm_meta["units"]

    return table


def _extract_tables_pdfplumber(file_path: str) -> List[FinancialTable]:
    """Level 1: Primary PDF table extractor using pdfplumber."""
    tables = []
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                surrounding_text = page.extract_text() or ""
                raw_tables = page.extract_tables()
                for raw_table in raw_tables:
                    if not raw_table:
                        continue
                    ft = _process_raw_table(
                        raw_table, page=page_num,
                        source_file=os.path.basename(file_path),
                        surrounding_text=surrounding_text,
                    )
                    if ft:
                        tables.append(ft)
    except ImportError:
        logger.warning("pdfplumber not installed. Falling back to PyMuPDF for table extraction.")
    except Exception as e:
        logger.error(f"pdfplumber extraction error: {e}")
    return tables


def _extract_tables_pymupdf(file_path: str) -> List[FinancialTable]:
    """Level 1: Fallback PDF table extractor using PyMuPDF."""
    tables = []
    try:
        import fitz
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc[page_num]
            surrounding_text = page.get_text("text") or ""
            tab_finder = page.find_tables()
            if not (tab_finder and tab_finder.tables):
                continue
            for tab in tab_finder.tables:
                raw = tab.extract()
                if not raw:
                    continue
                clean_raw = [[str(c) if c is not None else "" for c in row] for row in raw]
                ft = _process_raw_table(
                    clean_raw, page=page_num + 1,
                    source_file=os.path.basename(file_path),
                    surrounding_text=surrounding_text,
                )
                if ft:
                    tables.append(ft)
        doc.close()
    except Exception as e:
        logger.error(f"PyMuPDF table extraction error: {e}")
    return tables


def _extract_tables_excel(file_path: str) -> List[FinancialTable]:
    """Level 1: Excel table extractor using openpyxl."""
    tables = []
    try:
        import openpyxl
        wb = openpyxl.load_workbook(file_path, data_only=True)
        for sheet in wb.worksheets:
            raw_rows = []
            for row in sheet.iter_rows(values_only=True):
                raw_rows.append([str(c) if c is not None else "" for c in row])

            # Filter out completely empty rows
            raw_rows = [r for r in raw_rows if any(c.strip() for c in r)]

            if len(raw_rows) < 2:
                continue

            ft = _process_raw_table(
                raw_rows, page=None,
                source_file=os.path.basename(file_path),
                surrounding_text=" ".join(raw_rows[0]),
            )
            if ft:
                ft.table_title = sheet.title
                tables.append(ft)
    except ImportError:
        logger.warning("openpyxl not installed. Cannot extract tables from Excel files.")
    except Exception as e:
        logger.error(f"openpyxl extraction error: {e}")
    return tables


# ─── Public API ───────────────────────────────────────────────────────────────

class FinancialTableParser:
    """
    Main entry point for the Financial Table Intelligence Pipeline (Levels 1-5).

    Usage:
        parser = FinancialTableParser()
        tables = parser.extract(file_path="/path/to/financials.pdf")
        for table in tables:
            print(table.statement_type, table.years, table.to_summary_text())
    """

    def extract(self, file_path: str) -> List[FinancialTable]:
        """
        Extracts all financial tables from the given file.
        Supports: PDF, XLSX, XLS.
        """
        ext = os.path.splitext(file_path)[1].lower()

        if ext == ".pdf":
            tables = _extract_tables_pdfplumber(file_path)
            if not tables:
                logger.info(f"pdfplumber found no tables in {file_path}. Trying PyMuPDF...")
                tables = _extract_tables_pymupdf(file_path)
        elif ext in (".xlsx", ".xls"):
            tables = _extract_tables_excel(file_path)
        else:
            logger.warning(f"FinancialTableParser: unsupported file type '{ext}'")
            return []

        logger.info(f"Extracted {len(tables)} financial tables from '{file_path}'")
        return tables

    def extract_to_dicts(self, file_path: str) -> List[Dict[str, Any]]:
        """Convenience method that returns tables as plain dicts."""
        return [t.to_dict() for t in self.extract(file_path)]
