import sys
import os

# Add project root to sys.path so 'src' can be resolved
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(PROJECT_ROOT)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.extraction.schema import GeneratedSection
from src.agent.gap_detector import flag_gaps

db_path = os.path.join(PROJECT_ROOT, "test_wizard.db")
engine = create_engine(f"sqlite:///{db_path}")
SessionLocal = sessionmaker(bind=engine)

def reparse():
    db = SessionLocal()
    # ONLY reparse Cover Page so we don't wipe out the seeded mock gaps
    sections = db.query(GeneratedSection).filter(GeneratedSection.section_name == 'Cover Page & General Information').all()
    count = 0
    for sec in sections:
        if sec.draft_text:
            score, gaps = flag_gaps(sec.section_name, sec.draft_text)
            gap_dicts = [{"clause_id": g.clause_id, "description": g.description, "is_critical": g.is_critical} for g in gaps]
            
            sec.completeness_score = score
            sec.flagged_gaps = gap_dicts
            count += 1
            
    db.commit()
    db.close()
    print(f"Successfully reparsed gaps for {count} sections.")

if __name__ == "__main__":
    reparse()
