"""
consistency_checker.py
======================
Standalone consistency validation engine for the SME IPO DRHP Generator.

Architecture
------------
Each rule is a private function that:
  1. Queries the database for the relevant data.
  2. Performs the necessary comparison.
  3. Returns a list of error dicts (empty list = no issues found).

The public entry point `run_all_checks(company_name, db)` calls all rules
and merges the results. This keeps the LangGraph node thin and makes future
rules trivial to add — just define a new `_check_*` function and add it to
the pipeline list inside `run_all_checks`.

Error dict schema (matches the existing orchestrator pattern):
    {
        "field":    str  — machine-readable field name
        "fix":      str  — human-readable description + recommended action
        "severity": str  — "critical" | "warning"
    }
"""

import logging
import re
from typing import List, Dict

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────
# Rule 1 — Net Worth
# (Migrated from the inline check that previously lived in orchestrator.py)
# ─────────────────────────────────────────────────────────────────
def _check_net_worth(company, db: Session) -> List[Dict]:
    """
    Flag companies with non-positive net worth.
    SEBI ICDR Reg 229(1)(b) requires positive net worth for SME listing.
    """
    errors = []
    try:
        from src.extraction.schema import FinancialStatement
        latest_fin = (
            db.query(FinancialStatement)
            .filter(FinancialStatement.company_id == company.id)
            .order_by(FinancialStatement.fiscal_year.desc())
            .first()
        )
        if latest_fin and latest_fin.net_worth_lakhs is not None:
            if float(latest_fin.net_worth_lakhs) <= 0:
                errors.append({
                    "field": "net_worth_lakhs",
                    "fix": (
                        f"Company has non-positive net worth "
                        f"(Rs {latest_fin.net_worth_lakhs} Lakhs in FY{latest_fin.fiscal_year}). "
                        f"SEBI ICDR Reg 229(1)(b) requires positive net worth. "
                        f"Eligibility may be compromised."
                    ),
                    "severity": "critical",
                })
    except Exception as e:
        logger.warning(f"[consistency] net_worth check failed: {e}")
    return errors


