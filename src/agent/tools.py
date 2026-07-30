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

# Initialize retrieval stack (Singleton pattern for agent scope)
try:
    _embedder = BGEM3Embedder(use_fp16=True)
    _vector_store = VectorStore()
    _parent_store = ParentDocStore()
    _reranker = FlashRankReranker()
    _retriever = HybridRetriever(_embedder, _vector_store, _parent_store, _reranker)
except Exception as e:
    logger.error(f"Failed to initialize retrieval stack: {e}")
    _retriever = None

def rag_search(
    query: str,
    corpus: Literal["regulatory", "precedent", "both"] = "both",
    query_type: Literal["compliance", "precedent", "gap"] = "compliance",
    k: int = 5
) -> str:
    """
    Hybrid retrieval from SEBI ICDR regulatory clauses AND/OR real DRHP precedent filings.
    """
    if not _retriever:
        return "ERROR: Retrieval stack not initialized."
        
    results = _retriever.hybrid_retrieve(
        query=query,
        corpus=corpus,
        k=k,
        mode=query_type
    )
    
    formatted_results = []
    for r in results:
        meta = r.get("metadata", {})
        if "regulation" in meta or "chapter" in meta:
            # Regulatory formatting
            reg = meta.get("regulation") or meta.get("regulation_number", "N/A")
            source = meta.get("source_doc", "SEBI_ICDR_Regulations")
            formatted_results.append(f"[{source} | Chapter {meta.get('chapter', 'N/A')} | Reg {reg}]\n{r['text']}")
        else:
            # Precedent formatting
            parts = [str(meta.get('company', '')), str(meta.get('exchange', '')), str(meta.get('year', ''))]
            real_company = " ".join(p for p in parts if p and p.lower() != 'drhp').title().strip()
            if not real_company:
                real_company = meta.get('source_doc', 'Unknown')
            section = meta.get('section', 'N/A')
            formatted_results.append(f"[{real_company} DRHP | Section {section}]\n{r['text']}")
            
    return "\n\n---\n\n".join(formatted_results)

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
                output.append(f"FY{f.fiscal_year}: Rev={f.revenue_lakhs}, EBITDA={f.ebitda_lakhs}, PAT={f.pat_lakhs}, NetWorth={f.net_worth_lakhs}, PaidUpCapital={f.paid_up_capital_lakhs}")
                
        if directors:
            output.append("\nDIRECTORS & KMP:")
            for d in directors:
                litigation = "YES" if d.pending_litigation else "NO"
                output.append(f"- {d.name} ({d.designation}) | DIN: {d.din} | Pending Litigation: {litigation}")
                if d.pending_litigation and d.litigation_details:
                    output.append(f"  Litigation Details: {d.litigation_details}")

        if offer:
            output.append("\nOFFER DETAILS:")
            output.append(f"Total Shares Offered: {offer.total_shares_offered}")
            output.append(f"Price Per Share (Rs): {offer.price_per_share}")
            output.append(f"Total Issue Size (Lakhs): {offer.total_issue_size_lakhs}")
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
