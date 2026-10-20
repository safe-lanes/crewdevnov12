"""Read-only acceptance check of downloaded fixture PDFs against frozen facts.

Run with the PyMuPDF tools path documented in the layout review. This is not an
automated database test, provisions no fixtures and reads no live crew records.
"""
import hashlib
import json
import re
from pathlib import Path
import fitz

root = Path("generated-artifacts/company-pdf-layout")
records = json.loads((root / "revised-layout-frozen-facts.json").read_text())
signature_types = set()
for record in records:
    path = root / f"revised-sample-{record['kind']}.pdf"
    assert hashlib.sha256(path.read_bytes()).hexdigest() == record["fileSha256"]
    doc = fitz.open(path)
    header = record["header"]
    reference = header["documentReference"]
    assert re.fullmatch(r"CF-\d{4}-\d{6,}", reference)
    texts = [page.get_text() for page in doc]
    for index, (page, text) in enumerate(zip(doc, texts)):
        running = " ".join(page.get_text(clip=fitz.Rect(0, 0, 595, 105)).split())
        for value in [header["tenant"]["companyName"], header["definition"]["form"]["name"],
                      header["subject"]["subjectLabel"],
                      f"Version {header['definition']['version']['versionNo']}"]:
            assert value in running, (record["kind"], index + 1, value)
        assert f"Document reference: {reference}" in text
        assert "Record fingerprint (SHA-256)" in text
        assert record["recordSha256"] in text
        assert f"Page {index + 1} of {len(doc)}" in text
        assert "COMPANY FORM  /  STORED COPY" not in text
        assert "Frozen-record SHA-256" not in text
        assert not re.search(r"\b\d{4}-\d{2}-\d{2}\b", text)
    first = texts[0]
    for label in ["Crew ID", "Nationality"]:
        value = next(field["value"] for field in header["subject"]["fields"] if field["label"] == label)
        assert f"{label}: {value or 'Not recorded'}" in first
    assert f"Document reference: {reference}" in first
    all_text = "\n".join(texts)
    for value in ["1 · Recorded form and signatures", "1.1 Recorded answers and signatures",
                  "1.1.1 Long recorded answer", "Rank: Not recorded", "Witness designation:",
                  "20-Oct-2026", " UTC"]:
        assert value in all_text, (record["kind"], value)
    assert ("01-Oct-2026" in first) if record["kind"] == "company-name" else True
    assert len(doc[0].get_images()) == (1 if record["kind"] == "logo" else 0)
    for label in ["Company Representative", "Seafarer", "Vessel Management"]:
        if label in all_text:
            signature_types.add(label)
    for page_index in {0, len(doc) // 2, len(doc) - 1}:
        doc[page_index].get_pixmap(matrix=fitz.Matrix(1.3, 1.3)).save(
            root / f"revised-{record['kind']}-page-{page_index + 1}.png")
    print(f"{record['kind']}: {len(doc)} pages; {reference}; all frozen-fact/layout checks passed")
assert len({r["header"]["documentReference"] for r in records}) == len(records)
assert signature_types == {"Company Representative", "Seafarer", "Vessel Management"}