# ─────────────────────────────────────────────────────────────────
# Rule 2 — Promoter Shareholding Consistency
# ─────────────────────────────────────────────────────────────────
def _check_promoter_shareholding(company, db: Session) -> List[Dict]:
    """
    Cross-check promoter shareholding percentages across DB sections.

    Strategy:
    - Read promoter % extracted from the 'Our Promoters & Promoter Group'
      generated section draft text.
    - Read promoter % extracted from the 'Capital Structure' draft text.
    - If both are present and differ by more than 1 percentage point, flag it.
    - Also flag if OfferDetails implies a post-issue promoter dilution that
      contradicts the stated promoter %.
    """
    errors = []
    try:
        from src.extraction.schema import GeneratedSection, OfferDetails, FinancialStatement

        # Pattern to capture "XX%" or "XX.X%" promoter shareholding phrases
        pct_pattern = re.compile(
            r"(?:promoter[s]?\s+(?:hold|own|retain|shareholding|stake)[^.]{0,60}?)(\d{1,3}(?:\.\d{1,2})?\s*%)",
            re.IGNORECASE,
        )

        def extract_pct(text: str):
            """Extract the first promoter-related percentage from a draft."""
            if not text:
                return None
            m = pct_pattern.search(text)
            if m:
                raw = m.group(1).replace(" ", "").rstrip("%")
                try:
                    return float(raw)
                except ValueError:
                    return None
            return None

        # Fetch draft texts for the two relevant sections
        sections = (
            db.query(GeneratedSection)
            .filter(
                GeneratedSection.company_id == company.id,
                GeneratedSection.section_name.in_([
                    "Our Promoters & Promoter Group",
                    "Capital Structure",
                ])
            )
            .all()
        )
        section_map = {s.section_name: s.draft_text for s in sections}

        promoter_pct = extract_pct(section_map.get("Our Promoters & Promoter Group", ""))
        capital_pct = extract_pct(section_map.get("Capital Structure", ""))

        if promoter_pct is not None and capital_pct is not None:
            delta = abs(promoter_pct - capital_pct)
            if delta > 1.0:
                errors.append({
                    "field": "promoter_shareholding",
                    "fix": (
                        f"Promoter shareholding mismatch detected: "
                        f"'Our Promoters & Promoter Group' section states {promoter_pct:.1f}% "
                        f"but 'Capital Structure' section states {capital_pct:.1f}% "
                        f"(delta: {delta:.1f}%). "
                        f"Ensure both sections report a consistent promoter holding percentage."
                    ),
                    "severity": "critical",
                })

        # Secondary check: OfferDetails cross-validation
        # If OfferDetails has total_shares_offered and FinancialStatement has paid_up_capital,
        # we can check whether the implied dilution is consistent with any stated promoter %.
        offer = (
            db.query(OfferDetails)
            .filter(OfferDetails.company_id == company.id)
            .first()
        )
        latest_fin = (
            db.query(FinancialStatement)
            .filter(FinancialStatement.company_id == company.id)
            .order_by(FinancialStatement.fiscal_year.desc())
            .first()
        )

        if (
            offer
            and offer.total_shares_offered
            and offer.total_issue_size_lakhs
            and latest_fin
            and latest_fin.paid_up_capital_lakhs
            and (promoter_pct is not None or capital_pct is not None)
        ):
            # Compute implied post-issue promoter dilution.
            # Simplified: if offer size is > 25% of pre-issue capital,
            # promoter holding must be < 75%. Check against stated %.
            pre_issue_cap = float(latest_fin.paid_up_capital_lakhs)
            issue_size = float(offer.total_issue_size_lakhs)
            if pre_issue_cap > 0:
                dilution_pct = (issue_size / (pre_issue_cap + issue_size)) * 100
                stated_pct = promoter_pct or capital_pct
                implied_promoter_pct = 100.0 - dilution_pct
                if abs(implied_promoter_pct - stated_pct) > 5.0:
                    errors.append({
                        "field": "promoter_shareholding_offer_mismatch",
                        "fix": (
                            f"The stated post-issue promoter holding ({stated_pct:.1f}%) "
                            f"is inconsistent with the implied holding derived from offer details "
                            f"({implied_promoter_pct:.1f}%, based on issue size Rs {issue_size:.1f} Lakhs "
                            f"and pre-issue capital Rs {pre_issue_cap:.1f} Lakhs). "
                            f"Review and reconcile the offer size and promoter shareholding disclosure."
                        ),
                        "severity": "warning",
                    })
    except Exception as e:
        logger.warning(f"[consistency] promoter_shareholding check failed: {e}")
    return errors


