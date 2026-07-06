from typing import Optional, Literal
from pydantic import BaseModel, Field

class ChunkMetadataBase(BaseModel):
    doc_type: Literal["regulation", "precedent"]
    parent_id: str

class ICDRChunkMetadata(ChunkMetadataBase):
    doc_type: Literal["regulation"] = "regulation"
    source: str = "ICDR"
    regulation_no: Optional[str] = None
    chapter: Optional[str] = None
    section_type: Optional[str] = None
    chunk_level: Literal["chapter", "regulation", "clause"]
    source_url: Optional[str] = None

class PrecedentChunkMetadata(ChunkMetadataBase):
    doc_type: Literal["precedent"] = "precedent"
    company: str
    issuer_type: Literal["SME", "MAIN_BOARD"] = "SME"
    exchange: Literal["NSE_EMERGE", "BSE_SME"]
    section: str
    year: int
