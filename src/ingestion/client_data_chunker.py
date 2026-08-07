"""
src/ingestion/client_data_chunker.py

Chunks and classifies documents uploaded by the client (active company going for IPO).
Unlike the precedent chunker (which handles historical DRHPs) and the regulatory chunker
(which handles SEBI rules), this module processes the company's own raw documents:
  - Audited Financial Statements
  - Board Resolutions
  - MOA / AOA
  - Vendor Contracts, Licences, etc.

It maps each chunk to a DRHP section taxonomy using a Groq LLM call, enriches with
context breadcrumbs, and prepares them for indexing in the Vector Store under the
shared 'client_documents' collection (filtered by company_id at query time).
"""
import os
import uuid
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from src.ingestion.context_enricher import enrich_chunk_text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# The set of DRHP section categories we map chunks into.
# Mirrors the top-level DRHP taxonomy used by the agent.
DRHP_SECTIONS = [
    "Cover Page & Summary",
    "Risk Factors",
    "Business Overview",
    "Industry Overview",
    "Financial Statements",
    "Management Discussion & Analysis",
    "Management & Board of Directors",
    "Our Promoters & Promoter Group",
    "Key Managerial Personnel (KMP)",
    "Capital Structure",
    "Objects of the Issue",
    "Basis of Issue Price",
    # Added to match SECTIONS_25 in server.py (present in 14/20 real filings).
    "Outstanding Litigation and Material Developments",
    "Legal & Other Information",
    "Key Industry Regulations",
    "Corporate Governance",
    "Other Regulatory & Statutory Disclosures",
    "General",
]


class ClientChunk(BaseModel):
    chunk_id: str
    company_id: str
    source_file: str
    page: Optional[int] = None
    text: str
    enriched_text: str
    section_mapped_to: str  # Which DRHP section this chunk belongs to
    doc_type: str           # 'financial_statement' | 'board_resolution' | 'moa' | 'other'
    metadata: Dict[str, Any]


def _classify_chunk_section(text: str, doc_type: str) -> str:
    """
    Uses Groq to classify a text chunk into one of the DRHP section categories.
    Falls back to a rule-based heuristic if Groq is unavailable.
    """
    # Rule-based fast path based on doc_type
    doc_type_map = {
        "financial_statement": "Financial Statements",
        "board_resolution": "Corporate Governance",
        "moa": "Legal & Other Information",
        "aoa": "Legal & Other Information",
        # Litigation documents now map to the dedicated chapter that exists in
        # SECTIONS_25. Previously this routed to Risk Factors as a stopgap.
        "litigation": "Outstanding Litigation and Material Developments",
        "gst_certificate": "Legal & Other Information",
    }
    if doc_type in doc_type_map:
        return doc_type_map[doc_type]

    # Keyword-based heuristic as a quick fallback
    text_lower = text.lower()
    if any(k in text_lower for k in ["revenue", "ebitda", "profit", "loss", "balance sheet", "pat", "net worth"]):
        return "Financial Statements"
    if any(k in text_lower for k in ["risk", "litigation", "dispute", "regulatory penalty"]):
        return "Risk Factors"
    if any(k in text_lower for k in ["director", "board", "kmp", "managing director", "din"]):
        return "Management & Board of Directors"
    if any(k in text_lower for k in ["promoter", "promoter group", "shareholding"]):
        return "Our Promoters & Promoter Group"
    if any(k in text_lower for k in ["objects of the issue", "utilization", "fund raising"]):
        return "Objects of the Issue"
    if any(k in text_lower for k in ["industry", "market size", "sector", "competition"]):
        return "Industry Overview"

    # Groq LLM classification as the accurate path
    try:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return "General"

        from groq import Groq
        client = Groq(api_key=api_key)
        sections_list = "\n".join(f"- {s}" for s in DRHP_SECTIONS)
        prompt = (
            f"You are a SEBI-certified merchant banker. Given the following text excerpt from a company document, "
            f"classify it into exactly one of the following DRHP sections.\n\n"
            f"DRHP Sections:\n{sections_list}\n\n"
            f"Text:\n{text[:1500]}\n\n"
            f"Respond with ONLY the section name, nothing else."
        )
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=30,
        )
        result = completion.choices[0].message.content.strip()
        # Validate against known sections
        for section in DRHP_SECTIONS:
            if section.lower() in result.lower():
                return section
    except Exception as e:
        logger.warning(f"Groq section classification failed: {e}. Defaulting to 'General'.")

    return "General"


def _detect_doc_type(filename: str) -> str:
    """Infer document type from filename keywords."""
    name = filename.lower()
    if any(k in name for k in ["financial", "balance_sheet", "p&l", "profit_loss", "audit"]):
        return "financial_statement"
    if any(k in name for k in ["board_resolution", "board_res", "br_"]):
        return "board_resolution"
    if "moa" in name or "memorandum" in name:
        return "moa"
    if "aoa" in name or "articles" in name:
        return "aoa"
    if "litigation" in name or "legal_notice" in name:
        return "litigation"
    if "gst" in name:
        return "gst_certificate"
    return "other"


class ClientDataChunker:
    """
    Chunks raw text from client-uploaded documents into ~500-word overlapping windows,
    classifies each chunk into a DRHP section, enriches with breadcrumbs, and
    returns a list of ClientChunk objects ready for Vector Store indexing.
    """

    def __init__(self, chunk_size: int = 500, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def process(
        self,
        text: str,
        company_id: str,
        source_file: str,
        company_name: str = "",
        page: Optional[int] = None,
    ) -> List[ClientChunk]:
        """
        Main entry point. Splits text into chunks, classifies each to a DRHP section,
        enriches with context, and returns ClientChunk objects.

        Args:
            text: Full raw text extracted from the document.
            company_id: UUID of the company (as string) — stored as metadata for Vector filtering.
            source_file: Original filename, used to infer doc_type.
            company_name: Human-readable company name for breadcrumb enrichment.
            page: Optional page number if processing a single page.
        """
        doc_type = _detect_doc_type(source_file)
        words = text.split()
        chunks: List[ClientChunk] = []
        idx = 0

        for i in range(0, len(words), self.chunk_size - self.overlap):
            chunk_words = words[i : i + self.chunk_size]
            if not chunk_words:
                break

            chunk_text = " ".join(chunk_words)
            section = _classify_chunk_section(chunk_text, doc_type)

            metadata = {
                "company_id": company_id,
                "company": company_name,
                "source_file": source_file,
                "doc_type": doc_type,
                "section": section,
                "page": page or 0,
            }

            enriched = enrich_chunk_text(chunk_text, metadata)
            chunk_id = f"{company_id}_{os.path.splitext(source_file)[0]}_chunk_{idx}"

            chunks.append(
                ClientChunk(
                    chunk_id=chunk_id,
                    company_id=company_id,
                    source_file=source_file,
                    page=page,
                    text=chunk_text,
                    enriched_text=enriched,
                    section_mapped_to=section,
                    doc_type=doc_type,
                    metadata=metadata,
                )
            )
            idx += 1

        logger.info(
            f"ClientDataChunker: {len(chunks)} chunks from '{source_file}' "
            f"(doc_type={doc_type}) for company {company_id}"
        )
        return chunks
