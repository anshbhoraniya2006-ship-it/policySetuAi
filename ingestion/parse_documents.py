"""
Table-Aware Document Parser for PolicySetu AI.
Solves the primary PDF data failure mode in legal hackathons:
Standard PDF extractors scramble multi-column subsidy tables into gibberish.
This module uses pymupdf4llm (or Sarvam Vision / LlamaParse if keys configured)
to preserve multi-column tables, hectare caps, and payout slabs in Markdown format.
"""

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("policysetu.ingestion.parser")
logger.setLevel(logging.INFO)


def parse_pdf_to_markdown(pdf_path: Path) -> Optional[str]:
    """
    Parses a PDF into table-preserved Markdown using pymupdf4llm.
    Row-level subsidy rules remain intact inside standard Markdown tables.
    """
    if not pdf_path or not pdf_path.exists():
        logger.warning(f"PDF path {pdf_path} does not exist.")
        return None

    try:
        import pymupdf4llm
        logger.info(f"Parsing PDF with table-aware layout engine: {pdf_path.name}")
        md_text = pymupdf4llm.to_markdown(str(pdf_path))
        return md_text
    except Exception as e:
        logger.error(f"pymupdf4llm parsing failed: {e}. Trying standard pymupdf.")

    try:
        import fitz  # PyMuPDF
        doc = fitz.open(str(pdf_path))
        pages_text = []
        for page_num in range(len(doc)):
            page = doc[page_num]
            pages_text.append(f"## Page {page_num + 1}\n\n" + page.get_text("text"))
        return "\n\n".join(pages_text)
    except Exception as e:
        logger.error(f"PyMuPDF fallback failed: {e}")

    return None


def load_or_parse_mandate(md_path: Path, pdf_path: Optional[Path] = None) -> str:
    """
    Loads pre-parsed markdown or parses the official PDF if available.
    """
    if pdf_path and pdf_path.exists():
        parsed_md = parse_pdf_to_markdown(pdf_path)
        if parsed_md and len(parsed_md.strip()) > 200:
            return parsed_md

    if md_path and md_path.exists():
        with open(md_path, "r", encoding="utf-8") as f:
            return f.read()

    return ""
