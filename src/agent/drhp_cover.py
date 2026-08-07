"""
SEBI-format DRHP cover page and table of contents.

FORMAT SOURCE
-------------
Geometry and typography were measured directly from a filed SEBI prospectus,
`Original_Docs/Precedents/drhp_physics_wallah.pdf`:

    page size   595.44 x 841.68 pt (A4)
    body font   Times New Roman 10pt   (TimesNewRomanPSMT)
    headers     Times New Roman Bold 9.5-10pt
    layout      full-bleed bordered tables, ~8pt cell padding, narrow margins

Reportlab's built-in Times-Roman is metrically compatible with Times New Roman,
so no font files are needed.

The blocks reproduced here are the ones every filed DRHP carries in the same
order: the issue-type banner, the registrant name and CIN, the four-column
office/contact table, the promoters line, the offer table, the standard
Regulation 6 eligibility paragraph, and the risk/attention boilerplate.

UNKNOWN VALUES
--------------
Real filings print "[●]" for values not yet fixed at the draft stage — price
band, allotment dates, listing details. This module uses the same convention for
data the company has not supplied, so a partially-filled cover reads exactly as a
genuine early-stage DRHP does rather than inventing figures.
"""
from __future__ import annotations

from datetime import date
from typing import List, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, Spacer, Table, TableStyle

# Measured from the reference filing.
PAGE_SIZE = A4
MARGIN = 14 * mm
BODY_FONT = "Times-Roman"
BOLD_FONT = "Times-Bold"
ITALIC_FONT = "Times-Italic"
BODY_SIZE = 9.0
HEAD_SIZE = 9.5

# "[●]" is the placeholder convention real draft filings use, but U+25CF (●)
# is not in the base-14 fonts' WinAnsi encoding and renders as a mojibake glyph
# without embedding a Unicode TTF. U+2022 (•, BULLET) is in WinAnsiEncoding and
# is visually equivalent for this purpose.
TBD = "[•]"

_GRID = colors.black


def _styles():
    return {
        "title": ParagraphStyle("t", fontName=BOLD_FONT, fontSize=13, leading=15,
                                alignment=TA_CENTER, spaceAfter=2),
        "banner": ParagraphStyle("bn", fontName=BOLD_FONT, fontSize=9, leading=11,
                                 alignment=TA_CENTER),
        "sub": ParagraphStyle("s", fontName=BODY_FONT, fontSize=9, leading=11,
                              alignment=TA_CENTER),
        "cell": ParagraphStyle("c", fontName=BODY_FONT, fontSize=BODY_SIZE, leading=10.5,
                               alignment=TA_LEFT),
        "cellc": ParagraphStyle("cc", fontName=BODY_FONT, fontSize=BODY_SIZE, leading=10.5,
                                alignment=TA_CENTER),
        "hdr": ParagraphStyle("h", fontName=BOLD_FONT, fontSize=HEAD_SIZE, leading=10.5,
                              alignment=TA_CENTER),
        "band": ParagraphStyle("b", fontName=BOLD_FONT, fontSize=HEAD_SIZE, leading=11,
                               alignment=TA_CENTER),
        "just": ParagraphStyle("j", fontName=BODY_FONT, fontSize=BODY_SIZE, leading=10.5,
                               alignment=TA_JUSTIFY),
        "note": ParagraphStyle("n", fontName=BODY_FONT, fontSize=7.5, leading=9,
                               alignment=TA_JUSTIFY),
        "tocg": ParagraphStyle("tg", fontName=BOLD_FONT, fontSize=9.5, leading=13),
        "toce": ParagraphStyle("te", fontName=BODY_FONT, fontSize=9, leading=12,
                               leftIndent=10),
    }


def _fmt_int(value) -> str:
    try:
        return f"{int(float(value)):,}"
    except (TypeError, ValueError):
        return TBD


def _fmt_money(value) -> str:
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return TBD


