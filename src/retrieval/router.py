import re
import logging
from typing import Literal, Tuple

logger = logging.getLogger(__name__)

class QueryRouter:
    """
    Routes incoming queries to one of 6 strategies based on keywords and patterns.
    This informs the HybridRetriever which mode and corpus to use.
    """
    
    def route(self, query: str) -> Tuple[str, Literal["compliance", "precedent", "gap"], Literal["regulatory", "precedent", "both"]]:
        """
        Returns:
            strategy_name: The name of the routing strategy
            retriever_mode: Weight profile to use (compliance, precedent, gap)
            corpus: Which database collections to query
        """
        query_lower = query.lower()
        
        # 1. Eligibility Check
        if any(kw in query_lower for kw in ["eligible", "qualify", "ebitda threshold", "net worth", "track record", "eligibility"]):
            logger.info("Routing strategy: eligibility_check")
            return ("eligibility_check", "compliance", "regulatory")
            
        # 2. Compliance Check
        if re.search(r"reg(ulation)?\s*\d+", query_lower) or any(kw in query_lower for kw in ["must disclose", "required by", "icdr"]):
            logger.info("Routing strategy: compliance_check")
            return ("compliance_check", "compliance", "regulatory")
            
        # 4. Precedent Lookup
        if any(kw in query_lower for kw in ["how to phrase", "example", "how did others", "show me a drhp", "precedent"]):
            logger.info("Routing strategy: precedent_lookup")
            return ("precedent_lookup", "precedent", "precedent")
            
        # 5. Gap Detection
        if any(kw in query_lower for kw in ["what's missing", "completeness", "gap", "evaluate", "missing"]):
            logger.info("Routing strategy: gap_detection")
            return ("gap_detection", "gap", "both")
            
        # 6. Promoter Query
        if any(kw in query_lower for kw in ["our company", "we have", "my revenue", "promoter"]):
            logger.info("Routing strategy: promoter_query (Note: should route to Postgres in full pipeline)")
            return ("promoter_query", "compliance", "both")
            
        # 3. Section Draft (Default fallback for broad queries)
        logger.info("Routing strategy: section_draft (fallback)")
        return ("section_draft", "compliance", "both")
