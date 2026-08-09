from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import jwt
from typing import Optional
import bcrypt
import os
import uuid
from dotenv import load_dotenv

from src.extraction.db_session import SessionLocal
from src.extraction.schema import Company, CompanyUser, ProjectMember
import random
import string

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

def require_company_access(current_user: dict, company_id, db: Session = None) -> str:
    """
    Assert the authenticated caller owns `company_id`, or is a member of the project.
    Returns it as a string.
    """
    import uuid
    try:
        req_comp_uuid = uuid.UUID(str(company_id))
        user_comp_uuid = uuid.UUID(str(current_user.get("company_id")))
    except (ValueError, TypeError):
        raise HTTPException(status_code=403, detail="Invalid company ID format")

    if req_comp_uuid != user_comp_uuid:
        close_db = False
        if db is None:
            db = SessionLocal()
            close_db = True
            
        try:
            is_member = db.query(ProjectMember).filter(
                ProjectMember.user_id == uuid.UUID(str(current_user.get("sub"))),
                ProjectMember.company_id == req_comp_uuid,
                ProjectMember.status == 'active'
            ).first()
            if is_member:
                return str(req_comp_uuid)
        finally:
            if close_db:
                db.close()
                
        raise HTTPException(status_code=403, detail="Not authorized for this company")
    return str(req_comp_uuid)


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
    # Optional — omitted entirely by the existing Founder/Promoter sign-up
    # form, which keeps that flow byte-identical to before. Only an
    # explicit, allowlisted value changes the created user's role; anything
    # else (missing, unrecognized) falls back to the original "promoter"
    # default. 'merchant_banker' / 'admin' are deliberately not
    # self-registerable here — unchanged from current behavior.
    role: Optional[str] = None

SELF_REGISTERABLE_ROLES = {"finance_ca", "admin"}

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
    assigned_role = request.role if request.role in SELF_REGISTERABLE_ROLES else "promoter"
    
    # Generate unique Nirmaan ID
    prefix = "".join([word[0].upper() for word in assigned_role.split('_')][:2])
    if not prefix: prefix = "PR"
    suffix = ''.join(random.choices(string.digits, k=5))
    nirmaan_id = f"{prefix}-{suffix}"
    
    user = CompanyUser(
        company_id=company.id,
        email=request.email,
        hashed_password=hashed_pwd,
        role=assigned_role,
        nirmaan_id=nirmaan_id
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
            "role": user.role,
            "email": user.email,
            "nirmaan_id": user.nirmaan_id
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
            "role": user.role,
            "email": user.email,
            "nirmaan_id": user.nirmaan_id
        },
        expires_delta=timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    )
    
    return {"access_token": token, "token_type": "bearer"}

@router.get("/api/auth/me")
def get_me(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    import uuid
    user = db.query(CompanyUser).filter(CompanyUser.id == uuid.UUID(str(user_id))).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return {
        "id": str(user.id),
        "email": user.email,
        "nirmaan_id": user.nirmaan_id,
        "role": user.role,
        "company_id": str(user.company_id),
        "company_name": user.company.name if user.company else None
    }
