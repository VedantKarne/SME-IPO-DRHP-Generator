import io
import logging
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from src.api.auth_router import get_current_user, require_company_access
from src.api.server import get_db
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/export", tags=["Export"])

class ExportSectionRequest(BaseModel):
    company_id: uuid.UUID
    section_name: str
    content: str

class ExportFullRequest(BaseModel):
    company_id: uuid.UUID
    # Demos and mid-drafting reviews need the whole document; a filing-ready
    # export should contain only reviewed sections.
    include_drafts: bool = True

@router.post("/section/{fmt}")
def export_section(
    fmt: str,
    req: ExportSectionRequest,
    current_user: dict = Depends(get_current_user),
):
    require_company_access(current_user, str(req.company_id))

    if fmt == "json":
        # This was an "autosave" endpoint that returned success without writing
        # anything, so callers believed content had been persisted when it had
        # not. Autosave now goes through the section-versions endpoint instead.
        raise HTTPException(
            status_code=410,
            detail=(
                "This endpoint never persisted anything. "
                "Use POST /api/sections/{company_id}/{section_name}/versions to save."
            ),
        )


    if fmt == "docx":
        try:
            from docx import Document
            from htmldocx import HtmlToDocx

            document = Document()
            document.add_heading(req.section_name, 0)
            
            new_parser = HtmlToDocx()
            new_parser.add_html_to_document(req.content, document)
            
            f = io.BytesIO()
            document.save(f)
            f.seek(0)
            
            return Response(
                content=f.read(),
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": f'attachment; filename="{req.section_name}.docx"'}
            )
        except Exception as e:
            logger.error(f"DOCX export failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))
            
    elif fmt == "pdf":
        # This used to return text/html labelled as a PDF export, so the browser
        # downloaded a .pdf file that was actually HTML and would not open.
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
            from src.agent.document_assembler import _escape

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter)
            styles = getSampleStyleSheet()
            story = [Paragraph(_escape(req.section_name), styles["Title"]), Spacer(1, 12)]

            # `content` is editor HTML; strip tags rather than render them raw.
            import re as _re
            plain = _re.sub(r"<br\s*/?>", "\n", req.content or "")
            plain = _re.sub(r"</(p|div|h[1-6]|li)>", "\n", plain)
            plain = _re.sub(r"<[^>]+>", "", plain)
            for block in plain.split("\n"):
                if block.strip():
                    story.append(Paragraph(_escape(block.strip()), styles["Normal"]))
                    story.append(Spacer(1, 6))

            doc.build(story)
            buffer.seek(0)
            return Response(
                content=buffer.read(),
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{req.section_name}.pdf"'},
            )
        except Exception as e:
            logger.exception("PDF export failed")
            raise HTTPException(status_code=500, detail=str(e))

    raise HTTPException(status_code=400, detail="Unsupported format")

@router.post("/full/{fmt}")
def export_full(
    fmt: str,
    req: ExportFullRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    require_company_access(current_user, str(req.company_id))

    if fmt not in ("docx", "pdf"):
        raise HTTPException(status_code=400, detail="Unsupported format")

    from src.agent.document_assembler import document_assembler_node

    try:
        result = document_assembler_node(
            company_id=req.company_id,
            db=db,
            include_drafts=req.include_drafts,
            formats=(fmt,),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Full DRHP export failed")
        raise HTTPException(status_code=500, detail=str(e))

    if result.get("error"):
        # Nothing to assemble is a client-correctable condition, not a server
        # fault, and must not come back as an empty file that looks like success.
        raise HTTPException(status_code=422, detail=result["error"])

    path = result.get(f"{fmt}_path")
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=500, detail="Export produced no file.")

    with open(path, "rb") as fh:
        payload = fh.read()

    # Record the export. An assembled DRHP leaving the system with no trace of
    # who produced it, when, or how many sections it contained is not acceptable
    # for a filing document.
    try:
        import uuid as _uuid
        from src.extraction.schema import AuditLog
        db.add(AuditLog(
            event_type="drhp_exported",
            company_id=req.company_id,
            query=f"format={fmt} include_drafts={req.include_drafts}",
            source_file=os.path.basename(path),
            model_used="none",
        ))
        db.commit()
    except Exception as audit_exc:
        logger.warning(f"Audit log write failed for export: {audit_exc}")

    company = (result.get("company_name") or str(req.company_id)).replace(" ", "_")
    media = ("application/pdf" if fmt == "pdf"
             else "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    return Response(
        content=payload,
        media_type=media,
        headers={
            "Content-Disposition": f'attachment; filename="DRHP_{company}.{fmt}"',
            "X-Sections-Included": str(result.get("sections_included", 0)),
        },
    )
