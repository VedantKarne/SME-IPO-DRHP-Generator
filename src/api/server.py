from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.extraction.schema import Base
from src.api import wizard

# Setup DB Engine (using SQLite for local testing before PostgreSQL)
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_wizard.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="SME IPO Offer Document Generator API")

# Dependency override for router
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Override the get_db dependency in the wizard router
app.dependency_overrides[wizard.get_db] = get_db
app.include_router(wizard.router)

from src.api.chat_edit_router import router as chat_edit_router
from src.api.locking_router import router as locking_router
from src.api.impact_router import router as impact_router
from src.api.copilot_router import router as copilot_router

app.include_router(chat_edit_router)
app.include_router(locking_router)
app.include_router(impact_router)
app.include_router(copilot_router)

@app.get("/")
def read_root():
    return {"message": "SME IPO Wizard API is running"}
