import sys
import os

# Reconfigure stdout to utf-8 to prevent Windows console encoding crashes (e.g. Rupee symbol)
sys.stdout.reconfigure(encoding='utf-8')

# Add the project root to sys.path so we can run this from anywhere
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.retrieval.bge_m3_embedder import BGEM3Embedder
from src.retrieval.vector_store import VectorStore
from src.retrieval.hybrid_search import HybridSearcher

def main():
    if len(sys.argv) < 2:
        print('Usage: python manual_search.py "Your custom query here"')
        sys.exit(1)
        
    query = sys.argv[1]
    
    print("Loading models and connecting to ChromaDB... (this may take a few seconds)")
    embedder = BGEM3Embedder()
    vector_store = VectorStore()
    searcher = HybridSearcher(embedder, vector_store)
    
    print(f"\n" + "="*60)
    print(f"SEARCHING FOR: '{query}'")
    print("="*60 + "\n")
    
    collections = ["regulatory_clauses", "precedent_chunks"]
    
    for collection in collections:
        print(f"=== TOP 3 RESULTS FROM '{collection.upper()}' ===\n")
        try:
            results = searcher.search(collection_name=collection, query_text=query, top_k=3)
            
            if not results:
                print("   No results found.\n")
                continue
                
            for i, res in enumerate(results, 1):
                score = res.get('rrf_score', 0)
                metadata = res.get('metadata', {})
                text = res.get('text', '')
                
                print(f"Result #{i} | RRF Score: {score:.4f}")
                
                if collection == "regulatory_clauses":
                    reg = metadata.get('regulation') or metadata.get('regulation_number', 'N/A')
                    source = metadata.get('source_doc', 'SEBI_ICDR_Regulations')
                    print(f"Source: {source} | Chapter: {metadata.get('chapter', 'N/A')} | Reg: {reg}")
                else:
                    # The ingestion script incorrectly split filenames (e.g. drhp_inovision_ltd)
                    # into company="drhp", exchange="inovision", year="ltd".
                    # We will reconstruct the true company name here for clean display!
                    parts = [str(metadata.get('company', '')), str(metadata.get('exchange', '')), str(metadata.get('year', ''))]
                    real_company = " ".join(p for p in parts if p and p.lower() != 'drhp').title().strip()
                    if not real_company:
                        real_company = metadata.get('source_doc', 'Unknown')
                        
                    section = metadata.get('section') or 'N/A'
                    print(f"Source: {real_company} | Section: {section}")
                    
                print("-" * 50)
                # Print a clean snippet of the text
                print(f"{text[:400]}..." if len(text) > 400 else text)
                print("-" * 50 + "\n")
                
        except Exception as e:
            print(f"Error querying {collection}: {e}\n")

if __name__ == "__main__":
    main()