def _table(rows, widths, style_extra=None, header_rows=1):
    t = Table(rows, colWidths=widths, repeatRows=0)
    style = [
        ("GRID", (0, 0), (-1, -1), 0.6, _GRID),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    if style_extra:
        style.extend(style_extra)
    t.setStyle(TableStyle(style))
    return t


def build_cover_flowables(
    company_name: str,
    cin: str,
    registered_office: str,
    contact_person: str,
    contact_email: str,
    contact_phone: str,
    website: str,
    promoters: List[str],
    total_shares: Optional[float],
    price_per_share: Optional[float],
    issue_size_lakhs: Optional[float],
    face_value: float = 10.0,
    dated: Optional[date] = None,
) -> list:
    """Page 1 — the DRHP cover, in the layout used by filed SEBI prospectuses."""
    s = _styles()
    width = PAGE_SIZE[0] - 2 * MARGIN
    out = []

    # ── Issue-type banner (top-right block on a real filing) ────────────────
    dated = dated or date.today()
    out.append(Paragraph("DRAFT RED HERRING PROSPECTUS", s["banner"]))
    out.append(Paragraph(f"Dated: {dated.strftime('%B %d, %Y')}", s["sub"]))
    out.append(Paragraph("(This Draft Red Herring Prospectus will be updated upon filing with the RoC)",
                         s["sub"]))
    out.append(Paragraph("Please read Section 32 of the Companies Act, 2013", s["sub"]))
    out.append(Paragraph("100% Book Built Offer", s["sub"]))
    out.append(Spacer(1, 10))

    # ── Registrant ─────────────────────────────────────────────────────────
    out.append(Paragraph(company_name.upper(), s["title"]))
    out.append(Paragraph(f"CORPORATE IDENTITY NUMBER: {cin or TBD}", s["sub"]))
    out.append(Spacer(1, 6))

    # ── Office / contact table (4 columns, as on the reference filing) ──────
    out.append(_table(
        [
            [Paragraph("REGISTERED AND<br/>CORPORATE OFFICE", s["hdr"]),
             Paragraph("CONTACT PERSON", s["hdr"]),
             Paragraph("TELEPHONE AND<br/>E-MAIL", s["hdr"]),
             Paragraph("WEBSITE", s["hdr"])],
            [Paragraph(registered_office or TBD, s["cell"]),
             Paragraph(contact_person or TBD, s["cell"]),
             Paragraph(f"{contact_phone or TBD}<br/>{contact_email or TBD}", s["cell"]),
             Paragraph(website or TBD, s["cell"])],
        ],
        [width * 0.34, width * 0.22, width * 0.28, width * 0.16],
    ))

    # ── Promoters ──────────────────────────────────────────────────────────
    promoter_line = ", ".join(p.upper() for p in promoters) if promoters else TBD
    out.append(_table(
        [[Paragraph(f"PROMOTERS OF OUR COMPANY: {promoter_line}", s["band"])]],
        [width],
    ))

    # ── Offer details ──────────────────────────────────────────────────────
    out.append(_table([[Paragraph("DETAILS OF THE OFFER TO THE PUBLIC", s["band"])]], [width]))

    shares_txt = _fmt_int(total_shares)
    fv = f"{face_value:,.0f}"
    if issue_size_lakhs is not None:
        amount = f"aggregating up to Rs. {_fmt_money(issue_size_lakhs)} lakhs"
    else:
        amount = f"aggregating up to Rs. {TBD} lakhs"

    fresh = (f"{shares_txt} Equity Shares of face value of Rs. {fv} each {amount}"
             if total_shares else TBD)

    eligibility = (
        "The Offer is being made in terms of Regulation 229(1) of Chapter IX of the "
        "Securities and Exchange Board of India (Issue of Capital and Disclosure "
        "Requirements) Regulations, 2018, as amended (“<b>SEBI ICDR Regulations</b>”). "
        "For details in relation to share reservation among qualified institutional "
        "buyers (“<b>QIBs</b>”), non-institutional investors (“<b>NIIs</b>”) and retail "
        f"individual investors (“<b>RIIs</b>”), see “Offer Structure” on page {TBD}."
    )

    out.append(_table(
        [
            [Paragraph("Type", s["hdr"]), Paragraph("Fresh Issue size", s["hdr"]),
             Paragraph("Offer for Sale size", s["hdr"]), Paragraph("Total Offer size", s["hdr"]),
             Paragraph("Eligibility and Reservation", s["hdr"])],
            [Paragraph("Fresh Issue", s["cellc"]),
             Paragraph(fresh, s["cell"]),
             Paragraph("Not applicable", s["cell"]),
             Paragraph(fresh, s["cell"]),
             Paragraph(eligibility, s["cell"])],
        ],
        [width * 0.10, width * 0.19, width * 0.15, width * 0.19, width * 0.37],
    ))

    if price_per_share:
        out.append(Paragraph(
            f"*Indicative price of Rs. {_fmt_money(price_per_share)} per Equity Share. "
            f"The Price Band and the Offer Price shall be determined by our Company in "
            f"consultation with the Book Running Lead Manager and advertised in accordance "
            f"with the SEBI ICDR Regulations.", s["note"]))

    out.append(Spacer(1, 6))

    # ── Standard attention / risk boilerplate ──────────────────────────────
    out.append(_table([[Paragraph("RISKS IN RELATION TO THE FIRST OFFER", s["band"])]], [width]))
    out.append(_table([[Paragraph(
        f"This being the first public issue of our Company, there has been no formal market for the "
        f"Equity Shares. The face value of the Equity Shares is Rs. {fv} each. The Floor Price, Cap Price "
        f"and Offer Price, as determined and justified by our Company in consultation with the Book "
        f"Running Lead Manager, in accordance with the SEBI ICDR Regulations, and as stated in "
        f"“Basis for Offer Price” on page {TBD}, should not be considered to be indicative of the market "
        f"price of the Equity Shares after listing. No assurance can be given regarding an active or "
        f"sustained trading in the Equity Shares or regarding the price at which the Equity Shares will "
        f"be traded after listing.", s["just"])]], [width]))

    out.append(_table([[Paragraph("GENERAL RISKS", s["band"])]], [width]))
    out.append(_table([[Paragraph(
        "Investments in equity and equity-related securities involve a degree of risk and investors "
        "should not invest any funds in the Offer unless they can afford to take the risk of losing "
        "their entire investment. Investors are advised to read the risk factors carefully before "
        "taking an investment decision in the Offer. For taking an investment decision, investors "
        "must rely on their own examination of our Company and the Offer, including the risks "
        "involved. The Equity Shares in the Offer have not been recommended or approved by the "
        "Securities and Exchange Board of India (“<b>SEBI</b>”), nor does SEBI guarantee the accuracy or "
        f"adequacy of the contents of this Draft Red Herring Prospectus. Specific attention of the "
        f"investors is invited to “Risk Factors” on page {TBD}.", s["just"])]], [width]))

    out.append(_table([[Paragraph("COMPANY'S AND PROMOTERS' ABSOLUTE RESPONSIBILITY", s["band"])]], [width]))
    out.append(_table([[Paragraph(
        f"Our Company, having made all reasonable enquiries, accepts responsibility for and confirms "
        f"that this Draft Red Herring Prospectus contains all information with regard to our Company "
        f"and the Offer, which is material in the context of the Offer, that the information contained "
        f"in this Draft Red Herring Prospectus is true and correct in all material aspects and is not "
        f"misleading in any material respect, that the opinions and intentions expressed herein are "
        f"honestly held and that there are no other facts, the omission of which makes this Draft Red "
        f"Herring Prospectus as a whole or any of such information or the expression of any such "
        f"opinions or intentions, misleading in any material respect.", s["just"])]], [width]))

    out.append(Spacer(1, 4))
    out.append(_table(
        [[Paragraph("BOOK RUNNING LEAD MANAGER", s["hdr"]),
          Paragraph("REGISTRAR TO THE OFFER", s["hdr"])],
         [Paragraph(TBD, s["cellc"]), Paragraph(TBD, s["cellc"])]],
        [width * 0.5, width * 0.5],
    ))
    out.append(_table(
        [[Paragraph("BID/OFFER OPENS ON", s["hdr"]), Paragraph("BID/OFFER CLOSES ON", s["hdr"])],
         [Paragraph(TBD, s["cellc"]), Paragraph(TBD, s["cellc"])]],
        [width * 0.5, width * 0.5],
    ))
    out.append(PageBreak())
    return out


def build_toc_flowables(grouped_sections, drafted_names=None) -> list:
    """
    Page 2 — table of contents, in the SECTION I-IX structure real filings use.

    `grouped_sections` is [(group, group_title, [Section, ...]), ...].
    Chapters with no draft yet are marked, so the contents page reflects the
    actual state of the document rather than implying completeness.
    """
    s = _styles()
    drafted = {n.strip().lower() for n in (drafted_names or [])}
    out = [Paragraph("TABLE OF CONTENTS", s["title"]), Spacer(1, 8)]

    for group, group_title, chapters in grouped_sections:
        out.append(Paragraph(f"{group} – {group_title.upper()}", s["tocg"]))
        for chapter in chapters:
            name = chapter.name if hasattr(chapter, "name") else str(chapter)
            marker = "" if name.strip().lower() in drafted else f"  {TBD}"
            out.append(Paragraph(f"{name}{marker}", s["toce"]))
        out.append(Spacer(1, 3))

    out.append(Spacer(1, 10))
    out.append(Paragraph(
        f"Page references marked {TBD} will be completed on filing, in accordance with "
        f"the SEBI ICDR Regulations.", s["note"]))
    out.append(PageBreak())
    return out
