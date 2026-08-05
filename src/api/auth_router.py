from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import jwt
import bcrypt
import os
import uuid
from dotenv import load_dotenv

from src.extraction.db_session import SessionLocal
from src.extraction.schema import Company, CompanyUser

router = APIRouter()

# Password hashing
# using bcrypt directly to avoid passlib bugs with bcrypt>=4.0.0

# JWT config
# Load .env here rather than relying on some other module having imported first.
# Only src/agent/groq_client.py called load_dotenv(), so whether JWT_SECRET_KEY
# was visible depended on import order.
load_dotenv()

# No default. This module previously fell back to a literal secret committed to
# git, and since JWT_SECRET_KEY was never set anywhere, that public value was
# what actually signed every token — anyone with the repo could mint a valid
# session for any company. Fail at import rather than start up insecure.
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY is not set. Generate one with:\n"
        "    python -c \"import secrets; print(secrets.token_hex(32))\"\n"
        "and add it to your .env file (see .env.example)."
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        company_id: str = payload.get("company_id")
        if company_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_company_access(current_user: dict, company_id) -> str:
    """
    Assert the authenticated caller owns `company_id`, and return it as a string.

    Authentication alone is not enough for this application: a token is scoped
    to one company, and every company's DRHP is confidential to it. Without
    this check any logged-in user could read or mutate another company's
    sections, drafts, approvals and exports.

    Raises 403 on mismatch. Mirrors the check already used in
    document_upload_router.
    """
    company_id_str = str(company_id)
    if str(current_user.get("company_id")) != company_id_str:
        raise HTTPException(status_code=403, detail="Not authorized for this company")
    return company_id_str


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

class RegisterRequest(BaseModel):
    company_name: str
    cin: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/api/auth/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    # Check if email exists
    existing_user = db.query(CompanyUser).filter(CompanyUser.email == request.email).first()
    if existing_user:
        raise HTTPException(status_code=422, detail="Email already registered")
        
    # Check if CIN exists
    existing_company = db.query(Company).filter(Company.cin == request.cin).first()
    if existing_company:
        raise HTTPException(status_code=422, detail="Company with this CIN already registered")
        
    # Create Company
    company = Company(
        name=request.company_name,
        cin=request.cin,
        source="auth_registration"
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    
    # Create User
    hashed_pwd = bcrypt.hashpw(request.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = CompanyUser(
        company_id=company.id,
        email=request.email,
        hashed_password=hashed_pwd,
        role="promoter"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Generate Token
    token = create_access_token(
        data={
            "sub": str(user.id),
            "company_id": str(company.id),
            "company_name": company.name,
            "role": user.role
        },
        expires_delta=timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    )
    
    return {"access_token": token, "token_type": "bearer"}

@router.post("/api/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(CompanyUser).filter(CompanyUser.email == request.email).first()
    
    if not user or not bcrypt.checkpw(request.password.encode('utf-8'), user.hashed_password.encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    company = user.company
    
    token = create_access_token(
        data={
            "sub": str(user.id),
            "company_id": str(company.id),
            "company_name": company.name,
            "role": user.role
        },
        expires_delta=timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    )
    
    return {"access_token": token, "token_type": "bearer"}
