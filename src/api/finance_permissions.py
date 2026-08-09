"""
src/api/finance_permissions.py

Single centralized module for the Finance/CA role's server-side permission
rules. Every Finance/CA-only endpoint (see finance_router.py) imports its
checks from here rather than re-implementing role/section logic inline, so
the full set of "what can Finance/CA actually do" rules is auditable in one
place and easy to extend when Merchant Banker / Legal roles get their own
backend enforcement later.

This module does NOT touch src/extraction/kpi_extractor.py or change what
gets extracted — it only gates who may read/correct/verify/approve the
extraction output already sitting in the database (FinancialStatement,
FinancialTable, GeneratedSection), and it does not alter any existing
endpoint's behavior for other roles (auth_router.py's default role, and
locking_router.py's /approve endpoint, are both untouched).
"""
from fastapi import HTTPException

# DRHP sections a Finance/CA user may comment on, request clarification on,
# or finance-verify. Deliberately a *separate* list from
# server.py's compute_readiness() "financial_sections" category (used for the
# Founder dashboard's Financials sub-score) — reusing that list here would
# mean any future edit to Finance/CA's approvable sections silently changes
# a number on the Founder's dashboard, which is exactly the kind of
# cross-role behavior change this task must not introduce.
FINANCE_APPROVABLE_SECTIONS = [
    "Capital Structure",
    "Objects of the Offer",
    "Statement of Tax Benefits",
    "Dividend Policy",
    "Financial Statements (3 Years)",
    "Management Discussion & Analysis",
]


def is_finance_approvable_section(section_name: str) -> bool:
    return section_name in FINANCE_APPROVABLE_SECTIONS


def require_finance_ca(current_user: dict) -> None:
    """Raise 403 unless the authenticated user's JWT role is 'finance_ca'."""
    if current_user.get("role") != "finance_ca":
        raise HTTPException(
            status_code=403,
            detail="This action is only available to the Finance/CA role.",
        )


def require_financial_section(section_name: str) -> None:
    """Raise 403 if `section_name` is not one Finance/CA may act on.

    Covers the "cannot approve legal sections" / "cannot finalize the
    entire DRHP" rules — Finance/CA's write actions on GeneratedSection are
    only ever reachable for names in FINANCE_APPROVABLE_SECTIONS.
    """
    if not is_finance_approvable_section(section_name):
        raise HTTPException(
            status_code=403,
            detail=(
                f"'{section_name}' is not a financial section. "
                "Finance/CA can only act on financial-related sections."
            ),
        )


def require_not_locked(section) -> None:
    """Raise 403 if the section is already locked/certified.

    Covers "cannot unlock or modify sections already locked/certified by a
    Merchant Banker" — Finance/CA's endpoints never set is_locked, and must
    never act on a section that already has it set.
    """
    if section.is_locked:
        raise HTTPException(
            status_code=403,
            detail=(
                "This section is already certified and locked by the "
                "Merchant Banker; Finance/CA cannot modify it."
            ),
        )


def require_admin(current_user: dict) -> None:
    """Raise 403 unless the authenticated user's JWT role is 'admin'."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="This action is only available to the System Admin role.",
        )


def require_not_admin_restricted_action(current_user: dict, action_name: str = "this action") -> None:
    """Raise 403 if System Admin attempts a restricted DRHP section action.

    Admin CANNOT: edit DRHP content, approve sections, override legal decisions,
    or change company information. Enforced centrally so restricted actions are
    strictly blocked at API level.
    """
    if current_user.get("role") == "admin":
        raise HTTPException(
            status_code=403,
            detail=(
                f"System Admin is restricted from performing {action_name}. "
                "Admins can manage platform access, users, projects, and rules, "
                "but cannot edit DRHP content, approve sections, or alter company data."
            ),
        )

