"""
Canonical DRHP section taxonomy, derived from real SEBI filings.

WHY THIS EXISTS
---------------
Three separate, mutually inconsistent section lists lived in the codebase:

  * `SECTIONS_25` in src/api/server.py               (25 names, flat)
  * `SEBI_TOC_ORDER` in src/agent/document_assembler.py (the same 25, as a dict)
  * `DRHP_SECTIONS` in src/ingestion/client_data_chunker.py (17 different names)

The third uses different wording for the same concepts — "Objects of the
**Issue**" vs "Objects of the **Offer**", "Cover Page & **Summary**" vs
"Cover Page & **General Information**" — so a chunk classified by the uploader
could not be joined to a section by the drafting or export code.

More importantly, none of them matches how a filed DRHP is actually structured.
CANONICAL_SECTIONS below was derived by parsing the table of contents of all 20
filings in `Original_Docs/Precedents/` (see `precedent_registry.parse_toc`) and
recording chapter frequency, SECTION grouping, and average position. The
`frequency` field is the number of those 20 filings the chapter appears in — so
it is a measured value, not an editorial judgement.

Real filings nest named chapters under roman-numbered SECTION groups. The
app's flat 25-item list has no grouping, omits chapters that appear in every
single filing (Definitions and Abbreviations, Financial Indebtedness,
Restrictions on Foreign Ownership — 19-20/20 each), and invents standalone
chapters that appear in none (Corporate Governance and Key Managerial
Personnel are sub-headings inside "Our Management").

MIGRATION SAFETY
----------------
`resolve()` maps any legacy name — from any of the three lists — onto a
canonical section. Existing `generated_section` rows are keyed by the legacy
names, so nothing may rename them in place; resolution happens at read time.
`LEGACY_SECTIONS_25` is re-exported unchanged for the operational paths
(sections API, sync state machine, frontend) that still key off it.
"""
from __future__ import annotations

import re
from typing import Dict, List, NamedTuple, Optional


class Section(NamedTuple):
    name: str            # canonical chapter name, as filings render it
    group: str           # roman-numbered SECTION grouping
    group_title: str
    frequency: int       # how many of the 20 precedent filings contain it
    aliases: tuple = ()


# Ordered as a filing orders them. `frequency` is out of 20 precedent TOCs.
CANONICAL_SECTIONS: List[Section] = [
    # ---- SECTION I — GENERAL ------------------------------------------------
    Section("Definitions and Abbreviations", "SECTION I", "General", 20),
    Section("Presentation of Financial, Industry and Market Data", "SECTION I", "General", 10,
            ("Currency of Presentation", "Certain Conventions")),
    Section("Forward-Looking Statements", "SECTION I", "General", 19,
            ("Forward Looking Statements",)),
    Section("Summary of the Offer Document", "SECTION I", "General", 11,
            ("Issue Document Summary", "Summary of the Issue Document", "Introduction")),

    # ---- SECTION II — RISK FACTORS -----------------------------------------
    Section("Risk Factors", "SECTION II", "Risk Factors", 20),

    # ---- SECTION III — INTRODUCTION ----------------------------------------
    Section("The Offer", "SECTION III", "Introduction", 16, ("The Issue",)),
    Section("Summary of Financial Information", "SECTION III", "Introduction", 7,
            ("Summary Financial Information", "Summary of Restated Financial Information")),
    Section("General Information", "SECTION III", "Introduction", 20,
            ("Cover Page & General Information", "Cover Page & Summary")),
    Section("Capital Structure", "SECTION III", "Introduction", 20),
    Section("Objects of the Offer", "SECTION III", "Introduction", 15,
            ("Objects of the Issue",)),
    Section("Basis for Offer Price", "SECTION III", "Introduction", 15,
            ("Basis of Issue Price", "Basis for Issue Price")),
    Section("Statement of Special Tax Benefits", "SECTION III", "Introduction", 15,
            ("Statement of Tax Benefits", "Statement of Possible Special Tax Benefits")),

    # ---- SECTION IV — ABOUT OUR COMPANY ------------------------------------
    Section("Industry Overview", "SECTION IV", "About Our Company", 20),
    Section("Our Business", "SECTION IV", "About Our Company", 20,
            ("Business Overview", "About the Company", "About our Company")),
    Section("Key Regulations and Policies", "SECTION IV", "About Our Company", 18,
            ("Key Industry Regulations", "Key Regulations and Policies in India")),
    Section("History and Certain Corporate Matters", "SECTION IV", "About Our Company", 20,
            ("History and Corporate Structure",)),
    # Corporate Governance and KMP are sub-headings of Our Management in every
    # filing examined; they are aliases, not chapters.
    Section("Our Management", "SECTION IV", "About Our Company", 20,
            ("Management & Board of Directors", "Corporate Governance",
             "Key Managerial Personnel (KMP)")),
    Section("Our Promoters and Promoter Group", "SECTION IV", "About Our Company", 18,
            ("Our Promoters & Promoter Group",)),
    Section("Our Group Companies", "SECTION IV", "About Our Company", 18,
            ("Our Group Company",)),
    Section("Dividend Policy", "SECTION IV", "About Our Company", 20),

    # ---- SECTION V — FINANCIAL INFORMATION ---------------------------------
    Section("Restated Financial Information", "SECTION V", "Financial Information", 20,
            ("Financial Statements (3 Years)", "Financial Statements", "Financial Information",
             "Restated Consolidated Financial Information")),
    Section("Other Financial Information", "SECTION V", "Financial Information", 19,
            ("Related Party Transactions",)),
    Section("Capitalisation Statement", "SECTION V", "Financial Information", 17),
    Section("Management's Discussion and Analysis of Financial Condition and Results of Operations",
            "SECTION V", "Financial Information", 11,
            ("Management Discussion & Analysis", "Operations")),
    Section("Financial Indebtedness", "SECTION V", "Financial Information", 20),

    # ---- SECTION VI — LEGAL AND OTHER INFORMATION --------------------------
    Section("Outstanding Litigation and Material Developments", "SECTION VI",
            "Legal and Other Information", 14,
            ("Outstanding Litigations and Material Developments", "Legal & Other Information")),
    Section("Government and Other Approvals", "SECTION VI", "Legal and Other Information", 17),
    Section("Other Regulatory and Statutory Disclosures", "SECTION VI",
            "Legal and Other Information", 20,
            ("Other Regulatory & Statutory Disclosures",)),

    # ---- SECTION VII — OFFER INFORMATION -----------------------------------
    Section("Terms of the Offer", "SECTION VII", "Offer Information", 16,
            ("Terms of the Issue",)),
    Section("Offer Structure", "SECTION VII", "Offer Information", 16, ("Issue Structure",)),
    Section("Offer Procedure", "SECTION VII", "Offer Information", 16, ("Issue Procedure",)),
    Section("Restrictions on Foreign Ownership of Indian Securities", "SECTION VII",
            "Offer Information", 19),

    # ---- SECTION VIII — ARTICLES OF ASSOCIATION ----------------------------
    Section("Description of Equity Shares and Terms of the Articles of Association",
            "SECTION VIII", "Description of Equity Shares", 20),

    # ---- SECTION IX — OTHER INFORMATION ------------------------------------
    Section("Material Contracts and Documents for Inspection", "SECTION IX",
            "Other Information", 20, ("Material Contracts & Documents",)),
    Section("Declaration", "SECTION IX", "Other Information", 20,
            ("Declaration & Undertakings",)),
]


