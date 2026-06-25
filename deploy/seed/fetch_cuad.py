#!/usr/bin/env python3
"""One-time: download a small CUAD subset and commit the .txt files.

CUAD (Contract Understanding Atticus Dataset) is CC BY 4.0.
Source: https://www.atticusprojectai.org/cuad  (Zenodo record 4595826).
Run once locally; the resulting corpus/cuad/*.txt are committed to the repo.
"""
import io
import os
import zipfile
from urllib.request import urlopen

ZENODO_ZIP = "https://zenodo.org/records/4595826/files/CUAD_v1.zip?download=1"
N = int(os.environ.get("CUAD_N", "10"))
OUT = os.path.join(os.path.dirname(__file__), "corpus", "cuad")

os.makedirs(OUT, exist_ok=True)
print(f"downloading {ZENODO_ZIP} …")
with urlopen(ZENODO_ZIP) as r:
    data = r.read()
zf = zipfile.ZipFile(io.BytesIO(data))
txts = sorted(n for n in zf.namelist() if n.startswith("CUAD_v1/full_contract_txt/") and n.endswith(".txt"))
# Prefer mid-sized contracts (long enough to be real, short enough for clean
# citations on a local model): sort by size, take from the smaller third.
sized = sorted(((zf.getinfo(n).file_size, n) for n in txts))
picks = [n for _, n in sized[20:20 + N]]
for n in picks:
    base = os.path.basename(n)
    with open(os.path.join(OUT, base), "wb") as f:
        f.write(zf.read(n))
    print("wrote", base)
print(f"done: {len(picks)} contracts in {OUT}")
