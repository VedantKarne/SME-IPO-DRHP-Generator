"""
src/extraction/doc_classifier.py

Document type classifier with three backends:
  1. Gemini 2.5 Flash      — active, zero-shot, used by the upload pipeline
  2. Keyword + Groq LLM    — fallback when Gemini is unavailable
  3. LayoutLMv3 (stub)     — TODO: requires fine-tuning on 50-100 labelled samples/category

Supported categories:
  financial_statement | board_resolution | factory_license |
  moa_aoa | legal_notice | insurance_policy | other
"""
import os
import logging
from typing import Literal

from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

DOC_CATEGORIES = [
    "financial_statement",
    "board_resolution",
    "factory_license",
    "moa_aoa",
    "legal_notice",
    "insurance_policy",
    "other",
]

DocType = Literal[
    "financial_statement",
    "board_resolution",
    "factory_license",
    "moa_aoa",
    "legal_notice",
    "insurance_policy",
    "other",
]


class DocClassifier:
    """
    Classifies uploaded documents into IPO-relevant categories.

    Usage:
        classifier = DocClassifier()
        # Classify from file path (uses Gemini 2.5 Flash):
        doc_type = classifier.classify_from_path("/path/to/file.pdf")
        # Classify from extracted text (uses keywords + Groq):
        doc_type = classifier.classify_from_text("...extracted text...")
    """

    # ── Rule-based keyword fast path ──────────────────────────────────────────

    _KEYWORD_MAP = {
        "financial_statement": [
            "balance sheet", "profit and loss", "p&l", "revenue", "ebitda",
            "net worth", "audit report", "standalone financial",
            "cash flow statement", "audited financials",
        ],
        "board_resolution": [
            "board resolution", "resolved that", "board of directors",
            "extraordinary general meeting", "agm", "egm", "minutes of meeting",
        ],
        "factory_license": [
            "factory licence", "factory license", "registration certificate",
            "industrial licence", "pollution noc", "shops and establishment",
        ],
        "moa_aoa": [
            "memorandum of association", "articles of association", "moa", "aoa",
            "objects clause", "share capital", "registered office clause",
        ],
        "legal_notice": [
            "legal notice", "litigation", "writ petition", "civil suit",
            "arbitration", "court order", "injunction", "summons",
        ],
        "insurance_policy": [
            "insurance policy", "policy number", "sum insured", "premium",
            "fire insurance", "industrial all risk", "policy schedule",
        ],
    }

    def _classify_by_keywords(self, text: str) -> str:
        """Fast keyword scan. Returns best matching category or 'other'."""
        text_lower = text.lower()
        scores = {
            cat: sum(1 for kw in kws if kw in text_lower)
            for cat, kws in self._KEYWORD_MAP.items()
        }
        best = max(scores, key=scores.get)
        return best if scores[best] > 0 else "other"

    # ── Gemini backend (active, zero-shot) ────────────────────────────────────

    def classify_from_path(self, file_path: str) -> DocType:
        """
        Classifies a PDF file by uploading it to Gemini 2.5 Flash.
        Falls back to keyword + PyMuPDF text extraction if Gemini is unavailable.
        """
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning(
                "GEMINI_API_KEY not set — falling back to keyword classifier."
            )
            return self._classify_from_file_text(file_path)

        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.5-flash")

            ext = os.path.splitext(file_path)[1].lower()
            mime_type = (
                "application/pdf" if ext == ".pdf" else "application/octet-stream"
            )

            with open(file_path, "rb") as f:
                doc = genai.upload_file(f, mime_type=mime_type)

            try:
                categories_str = " | ".join(DOC_CATEGORIES)
                prompt = (
                    f"Classify this document into EXACTLY ONE category from: "
                    f"{categories_str}. "
                    "Return ONLY the category name, nothing else."
                )
                response = model.generate_content([prompt, doc])
                raw = response.text.strip().lower().replace(" ", "_")
                result = raw if raw in DOC_CATEGORIES else "other"
                logger.info(f"Gemini classified '{os.path.basename(file_path)}' as '{result}'")
                return result
            except Exception as e:
                logger.warning(
                    f"Gemini classification failed: {e}. Falling back to keywords."
                )
                return self._classify_from_file_text(file_path)
            finally:
                try:
                    genai.delete_file(doc.name)
                except Exception:
                    pass
        except ImportError:
            logger.warning("google-generativeai not installed. Using keyword classifier.")
            return self._classify_from_file_text(file_path)

    # ── Text-based classification (keywords → Groq LLM) ───────────────────────

    def classify_from_text(self, text: str) -> DocType:
        """
        Classifies from extracted text (no file upload needed).
        1. Keyword heuristic fast path
        2. Groq LLM fallback for ambiguous documents
        """
        # Fast path: keywords
        kw_result = self._classify_by_keywords(text)
        if kw_result != "other":
            return kw_result

        # Groq LLM fallback
        try:
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                return "other"

            from groq import Groq
            client = Groq(api_key=api_key)
            categories_str = " | ".join(DOC_CATEGORIES)
            prompt = (
                f"Classify this document excerpt into EXACTLY ONE category from: "
                f"{categories_str}.\n"
                "Return ONLY the category name, nothing else.\n\n"
                f"Text:\n{text[:2000]}"
            )
            completion = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=20,
            )
            raw = (
                completion.choices[0].message.content.strip().lower().replace(" ", "_")
            )
            result = raw if raw in DOC_CATEGORIES else "other"
            logger.info(f"Groq classified document as '{result}'")
            return result
        except Exception as e:
            logger.warning(f"Groq classification failed: {e}")
            return "other"

    def _classify_from_file_text(self, file_path: str) -> DocType:
        """Extracts text from a file with PyMuPDF and classifies by keywords + Groq."""
        try:
            import fitz
            doc = fitz.open(file_path)
            text = " ".join(page.get_text("text") for page in doc)
            doc.close()
            return self.classify_from_text(text)
        except Exception as e:
            logger.warning(f"PyMuPDF text extraction failed for classification: {e}")
            return "other"

    # ── LayoutLMv3 stub (requires fine-tuning before production use) ──────────

    @staticmethod
    def classify_document_ml(text_sample: str) -> DocType:
        """
        TODO: Fine-tune LayoutLMv3 on 50-100 labelled documents per category
        before using this method in production.

        Label map after fine-tuning:
            LABEL_0 → financial_statement
            LABEL_1 → board_resolution
            LABEL_2 → factory_license
            LABEL_3 → moa_aoa
            LABEL_4 → legal_notice
            LABEL_5 → insurance_policy
            LABEL_6 → other

        Training approach:
            from transformers import Trainer, TrainingArguments
            # 1. Collect 50-100 PDFs per category, extract text
            # 2. Create HuggingFace Dataset with (text, label) pairs
            # 3. Fine-tune microsoft/layoutlmv3-base
            # 4. Save checkpoint → update model path below
        """
        try:
            from transformers import pipeline

            # NOTE: This will NOT produce correct labels without fine-tuning.
            # Replace model path with fine-tuned checkpoint when available.
            classifier = pipeline(
                "text-classification",
                model="microsoft/layoutlmv3-base",
                device="mps",  # Apple Silicon; use "cuda:0" or "cpu" as needed
            )
            label_map = {
                "LABEL_0": "financial_statement",
                "LABEL_1": "board_resolution",
                "LABEL_2": "factory_license",
                "LABEL_3": "moa_aoa",
                "LABEL_4": "legal_notice",
                "LABEL_5": "insurance_policy",
                "LABEL_6": "other",
            }
            result = classifier(text_sample[:512])
            return label_map.get(result[0]["label"], "other")
        except ImportError:
            logger.error(
                "transformers not installed. "
                "Run: pip install transformers datasets"
            )
            return "other"
        except Exception as e:
            logger.error(f"LayoutLMv3 inference failed: {e}")
            return "other"
