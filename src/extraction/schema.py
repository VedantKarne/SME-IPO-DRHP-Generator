from sqlalchemy import Column, String, Date, Numeric, Boolean, Integer, Float, Text, ForeignKey, text, DateTime, JSON
from sqlalchemy import Uuid as UUID
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class Company(Base):
    __tablename__ = 'company'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cin = Column(String(21), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    incorporation_date = Column(Date)
    registered_office = Column(Text)
    business_activity_nic = Column(String(10))
    dynamic_checklist = Column(JSON) # Factory License vs Startup Cert
    source = Column(String(20), default='promoter_input')

    financials = relationship("FinancialStatement", back_populates="company", cascade="all, delete-orphan")
    directors = relationship("DirectorKMP", back_populates="company", cascade="all, delete-orphan")
    offers = relationship("OfferDetails", back_populates="company", cascade="all, delete-orphan")
    sections = relationship("GeneratedSection", back_populates="company", cascade="all, delete-orphan")
    readiness_scores = relationship("ReadinessScore", back_populates="company", cascade="all, delete-orphan")


class ReadinessScore(Base):
    __tablename__ = 'readiness_score'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('company.id', ondelete='CASCADE'))
    overall_score = Column(Integer)
    documents_score = Column(Integer)
    financials_score = Column(Integer)
    compliance_score = Column(Integer)
    legal_score = Column(Integer)
    risk_score = Column(Integer)
    next_action = Column(Text)

    company = relationship("Company", back_populates="readiness_scores")


class FinancialStatement(Base):
    __tablename__ = 'financial_statement'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('company.id', ondelete='CASCADE'))
    fiscal_year = Column(Integer, nullable=False)
    revenue_lakhs = Column(Numeric)
    ebitda_lakhs = Column(Numeric)
    pat_lakhs = Column(Numeric)
    net_worth_lakhs = Column(Numeric)
    paid_up_capital_lakhs = Column(Numeric)
    source = Column(String(20), default='promoter_input')

    company = relationship("Company", back_populates="financials")


class DirectorKMP(Base):
    __tablename__ = 'director_kmp'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('company.id', ondelete='CASCADE'))
    name = Column(String(255))
    din = Column(String(8))
    designation = Column(String(100))
    past_conviction = Column(Boolean, default=False)
    pending_litigation = Column(Boolean, default=False)
    litigation_details = Column(Text)

    company = relationship("Company", back_populates="directors")


class OfferDetails(Base):
    __tablename__ = 'offer_details'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('company.id', ondelete='CASCADE'))
    total_shares_offered = Column(Numeric) # Can be large
    price_per_share = Column(Numeric)
    total_issue_size_lakhs = Column(Numeric)
    objects_of_offer = Column(JSON)

    company = relationship("Company", back_populates="offers")


class GeneratedSection(Base):
    __tablename__ = 'generated_section'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey('company.id'))
    section_name = Column(String(100))
    draft_text = Column(Text)
    supporting_clause_ids = Column(JSON)
    precedent_chunk_ids = Column(JSON)
    completeness_score = Column(Float)
    flagged_gaps = Column(JSON)
    status = Column(String(30), default='draft') # draft | promoter_reviewed | intermediary_certified
    is_locked = Column(Boolean, default=False)
    # Bug 1 Fix: Store the LangGraph thread_id so the HITL resume endpoint can look it up.
    langgraph_thread_id = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="sections")
    messages = relationship("ChatMessage", back_populates="section", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = 'chat_message'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id = Column(UUID(as_uuid=True), ForeignKey('generated_section.id', ondelete='CASCADE'))
    role = Column(String(10)) # 'user' | 'assistant'
    content = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    section = relationship("GeneratedSection", back_populates="messages")


class AuditLog(Base):
    __tablename__ = 'audit_log'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(50))
    company_id = Column(UUID(as_uuid=True))
    section_name = Column(String(100))
    query = Column(Text)
    retrieved_clause_ids = Column(JSON)
    retrieved_chunk_ids = Column(JSON)
    source_file = Column(Text)
    page_num = Column(Integer)
    confidence = Column(Float)
    model_used = Column(String(100))
    latency_ms = Column(Integer)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
