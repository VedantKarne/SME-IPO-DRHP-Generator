from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import uuid

from src.extraction.schema import Company, CompanyUser, ProjectMember, ProjectInvitation
from src.api.auth_router import get_current_user, require_company_access
from src.api.server import get_db

router = APIRouter(tags=["Project Members & Invitations"])

class InviteRequest(BaseModel):
    nirmaan_id: str
    role: str
    permission: str

class InviteResponse(BaseModel):
    id: str
    invited_user_id: str
    role: str
    status: str

@router.get("/api/project/{project_id}/members")
def get_project_members(project_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_company_access(current_user, project_id, db)

    # Check if the user is owner/promoter (only promoters can see this list usually, but let's allow any member to see who else is in)
    members = db.query(ProjectMember).filter(ProjectMember.company_id == uuid.UUID(project_id)).all()
    invitations = db.query(ProjectInvitation).filter(ProjectInvitation.company_id == uuid.UUID(project_id), ProjectInvitation.status == 'pending').all()

    # We also include the owner explicitly if they aren't in members table
    owner = db.query(CompanyUser).filter(CompanyUser.company_id == uuid.UUID(project_id), CompanyUser.role == 'promoter').first()

    result = []
    if owner:
        result.append({
            "id": str(owner.id),
            "name": owner.email.split('@')[0],
            "nirmaan_id": owner.nirmaan_id,
            "role": owner.role,
            "status": "active",
            "is_owner": True
        })

    for m in members:
        result.append({
            "id": str(m.user_id),
            "name": m.user.email.split('@')[0] if m.user else "Unknown",
            "nirmaan_id": m.user.nirmaan_id if m.user else "",
            "role": m.role,
            "status": m.status,
            "permission": m.permission
        })

    for i in invitations:
        result.append({
            "id": str(i.invited_user_id),
            "invitation_id": str(i.id),
            "name": i.invited_user.email.split('@')[0] if i.invited_user else "Unknown",
            "nirmaan_id": i.invited_user.nirmaan_id if i.invited_user else "",
            "role": i.role,
            "status": "pending",
            "permission": i.permission
        })

    return result

@router.get("/api/users/lookup/{nirmaan_id}")
def lookup_user(nirmaan_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user = db.query(CompanyUser).filter(CompanyUser.nirmaan_id == nirmaan_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Return non-sensitive info
    return {
        "id": str(user.id),
        "name": user.email.split('@')[0],
        "nirmaan_id": user.nirmaan_id,
        "role": user.role,
        "organization": user.company.name if user.company else "Independent"
    }

@router.post("/api/project/{project_id}/invitations")
def invite_member(project_id: str, request: InviteRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_company_access(current_user, project_id, db)

    # Must be promoter to invite
    if current_user.get("role") != "promoter":
        raise HTTPException(status_code=403, detail="Only promoters can invite members")

    user_to_invite = db.query(CompanyUser).filter(CompanyUser.nirmaan_id == request.nirmaan_id).first()
    if not user_to_invite:
        raise HTTPException(status_code=404, detail="User not found")

    if user_to_invite.role != request.role:
        raise HTTPException(status_code=400, detail=f"This Nirmaan ID belongs to a {user_to_invite.role}. Please select the registered role.")

    # Check if already a member
    existing_member = db.query(ProjectMember).filter(ProjectMember.company_id == uuid.UUID(project_id), ProjectMember.user_id == user_to_invite.id).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="User is already a member of this project")

    # Check if already invited
    existing_invite = db.query(ProjectInvitation).filter(ProjectInvitation.company_id == uuid.UUID(project_id), ProjectInvitation.invited_user_id == user_to_invite.id, ProjectInvitation.status == 'pending').first()
    if existing_invite:
        raise HTTPException(status_code=400, detail="User is already invited")

    invitation = ProjectInvitation(
        company_id=uuid.UUID(project_id),
        invited_user_id=user_to_invite.id,
        invited_by=uuid.UUID(str(current_user.get("sub"))),
        role=request.role,
        permission=request.permission
    )

    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    return {"message": "Invitation sent successfully"}

@router.delete("/api/project/{project_id}/members/{user_id}")
def remove_member(project_id: str, user_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_company_access(current_user, project_id, db)
    if current_user.get("role") != "promoter":
        raise HTTPException(status_code=403, detail="Only promoters can remove members")

    member = db.query(ProjectMember).filter(ProjectMember.company_id == uuid.UUID(project_id), ProjectMember.user_id == uuid.UUID(user_id)).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(member)
    db.commit()
    return {"message": "Member removed"}

@router.post("/api/invitations/{invitation_id}/revoke")
def revoke_invitation(invitation_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    invitation = db.query(ProjectInvitation).filter(ProjectInvitation.id == uuid.UUID(invitation_id)).first()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    require_company_access(current_user, str(invitation.company_id), db)
    if current_user.get("role") != "promoter":
        raise HTTPException(status_code=403, detail="Only promoters can revoke invitations")

    invitation.status = "revoked"
    db.commit()
    return {"message": "Invitation revoked"}

@router.get("/api/user/invitations")
def get_my_invitations(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    invitations = db.query(ProjectInvitation).filter(ProjectInvitation.invited_user_id == uuid.UUID(user_id), ProjectInvitation.status == 'pending').all()

    return [
        {
            "id": str(i.id),
            "company_name": i.company.name if i.company else "Unknown",
            "company_id": str(i.company_id),
            "invited_by_name": i.inviter.email.split('@')[0] if i.inviter else "Unknown",
            "role": i.role,
            "permission": i.permission,
            "created_at": i.created_at
        }
        for i in invitations
    ]

@router.post("/api/invitations/{invitation_id}/accept")
def accept_invitation(invitation_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    invitation = db.query(ProjectInvitation).filter(
        ProjectInvitation.id == uuid.UUID(invitation_id),
        ProjectInvitation.invited_user_id == uuid.UUID(user_id),
        ProjectInvitation.status == 'pending'
    ).first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or no longer pending")

    invitation.status = "accepted"

    # Create project member
    member = ProjectMember(
        company_id=invitation.company_id,
        user_id=invitation.invited_user_id,
        role=invitation.role,
        permission=invitation.permission
    )
    db.add(member)
    db.commit()

    return {"message": "Invitation accepted"}

@router.post("/api/invitations/{invitation_id}/decline")
def decline_invitation(invitation_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    invitation = db.query(ProjectInvitation).filter(
        ProjectInvitation.id == uuid.UUID(invitation_id),
        ProjectInvitation.invited_user_id == uuid.UUID(user_id),
        ProjectInvitation.status == 'pending'
    ).first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found or no longer pending")

    invitation.status = "declined"
    db.commit()

    return {"message": "Invitation declined"}

@router.get("/api/user/projects")
def get_my_projects(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("sub")
    user_uuid = uuid.UUID(user_id)

    projects = []

    # Owned projects
    owned_companies = db.query(Company).join(CompanyUser).filter(CompanyUser.id == user_uuid).all()
    for c in owned_companies:
        projects.append({
            "id": str(c.id),
            "name": c.name,
            "role": "Owner/Promoter",
            "permission": "admin"
        })

    # Member projects
    memberships = db.query(ProjectMember).filter(ProjectMember.user_id == user_uuid, ProjectMember.status == 'active').all()
    for m in memberships:
        if m.company:
            projects.append({
                "id": str(m.company.id),
                "name": m.company.name,
                "role": m.role,
                "permission": m.permission
            })

    return projects
