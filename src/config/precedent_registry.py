"""
Curated metadata for the precedent DRHP corpus, plus chapter attribution.

WHY THIS EXISTS
---------------
Precedent chunk metadata used to be derived by splitting the PDF filename on
underscores (main_ingestion_runner.py): `drhps_png_reva_diamond_jewellery_ltd`
became company='drhps', exchange='png', year='reva'. Every file in the corpus
starts with "drhp_", so this was wrong for all 20 filings, and the bad values
flowed straight into the citations attached to generated DRHP text.

`Original_Docs/Precedents/_pull_index.csv` was clearly meant to hold this
mapping, but it contains only a header row.

Company names and filing years below were read out of each document's own cover
page (the "Dated: <Month> <Day>, <Year>" line and the registrant name), not
inferred from filenames — several filenames are actively misleading. For
example `drhp_basmati_rice_ltd.pdf` is the prospectus of AMIR CHAND JAGDISH
KUMAR (EXPORTS) LIMITED, and `drhp_wakeplus.pdf` is NEPHROCARE HEALTH SERVICES
LIMITED.

`exchange` is deliberately absent. Every filing in this corpus references both
"EMERGE" and "Main Board" in boilerplate definitions, so the text does not
support a reliable segment classification, and inventing one would put an
unverified claim into a regulatory citation.
"""
from __future__ import annotations

import re
from typing import Dict, List, NamedTuple, Optional, Sequence, Tuple


class PrecedentInfo(NamedTuple):
    company: str
    year: str
    selected: bool  # part of the actively ingested subset


# Keyed by PDF filename as it appears in Original_Docs/Precedents/.
# `selected` marks the smaller-issuer subset chosen for ingestion; large-cap
# filings (Lenskart, Meesho, LG, PhysicsWallah, ...) are excluded because their
# scale and disclosure depth are poor models for an SME draft.
PRECEDENTS: Dict[str, PrecedentInfo] = {
    "drhp_advit_jewels_ltd.pdf": PrecedentInfo("Advit Jewels Limited", "2026", True),
    "drhp_basmati_rice_ltd.pdf": PrecedentInfo("Amir Chand Jagdish Kumar (Exports) Limited", "2026", True),
    "drhp_inovision_ltd.pdf": PrecedentInfo("Innovision Limited", "2026", True),
    "drhp_om_power_ltd.pdf": PrecedentInfo("Om Power Transmission Limited", "2026", True),
    "drhp_rajputana_stainless_steel_ltd.pdf": PrecedentInfo("Rajputana Stainless Limited", "2026", True),
    "drhps_png_reva_diamond_jewellery_ltd.pdf": PrecedentInfo("PNGS Reva Diamond Jewellery Limited", "2026", True),

    # Not ingested — retained so the mapping is complete if the subset changes.
    "drhp_LG_electronics_india_ltd.pdf": PrecedentInfo("LG Electronics India Limited", "2025", False),
    "drhp_billionbrains_garage_ltd.pdf": PrecedentInfo("Billionbrains Garage Ventures Limited", "2025", False),
    "drhp_central_mine_planning_and_design_institute_ltd.pdf": PrecedentInfo("Central Mine Planning & Design Institute Limited", "2026", False),
    "drhp_cleanmax.pdf": PrecedentInfo("Clean Max Enviro Energy Solutions Limited", "2026", False),
    "drhp_csm_technologies_ltd.pdf": PrecedentInfo("CSM Technologies Limited", "2026", False),
    "drhp_gsp_crop_science_ltd.pdf": PrecedentInfo("GSP Crop Science Limited", "2026", False),
    "drhp_lenskart.pdf": PrecedentInfo("Lenskart Solutions Limited", "2025", False),
    "drhp_meesho.pdf": PrecedentInfo("Meesho Limited", "", False),
    "drhp_park_hospital.pdf": PrecedentInfo("Park Medi World Limited", "2025", False),
    "drhp_physics_wallah.pdf": PrecedentInfo("PhysicsWallah Limited", "", False),
    "drhp_reliance_nippon_asset_mgmt_ltd.pdf": PrecedentInfo("Reliance Nippon Life Asset Management Limited", "", False),
    "drhp_tutlemint_fintech_solns_ltd.pdf": PrecedentInfo("Turtlemint Fintech Solutions Limited", "", False),
    "drhp_wakefit.pdf": PrecedentInfo("Wakefit Innovations Limited", "2025", False),
    "drhp_wakeplus.pdf": PrecedentInfo("Nephrocare Health Services Limited", "2025", False),
}


def selected_filenames() -> List[str]:
    return [name for name, info in PRECEDENTS.items() if info.selected]


def lookup(filename: str) -> Optional[PrecedentInfo]:
    return PRECEDENTS.get(filename)


# ---------------------------------------------------------------------------
# Chapter attribution from each filing's own table of contents
# ---------------------------------------------------------------------------

