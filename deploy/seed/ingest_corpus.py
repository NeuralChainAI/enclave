#!/usr/bin/env python3
"""Ingest deploy/seed/corpus/cuad/*.txt into Onyx via the ingestion API.

Usage:
    ONYX_ADMIN_KEY=on_... ONYX_CC_PAIR_ID=2 python3 deploy/seed/ingest_corpus.py
"""
import glob
import json
import os
from urllib.request import Request, urlopen

API = os.environ.get("ONYX_API_URL", "http://localhost:8080")
KEY = os.environ["ONYX_ADMIN_KEY"]
CC_PAIR_ID = int(os.environ["ONYX_CC_PAIR_ID"])
CORPUS = os.path.join(os.path.dirname(__file__), "corpus", "cuad")

files = sorted(glob.glob(os.path.join(CORPUS, "*.txt")))
assert files, f"no .txt files in {CORPUS} — run fetch_cuad.py first"
for path in files:
    name = os.path.splitext(os.path.basename(path))[0]
    with open(path, encoding="utf-8", errors="ignore") as f:
        body_text = f.read()
    doc = {
        "document": {
            "id": f"enclave-cuad-{name}",
            "sections": [{"text": body_text, "link": None}],
            "source": "ingestion_api",
            "semantic_identifier": name.replace("_", " "),
            "metadata": {},
            "from_ingestion_api": True,
        },
        "cc_pair_id": CC_PAIR_ID,
    }
    payload = json.dumps(doc).encode()
    req = Request(
        f"{API}/onyx-api/ingestion",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"},
        method="POST",
    )
    with urlopen(req) as r:
        print(name, "->", r.status, r.read()[:120].decode(errors="ignore"))
print(f"ingested {len(files)} documents into cc_pair {CC_PAIR_ID}")
