import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from src.api.server import app
from src.extraction.db_session import SessionLocal
from src.extraction.schema import Company

client = TestClient(app)

def test_generation():
    db = SessionLocal()
    company = db.query(Company).filter(Company.name == "Nirmaan Technologies Ltd").first()
    db.close()
    
    if not company:
        print("Company not found.")
        return

    company_id = str(company.id)
    print(f"Using company_id: {company_id}")

    # Fake auth for TestClient (bypass dependency)
    app.dependency_overrides = {}
    from src.api.server import get_current_user
    app.dependency_overrides[get_current_user] = lambda: {"user_id": "vedant@nirmaan.ai", "role": "promoter", "company_id": company_id}

    response = client.post(
        "/api/agent/run",
        json={"company_id": company_id, "section_name": "Risk Factors"}
    )
    
    print(f"Status Code: {response.status_code}")
    print("Response Stream:")
    
    for chunk in response.iter_lines():
        if chunk:
            print(chunk.decode('utf-8'))

if __name__ == "__main__":
    test_generation()