# Matches a TOC line: an upper-case chapter name, dot leaders (or a run of
# spaces, which some filings use for the SECTION rows), then a page number.
#   "OUR BUSINESS ................................ 200"
#   "SECTION VIII: DESCRIPTION OF EQUITY SHARES ...   467"
# The separator class includes ':' and en/em dashes because filings vary between
# "SECTION I - GENERAL", "SECTION I – GENERAL" and "SECTION II: RISK FACTORS".
_TOC_LINE = re.compile(
    r"^([A-Z][A-Z \'’,\-–—:&/\(\)\.]{6,90}?)\s*(?:[\.…]{2,}|\s{2,})\s*(\d{1,4})\s*$",
    re.MULTILINE,
)

# "SECTION IV - PARTICULARS OF THE ISSUE" -> group(1) = "IV", group(2) = the title.
_SECTION_PREFIX = re.compile(r"^SECTION\s+([MDCLXVI]+)\s*[-–—:]?\s*(.*)$")

# Filings label the contents page either "TABLE OF CONTENTS" or just "CONTENTS".
_TOC_HEADING = re.compile(r"\b(?:TABLE\s+OF\s+)?CONTENTS\b")


class TocEntry(NamedTuple):
    chapter: str          # e.g. "Our Business"
    section_group: str    # e.g. "SECTION V" — the roman-numbered grouping, if any
    printed_page: int
    pdf_page: int         # printed_page + calibrated offset


def _titlecase(name: str) -> str:
    """DRHP TOCs are upper-case; render them readably for citations."""
    cleaned = re.sub(r"\s+", " ", name).strip(" .-–—")
    small = {"and", "of", "the", "for", "to", "in", "on", "our", "certain", "other"}
    words = []
    for i, word in enumerate(cleaned.lower().split()):
        if word.isdigit() or len(word) <= 1:
            words.append(word.upper())
        elif i > 0 and word in small:
            words.append(word)
        else:
            words.append(word.capitalize())
    return " ".join(words)


def parse_toc(pages: Sequence[Tuple[int, str]]) -> List[TocEntry]:
    """
    Build an ordered chapter index from a filing's table-of-contents page.

    `pages` is [(pdf_page_number, page_text), ...] in document order.

    Returns [] when no TOC page is found — the caller must treat that as
    "no chapter attribution available" rather than substituting a guess.
    """
    # Pick the candidate contents page that actually yields the most entries —
    # the phrase also appears in running headers and cross-references.
    toc_text = None
    best_count = 0
    for _page_no, text in pages[:25]:
        upper = (text or "").upper()
        if not _TOC_HEADING.search(upper):
            continue
        count = len(_TOC_LINE.findall(text))
        if count > best_count:
            toc_text, best_count = text, count
    if not toc_text or best_count == 0:
        return []

    raw: List[Tuple[str, int]] = [
        (m.group(1), int(m.group(2))) for m in _TOC_LINE.finditer(toc_text)
    ]
    if not raw:
        return []

    offset = _calibrate_offset(raw, pages)

    entries: List[TocEntry] = []
    section_group = ""
    for name, printed in raw:
        match = _SECTION_PREFIX.match(name.strip())
        if match:
            section_group = f"SECTION {match.group(1)}"
            title = match.group(2).strip()
            # A bare "SECTION II - RISK FACTORS" line is both the group header
            # and the chapter itself.
            chapter = _titlecase(title) if title else section_group
        else:
            chapter = _titlecase(name)
        entries.append(TocEntry(chapter, section_group, printed, printed + offset))

    entries.sort(key=lambda e: e.pdf_page)
    return entries


def _calibrate_offset(raw: Sequence[Tuple[str, int]], pages: Sequence[Tuple[int, str]]) -> int:
    """
    TOC page numbers are the *printed* numbers, which differ from PDF page index
    because of front matter. Recover the offset by locating chapter headings in
    the body and taking the most common difference.
    """
    lookup_pages = {no: (text or "") for no, text in pages}
    candidates: List[int] = []

    for name, printed in raw:
        needle = re.sub(r"\s+", " ", name).strip().upper()
        if len(needle) < 8:
            continue
        # Search a window around the expected location rather than the whole doc,
        # so a passing cross-reference elsewhere doesn't win.
        for probe in range(printed, printed + 12):
            text = lookup_pages.get(probe)
            if not text:
                continue
            head = re.sub(r"\s+", " ", text[:400]).upper()
            if needle in head:
                candidates.append(probe - printed)
                break

    if not candidates:
        return 0
    # Mode, with the smallest offset winning ties.
    counts: Dict[int, int] = {}
    for value in candidates:
        counts[value] = counts.get(value, 0) + 1
    best = max(counts.items(), key=lambda kv: (kv[1], -abs(kv[0])))
    return best[0]


class ChapterIndex:
    """Maps a PDF page number to the chapter that covers it."""

    def __init__(self, entries: Sequence[TocEntry]):
        self._entries = sorted(entries, key=lambda e: e.pdf_page)

    def __bool__(self) -> bool:
        return bool(self._entries)

    def chapter_for_page(self, pdf_page: int) -> Tuple[str, str]:
        """Return (chapter, section_group); ("", "") when unknown."""
        found = ("", "")
        for entry in self._entries:
            if entry.pdf_page <= pdf_page:
                found = (entry.chapter, entry.section_group)
            else:
                break
        return found

    @property
    def entries(self) -> List[TocEntry]:
        return list(self._entries)
