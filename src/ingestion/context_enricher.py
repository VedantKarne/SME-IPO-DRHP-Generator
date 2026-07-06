from typing import Any, Dict, List

def enrich_chunk_text(text: str, metadata: Dict[str, Any]) -> str:
    """
    Prepends contextual breadcrumbs to the chunk text for improved retrieval.
    
    Args:
        text: The raw chunk text.
        metadata: A dictionary containing contextual information (e.g., company, section, heading_path).
    
    Returns:
        The enriched string.
    """
    breadcrumb_parts = []
    
    if "company" in metadata and metadata["company"]:
        breadcrumb_parts.append(f"Company: {metadata['company']}")
        
    if "exchange" in metadata and metadata["exchange"]:
        breadcrumb_parts.append(f"Exchange: {metadata['exchange']}")
        
    if "year" in metadata and metadata["year"]:
        breadcrumb_parts.append(f"Year: {metadata['year']}")
        
    if "section" in metadata and metadata["section"]:
        breadcrumb_parts.append(f"Section: {metadata['section']}")
        
    # Regulatory specific
    if "chapter" in metadata and metadata["chapter"]:
        breadcrumb_parts.append(f"Chapter {metadata['chapter']}")
        
    if "regulation" in metadata and metadata["regulation"]:
        breadcrumb_parts.append(f"Regulation {metadata['regulation']}")

    # General heading path from Docling
    if "heading_path" in metadata and isinstance(metadata["heading_path"], list) and metadata["heading_path"]:
        path_str = " > ".join(metadata["heading_path"])
        breadcrumb_parts.append(f"Path: {path_str}")
        
    if breadcrumb_parts:
        breadcrumb = "[Context: " + ", ".join(breadcrumb_parts) + ":]\n"
        return breadcrumb + text
        
    return text