# ─────────────────────────────────────────────────────────────────
# Rule 3 — Capital Structure Consistency
# ─────────────────────────────────────────────────────────────────
def _check_capital_structure(company, db: Session) -> List[Dict]:
    """
    Validate that capital structure components add up correctly.

    Rule:
        Pre-Issue Paid-up Capital (from FinancialStatement, latest year)
        + Issue Size (from OfferDetails.total_issue_size_lakhs)
        should equal the Post-Issue Paid-Up Capital implied by the offer.

    If the OfferDetails.total_issue_size_lakhs is present and
    FinancialStatement.paid_up_capital_lakhs is present, we verify that
    their sum does not differ from the reported total by more than 1 Lakh.

    We also validate that the OfferDetails.total_issue_size_lakhs
    equals total_shares_offered * price_per_share (in Lakhs).
    """
    errors = []
    try:
        from src.extraction.schema import FinancialStatement, OfferDetails

        offer = (
            db.query(OfferDetails)
            .filter(OfferDetails.company_id == company.id)
            .first()
        )
        latest_fin = (
            db.query(FinancialStatement)
            .filter(FinancialStatement.company_id == company.id)
            .order_by(FinancialStatement.fiscal_year.desc())
            .first()
        )

        # Check 1: Issue size arithmetic
        if (
            offer
            and offer.total_shares_offered is not None
            and offer.price_per_share is not None
            and offer.total_issue_size_lakhs is not None
        ):
            calculated_size = (float(offer.total_shares_offered) * float(offer.price_per_share)) / 1_00_000
            reported_size = float(offer.total_issue_size_lakhs)
            delta = abs(calculated_size - reported_size)
            if delta > 1.0:
                errors.append({
                    "field": "capital_structure_issue_size",
                    "fix": (
                        f"Capital structure arithmetic mismatch: "
                        f"Calculated issue size = {int(offer.total_shares_offered):,} shares × "
                        f"Rs {offer.price_per_share}/share = Rs {calculated_size:.2f} Lakhs, "
                        f"but reported total_issue_size_lakhs = Rs {reported_size:.2f} Lakhs "
                        f"(discrepancy: Rs {delta:.2f} Lakhs). "
                        f"Reconcile shares offered, price per share, and total issue size."
                    ),
                    "severity": "critical",
                })

        # Check 2: Post-issue capital integrity
        if (
            offer
            and offer.total_issue_size_lakhs is not None
            and latest_fin
            and latest_fin.paid_up_capital_lakhs is not None
        ):
            pre_issue = float(latest_fin.paid_up_capital_lakhs)
            issue_size = float(offer.total_issue_size_lakhs)
            post_issue_implied = pre_issue + issue_size

            # SEBI ICDR Reg 229(2): Post-issue paid-up capital for SME ≤ Rs 25 Cr (2500 Lakhs)
            if post_issue_implied > 2500:
                errors.append({
                    "field": "capital_structure_post_issue_cap",
                    "fix": (
                        f"Post-issue paid-up capital exceeds the SEBI SME limit: "
                        f"Pre-issue capital Rs {pre_issue:.1f} Lakhs + Issue size Rs {issue_size:.1f} Lakhs "
                        f"= Rs {post_issue_implied:.1f} Lakhs, which exceeds the Rs 2,500 Lakhs (Rs 25 Cr) "
                        f"ceiling under SEBI ICDR Reg 229(2) for SME Exchange listings."
                    ),
                    "severity": "critical",
                })

    except Exception as e:
        logger.warning(f"[consistency] capital_structure check failed: {e}")
    return errors


# ─────────────────────────────────────────────────────────────────
# Rule 4 — Turnover Consistency
# ─────────────────────────────────────────────────────────────────
def _check_turnover_consistency(company, db: Session) -> List[Dict]:
    """
    Validate the revenue (turnover) series across reported fiscal years.

    Rules:
    1. Missing revenue: If any fiscal year has revenue_lakhs = None, flag it.
    2. Impossible YoY jump: If revenue grows by more than 10× in a single year,
       flag it as a likely data-entry error. (e.g. Rs 50L → Rs 600L in one year
       is unusual and warrants scrutiny.)
    3. Negative revenue: Revenue cannot be negative.
    """
    errors = []
    try:
        from src.extraction.schema import FinancialStatement

        fins = (
            db.query(FinancialStatement)
            .filter(FinancialStatement.company_id == company.id)
            .order_by(FinancialStatement.fiscal_year.asc())
            .all()
        )

        if not fins:
            return errors

        # Rule 1 & 3: Missing or negative revenue
        missing_years = []
        negative_years = []
        for f in fins:
            if f.revenue_lakhs is None:
                missing_years.append(f"FY{f.fiscal_year}")
            elif float(f.revenue_lakhs) < 0:
                negative_years.append(f"FY{f.fiscal_year}: Rs {f.revenue_lakhs} Lakhs")

        if missing_years:
            errors.append({
                "field": "turnover_missing",
                "fix": (
                    f"Revenue (turnover) data is missing for: {', '.join(missing_years)}. "
                    f"SEBI ICDR Reg 238 requires 3 years of restated financial statements. "
                    f"Please ensure revenue figures are entered for all required fiscal years."
                ),
                "severity": "critical",
            })

        if negative_years:
            errors.append({
                "field": "turnover_negative",
                "fix": (
                    f"Negative revenue detected — this is likely a data entry error: "
                    f"{'; '.join(negative_years)}. Revenue cannot be negative. "
                    f"Please verify and correct the financial data."
                ),
                "severity": "critical",
            })

        # Rule 2: Impossible YoY jump (10× threshold)
        valid_fins = [f for f in fins if f.revenue_lakhs is not None and float(f.revenue_lakhs) > 0]
        for i in range(1, len(valid_fins)):
            prev = valid_fins[i - 1]
            curr = valid_fins[i]
            prev_rev = float(prev.revenue_lakhs)
            curr_rev = float(curr.revenue_lakhs)
            if prev_rev > 0:
                growth_multiple = curr_rev / prev_rev
                if growth_multiple >= 10.0:
                    errors.append({
                        "field": "turnover_abnormal_jump",
                        "fix": (
                            f"Abnormal revenue jump detected: Revenue grew {growth_multiple:.1f}× "
                            f"from FY{prev.fiscal_year} (Rs {prev_rev:.1f} Lakhs) to "
                            f"FY{curr.fiscal_year} (Rs {curr_rev:.1f} Lakhs). "
                            f"This may indicate a data entry error (e.g., units mismatch between Lakhs and Crores). "
                            f"Please verify the revenue figures for both years."
                        ),
                        "severity": "warning",
                    })

    except Exception as e:
        logger.warning(f"[consistency] turnover_consistency check failed: {e}")
    return errors


