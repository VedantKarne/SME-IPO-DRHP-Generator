from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/export", tags=["Export"])

class ExportSectionRequest(BaseModel):
    company_id: str
    section_name: str
    content: str

class ExportFullRequest(BaseModel):
    company_id: str

@router.post("/section/{fmt}")
def export_section(fmt: str, req: ExportSectionRequest):
    if fmt == "json":
        # Autosave endpoint - just return success
        return {"status": "success"}
        
    if fmt == "docx":
        try:
            from docx import Document
            from htmldocx import HtmlToDocx
            import io
            
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
        # We handle PDF via browser window.print() or simply fallback. 
        # Since frontend expects a blob, we'll return a placeholder PDF or HTML that triggers print.
        html_content = f"<h1>{req.section_name}</h1>{req.content}"
        return Response(content=html_content.encode("utf-8"), media_type="text/html")
        
    raise HTTPException(status_code=400, detail="Unsupported format")

@router.post("/full/{fmt}")
def export_full(fmt: str, req: ExportFullRequest):
    # For now, return a basic stub. A full export requires joining all sections.
    text = f"Full Export for {req.company_id} in {fmt} format."
    return Response(content=text.encode("utf-8"), media_type="text/plain")
