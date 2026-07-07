import sys
from src.extraction.kpi_extractor import extract_with_retry

def main():
    if len(sys.argv) < 2:
        print("Usage: python manual_extract.py <path_to_pdf>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    print(f"Extracting data from {pdf_path}...")
    
    try:
        result = extract_with_retry(pdf_path)
        print("\n--- Extraction Successful ---")
        print(f"Company Name: {result.company_name}")
        print(f"CIN: {result.cin}")
        
        print("\n--- Financials ---")
        for f in result.financials:
            print(f"Year {f.fiscal_year}: Rev={f.revenue_lakhs}, EBITDA={f.ebitda_lakhs}, PAT={f.pat_lakhs} (Confidence: {f.data_confidence})")
            
        print("\n--- Directors ---")
        for d in result.directors:
            print(f"Name: {d.name}, DIN: {d.din}, Litigation: {d.pending_litigation}")
            
    except Exception as e:
        print(f"Failed to extract: {e}")

if __name__ == "__main__":
    main()
