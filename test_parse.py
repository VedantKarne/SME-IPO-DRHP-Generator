import uuid
import sys
from src.api.document_upload_router import _process_document_background

file_path = "./Uploaded_Docs/125f4a85-7c56-44cd-b243-46cac3d78dc0/Audited_Financial_Statements_f645ef.pdf"
company_id_str = "125f4a85-7c56-44cd-b243-46cac3d78dc0"
upload_id = "00000000-0000-0000-0000-000000000000"

try:
    print("Running background processor...")
    _process_document_background(
        file_path=file_path,
        upload_id=upload_id,
        company_id_str=company_id_str,
        company_name="Test Company",
        filename="Audited_Financial_Statements_f645ef.pdf"
    )
    print("Done!")
except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
