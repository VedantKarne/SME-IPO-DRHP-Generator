import os
import json
import logging
from typing import List, Dict, Any, Literal, Optional

# Disable huggingface hub warnings
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from src.retrieval.bge_m3_embedder import BGEM3Embedder
from src.retrieval.vector_store import VectorStore, COLLECTION_CLIENT
from src.retrieval.parent_doc_store import ParentDocStore
from src.retrieval.flashrank_reranker import FlashRankReranker
from src.retrieval.hybrid_retriever import HybridRetriever

from sqlalchemy.orm import Session
from src.extraction.db_session import SessionLocal
from src.extraction.schema import Company, FinancialStatement, DirectorKMP, GeneratedSection

logger = logging.getLogger(__name__)

class RetrievalUnavailable(RuntimeError):
    """Raised when the retrieval stack could not be constructed or a query failed."""


# Initialize retrieval stack (Singleton pattern for agent scope)
_retriever = None
_retriever_error = ""
try:
    _embedder = BGEM3Embedder(use_fp16=True)
    _vector_store = VectorStore()
    _parent_store = ParentDocStore()
    _reranker = FlashRankReranker()
    _retriever = HybridRetriever(_embedder, _vector_store, _parent_store, _reranker)
except Exception as e:
    logger.exception("Failed to initialize retrieval stack")
    _retriever_error = str(e)


def rag_search(
    query: str,
    corpus: Literal["regulatory", "precedent", "both"] = "both",
    query_type: Literal["compliance", "precedent", "gap"] = "compliance",
    k: int = 5
) -> str:
    """
    Hybrid retrieval from SEBI ICDR regulatory clauses AND/OR real DRHP precedent filings.

    Raises RetrievalUnavailable when retrieval cannot run. It previously returned
    the string "ERROR: Retrieval stack not initialized." — which the orchestrator
    injected into the drafting prompt as though it were regulatory context, so
    the model drafted around an error message and the failure never surfaced.
    """
    if _retriever is None:
        raise RetrievalUnavailable(
            f"Retrieval stack failed to initialize: {_retriever_error or 'unknown error'}"
        )

    try:
        results = _retriever.hybrid_retrieve(
            query=query,
            corpus=corpus,
            k=k,
            mode=query_type
        )
    except Exception as e:
        raise RetrievalUnavailable(f"Retrieval query failed: {e}") from e


    formatted_results = []
    for r in results:
        meta = r.get("metadata", {})

        # Branch on the explicit doc_type the indexers write, rather than probing
        # for the presence of a metadata key.
        if meta.get("doc_type") == "regulation" or "chapter" in meta:
            source = meta.get("source_doc") or "SEBI ICDR Regulations"
            chapter = meta.get("chapter") or ""
            reg = meta.get("regulation_number") or ""
            title = meta.get("section") or meta.get("chapter_title") or ""

            # Build the citation from the parts that actually exist. Emitting
            # "Chapter N/A | Reg N/A" told the reader a lookup had succeeded when
            # the metadata was in fact missing.
            bits = [source]
            if chapter:
                bits.append(f"Chapter {chapter}" if not chapter.startswith("SCHEDULE") else chapter)
            if reg:
                bits.append(f"Reg {reg}")
            if title:
                bits.append(title)
            formatted_results.append(f"[{' | '.join(bits)}]\n{r['text']}")
        else:
            company = str(meta.get("company") or "").strip()
            year = str(meta.get("year") or "").strip()
            section = str(meta.get("section") or "").strip()
            if not company:
                company = str(meta.get("source_doc") or "Unknown filing")

            bits = [f"{company} DRHP" if not company.lower().endswith("drhp") else company]
            if year:
                bits.append(year)
            if section:
                bits.append(section)
            formatted_results.append(f"[{' | '.join(bits)}]\n{r['text']}")

    return "\n\n---\n\n".join(formatted_results)

def _num(value) -> str:
    """
    Render a Numeric column readably.

    SQLAlchemy Numeric returns Decimal, so these rendered as
    "Rev=1500.0000000000" — ten decimal places of noise in every figure the
    model has to read.
    """
    if value is None:
        return "not provided"
    try:
        as_float = float(value)
    except (TypeError, ValueError):
        return str(value)
    if as_float == int(as_float):
        return f"{int(as_float):,}"
    return f"{as_float:,.2f}"