# The 25-name list the running system still keys off: generated_section rows,
# the sections API, the sync state machine, and the frontend sidebar. Kept
# verbatim — renaming these in place would orphan existing database rows.
LEGACY_SECTIONS_25: List[str] = [
    "Cover Page & General Information", "Risk Factors", "Introduction", "General Information",
    "Capital Structure", "Objects of the Offer", "Basis of Issue Price", "Statement of Tax Benefits",
    "About the Company", "Industry Overview", "Our Business", "Key Industry Regulations",
    "History and Corporate Structure", "Management & Board of Directors",
    "Key Managerial Personnel (KMP)", "Our Promoters & Promoter Group",
    "Related Party Transactions", "Dividend Policy", "Financial Statements (3 Years)",
    "Management Discussion & Analysis", "Corporate Governance", "Terms of the Issue",
    "Other Regulatory & Statutory Disclosures", "Material Contracts & Documents",
    "Declaration & Undertakings",
]


def _normalise(name: str) -> str:
    """Fold case, punctuation and '&'/'and' so lookups survive minor variance."""
    text = (name or "").strip().lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


_BY_KEY: Dict[str, Section] = {}
for _section in CANONICAL_SECTIONS:
    _BY_KEY[_normalise(_section.name)] = _section
    for _alias in _section.aliases:
        _BY_KEY.setdefault(_normalise(_alias), _section)


def resolve(name: str) -> Optional[Section]:
    """
    Map any section name — canonical, legacy 25, or client-chunker wording —
    onto its canonical Section. Returns None when unrecognised, so callers can
    surface the gap rather than silently dropping content into a default.

    Note: `client_data_chunker.DRHP_SECTIONS` includes a "General" bucket for
    text the classifier could not place. That is deliberately left unresolved —
    it means "unclassified", not "belongs to some chapter called General".
    """
    return _BY_KEY.get(_normalise(name))


# Several legacy names collapse onto one canonical chapter, because real filings
# do not give them standalone chapters: "Management & Board of Directors",
# "Key Managerial Personnel (KMP)" and "Corporate Governance" are all
# sub-headings within "Our Management". Anything assembling a document from
# drafted sections must therefore expect many-to-one and keep the legacy name as
# a sub-heading rather than emitting the chapter three times.
def legacy_names_for(section: Section) -> List[str]:
    return [name for name in LEGACY_SECTIONS_25 if resolve(name) is section]


def canonical_name(name: str) -> str:
    """Canonical name, or the input unchanged when it cannot be resolved."""
    section = resolve(name)
    return section.name if section else name


def sort_key(name: str) -> tuple:
    """
    Ordering key for assembling a document. Unresolved sections sort last
    rather than being interleaved at an arbitrary position.
    """
    section = resolve(name)
    if section is None:
        return (len(CANONICAL_SECTIONS), name)
    return (CANONICAL_SECTIONS.index(section), "")


def grouped() -> List[tuple]:
    """[(group, group_title, [Section, ...]), ...] in filing order."""
    out: List[tuple] = []
    for section in CANONICAL_SECTIONS:
        if not out or out[-1][0] != section.group:
            out.append((section.group, section.group_title, []))
        out[-1][2].append(section)
    return out