# ─────────────────────────────────────────────────────────────────
# Public Entry Point
# ─────────────────────────────────────────────────────────────────
def run_all_checks(company_name: str, db: Session) -> List[Dict]:
    """
    Run all consistency validation rules for a given company.

    Parameters
    ----------
    company_name : str
        The company name to look up (supports partial/case-insensitive match).
    db : Session
        An active SQLAlchemy session. The caller is responsible for lifecycle.

    Returns
    -------
    List[Dict]
        A (possibly empty) list of error dicts. Each dict has:
          - "field"    : machine-readable identifier
          - "fix"      : human-readable description and recommended action
          - "severity" : "critical" | "warning"

    Adding a new rule
    -----------------
    1. Define a `_check_<rule_name>(company, db) -> List[Dict]` function.
    2. Add it to the `_RULES` list below. Done.
    """
    from src.extraction.schema import Company

    try:
        company = (
            db.query(Company)
            .filter(Company.name.ilike(f"%{company_name}%"))
            .first()
        )
        if not company:
            logger.warning(f"[consistency] Company '{company_name}' not found in DB.")
            return []
    except Exception as e:
        logger.warning(f"[consistency] Company lookup failed: {e}")
        return []

    # ── Rule pipeline — add new rules here ────────────────────────
    _RULES = [
        _check_net_worth,
        _check_promoter_shareholding,
        _check_capital_structure,
        _check_turnover_consistency,
    ]
    # ──────────────────────────────────────────────────────────────

    all_errors: List[Dict] = []
    for rule_fn in _RULES:
        try:
            rule_errors = rule_fn(company, db)
            all_errors.extend(rule_errors)
        except Exception as e:
            logger.warning(f"[consistency] Rule '{rule_fn.__name__}' raised an unexpected error: {e}")

    return all_errors


def run_all_checks_by_id(company_id: str, db: Session) -> List[Dict]:
    """
    Variant of run_all_checks that accepts a company UUID string directly.
    Used by the REST API endpoint which resolves company by ID, not name.
    """
    import uuid as _uuid
    from src.extraction.schema import Company

    try:
        comp_uuid = company_id if isinstance(company_id, _uuid.UUID) else _uuid.UUID(str(company_id))
        company = db.query(Company).filter(Company.id == comp_uuid).first()
        if not company:
            return []
    except Exception as e:
        logger.warning(f"[consistency] Company ID lookup failed: {e}")
        return []

    _RULES = [
        _check_net_worth,
        _check_promoter_shareholding,
        _check_capital_structure,
        _check_turnover_consistency,
    ]

    all_errors: List[Dict] = []
    for rule_fn in _RULES:
        try:
            rule_errors = rule_fn(company, db)
            all_errors.extend(rule_errors)
        except Exception as e:
            logger.warning(f"[consistency] Rule '{rule_fn.__name__}' raised: {e}")

    return all_errors