def get_company_data(company_name: str) -> str:
    """
    Fetches structured company facts, financials, director details, and offer
    details from the database. All fields the LLM needs to draft any DRHP section.
    """
    db = SessionLocal()
    try:
        company = db.query(Company).filter(Company.name.ilike(f"%{company_name}%")).first()
        if not company:
            return f"No data found for company: {company_name}"
            
        financials = db.query(FinancialStatement).filter(FinancialStatement.company_id == company.id).all()
        directors = db.query(DirectorKMP).filter(DirectorKMP.company_id == company.id).all()
        
        # Bug 6 Fix: Also fetch OfferDetails — previously absent, causing all offer-related
        # fields (share count, price, issue size) to always surface as ⚠️ GAP markers.
        from src.extraction.schema import OfferDetails
        offer = db.query(OfferDetails).filter(OfferDetails.company_id == company.id).first()
        
        output = [f"Company Name: {company.name}", f"CIN: {company.cin}", f"Incorporation: {company.incorporation_date}"]
        
        if financials:
            output.append("\nFINANCIALS (Lakhs):")
            for f in financials:
                output.append(
                    f"FY{f.fiscal_year}: Revenue={_num(f.revenue_lakhs)}, "
                    f"EBITDA={_num(f.ebitda_lakhs)}, "
                    f"ProfitAfterTax={_num(f.pat_lakhs)}, "
                    f"NetWorth={_num(f.net_worth_lakhs)}, "
                    f"PaidUpCapital={_num(f.paid_up_capital_lakhs)}"
                )
            output.append(
                "NOTE: these labels are authoritative. NetWorth is total net worth, "
                "NOT reserves — do not add PaidUpCapital to it. Reserves and surplus "
                "were not provided; if a section needs them, flag a GAP."
            )
                
        if directors:
            output.append("\nDIRECTORS & KMP:")
            for d in directors:
                litigation = "YES" if d.pending_litigation else "NO"
                output.append(f"- {d.name} ({d.designation}) | DIN: {d.din} | Pending Litigation: {litigation}")
                if d.pending_litigation and d.litigation_details:
                    output.append(f"  Litigation Details: {d.litigation_details}")

        if offer:
            output.append("\nOFFER DETAILS:")
            output.append(f"Total Shares Offered: {_num(offer.total_shares_offered)}")
            output.append(f"Price Per Share (Rs): {_num(offer.price_per_share)}")
            output.append(f"Total Issue Size (Lakhs): {_num(offer.total_issue_size_lakhs)}")
            if offer.objects_of_offer:
                output.append(f"Objects of Offer: {offer.objects_of_offer}")
        else:
            output.append("\nOFFER DETAILS: Not yet configured.")
                    
        return "\n".join(output)
    finally:
        db.close()
def get_client_document_context(company_id: str, section_name: str, k: int = 5) -> str:
    """
    Retrieves narrative context from documents uploaded by the active client company.
    Queries the 'client_documents' ChromaDB collection, filtered by company_id and
    optionally by the DRHP section the chunks were mapped to.

    This is the critical bridge between uploaded documents (raw PDFs, financials, 
    contracts) and the AI drafting pipeline. Without this, the agent only sees
    structured DB rows and misses all narrative/operational detail.
    """
    if not _retriever or not _embedder:
        return ""

    try:
        # Embed the section query to find the most relevant client chunks
        query = f"Company information relevant to DRHP section: {section_name}"
        query_vectors = _embedder.embed_chunks([query])
        query_dense = query_vectors["dense"][0]

        # Query client_documents with company_id filter
        raw_results = _vector_store.query_dense(
            collection_name=COLLECTION_CLIENT,
            query_dense_vec=query_dense,
            n_results=k,
            where={"company_id": company_id}
        )

        docs = raw_results.get("documents", [[]])[0]
        metadatas = raw_results.get("metadatas", [[]])[0]

        if not docs:
            return ""

        formatted = []
        for doc, meta in zip(docs, metadatas):
            source = meta.get("source_file", "uploaded document")
            section_tag = meta.get("section", "")
            page = meta.get("page", "")
            page_str = f" (p.{page})" if page else ""
            tag = f"[{source}{page_str} → {section_tag}]" if section_tag else f"[{source}{page_str}]"
            formatted.append(f"{tag}\n{doc}")

        return "\n\n---\n\n".join(formatted)

    except Exception as e:
        logger.warning(f"get_client_document_context failed for company {company_id}: {e}")
        return ""
