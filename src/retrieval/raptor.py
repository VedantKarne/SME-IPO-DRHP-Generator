import os
import logging
from typing import List, Dict, Any
from groq import Groq
from dotenv import load_dotenv
import uuid

load_dotenv()
logger = logging.getLogger(__name__)

class RaptorTree:
    def __init__(self, root: Dict[str, Any], level1_nodes: List[Dict[str, Any]], level2_nodes: List[Dict[str, Any]], leaf_nodes: List[Dict[str, Any]]):
        self.root = root
        self.level1_nodes = level1_nodes
        self.level2_nodes = level2_nodes
        self.leaf_nodes = leaf_nodes

    def get_all_nodes(self) -> List[Dict[str, Any]]:
        return [self.root] + self.level1_nodes + self.level2_nodes + self.leaf_nodes

def summarize_with_groq(text: str, level: str) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not found. Using dummy summary.")
        return f"[{level} Summary]: " + text[:50] + "..."

    client = Groq(api_key=api_key)
    prompt = f"Summarize the following regulatory texts into a coherent {level} summary. Keep it concise but ensure key obligations and requirements are preserved.\n\nText:\n{text[:12000]}" # truncate to avoid huge tokens
    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile", # fallback to versatile if instant not available, or use llama-3.1-8b-instant
            messages=[
                {"role": "system", "content": "You are a legal expert summarizing regulatory documents."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1024
        )
        return completion.choices[0].message.content
    except Exception as e:
        logger.error(f"Groq API error: {e}")
        # Try with a smaller model if needed
        return f"[{level} Summary]: " + text[:50] + "..."

def cluster_by_category(regulatory_chunks: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    clusters = {}
    for chunk in regulatory_chunks:
        meta = chunk.get("metadata", {})
        category = meta.get("chapter", meta.get("section_type", "general"))
        if not category:
            category = "general"
        if category not in clusters:
            clusters[category] = []
        clusters[category].append(chunk)
    return clusters

def cluster_by_theme(level2_nodes: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    # Group Level 2 nodes into broader themes. For lite version, just group all into "Core Regulations"
    return {"Core Regulations": level2_nodes}

def build_raptor_tree(regulatory_chunks: List[Dict[str, Any]]) -> RaptorTree:
    """Builds a RAPTOR-lite summary tree from leaf chunks."""
    logger.info("Building RAPTOR tree...")
    
    clusters = cluster_by_category(regulatory_chunks)
    
    level2_nodes = []
    for category, chunks in clusters.items():
        combined_text = "\n\n".join([c.get("text", "") for c in chunks])
        summary = summarize_with_groq(combined_text, level=f"regulation_group ({category})")
        l2_node = {
            "id": f"raptor_l2_{uuid.uuid4().hex[:8]}",
            "text": summary,
            "metadata": {
                "doc_type": "regulation",
                "chunk_level": "raptor_level_2",
                "category": category,
                "parent_id": "root" 
            }
        }
        level2_nodes.append(l2_node)
        
    l2_clusters = cluster_by_theme(level2_nodes)
    level1_nodes = []
    for theme, l2_nodes in l2_clusters.items():
        combined_text = "\n\n".join([n.get("text", "") for n in l2_nodes])
        summary = summarize_with_groq(combined_text, level=f"thematic_category ({theme})")
        l1_node = {
            "id": f"raptor_l1_{uuid.uuid4().hex[:8]}",
            "text": summary,
            "metadata": {
                "doc_type": "regulation",
                "chunk_level": "raptor_level_1",
                "theme": theme,
                "parent_id": "root"
            }
        }
        for n in l2_nodes:
            n["metadata"]["parent_id"] = l1_node["id"]
        level1_nodes.append(l1_node)

    combined_l1 = "\n\n".join([n.get("text", "") for n in level1_nodes])
    root_summary = summarize_with_groq(combined_l1, level="root")
    root_node = {
        "id": "raptor_root",
        "text": root_summary,
        "metadata": {
            "doc_type": "regulation",
            "chunk_level": "raptor_root",
            "parent_id": "none"
        }
    }
    
    logger.info("RAPTOR tree built successfully.")
    return RaptorTree(root_node, level1_nodes, level2_nodes, regulatory_chunks)
