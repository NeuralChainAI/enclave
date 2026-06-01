# Enclave — Private Legal AI, Inside Your Boundary

> **Self-hosted, whitelabeled legal AI for law firms and in-house teams.** Enclave runs entirely inside your own VPC, so your contract corpus, drafts, and client data never leave your security boundary. AI co-counsel, contract review, due diligence, and drafting — grounded in *your* documents, not a public model's memory.

This repository contains the **low-fidelity UI wireframes** for Enclave. They exist to validate information architecture and visual language before any production design or build begins. They are structure and hierarchy only — not final pixels, microcopy, or production assets.

---

## What we're building

Enclave is a legal-AI platform delivered as a service and deployed **in the customer's own cloud (in-VPC / self-hosted)**. It is built on two engines:

- **Onyx** — retrieval-augmented generation (RAG) over the firm's entire contract corpus, with pin-cited, source-grounded answers.
- **Paperclip** — agent orchestration for multi-step legal workflows (an "AI workforce").

Every answer, redline, and draft is grounded in the firm's own executed agreements and standards — never a generic foundation model guessing in the dark. Because the whole stack runs inside the customer boundary, privileged and confidential data stays put.

### Core modules (wireframed here)

| Module | What it does |
| --- | --- |
| **Dashboard** | AI-forward in-app home — "ask your AI" box, capability tiles, KPI strip, needs-attention band, per-module summaries, activity feed. |
| **Assistant** | Multi-turn conversational AI co-counsel. Corpus-grounded, pin-cited, with hand-offs to Diligence, Agents, and Draft. |
| **Agents** | Your AI workforce — active runs plus a library of agent templates and a Create Custom Agent flow. Paperclip-powered. |
| **Research** | Q&A across the firm's whole contract corpus. Pin-cited answers with a source viewer. Onyx-powered. |
| **Diligence** | Multi-document extraction grid — rows are documents, columns are extraction prompts, cells fill in real time. |
| **Review** | Single-document clause check against your playbook. Clause cards scored by severity, with grounded redlines. |
| **Playbooks** | Author and edit firm standards — rules with preferred / acceptable / fallback positions, severity, and escalation, generated from your corpus and consumed by Review, Assistant, and Agents. |
| **Draft** | AI drafting in your firm's voice, generated from your executed precedents. Editor canvas, precedent rail, clause library. |
| **Settings / Connectors** | Connect data sources, watch live ingestion, and monitor per-source indexing status. |

---

## Design language

Locked design tokens live in [`_shared.css`](./_shared.css):

- **Ground** — charcoal (`#0a0a0a`) with elevated panels (`#141414` / `#1a1a1a`).
- **Accent** — a single forest green (`#1a7a52`). No gradients.
- **Severity** — high `#c53030`, medium `#c57a20`, low `#22744d`.
- **Type** — serif headlines (Georgia), system sans body. All-caps reserved for section labels.

Brand mark direction: **Colonnade** — two columns and a lintel that wall off a protected core, fusing classical legal vocabulary with the "private boundary" idea. See [`logos.html`](./logos.html) for the full exploration.

---

## Running the wireframes

These are static HTML files with no build step or dependencies. Open [`index.html`](./index.html) directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

`index.html` is the wireframe index and links to every page.

---

## Status

| | |
| --- | --- |
| Stage | Low-fidelity wireframes (IA + visual language validation) |
| Not yet included | Production microcopy, real customer logos, product screenshots, animation specs, light theme, mobile breakpoints |
| Next | Lock the brand mark, then move to production design |

---

## Keywords

Legal AI · private legal AI · self-hosted legal AI · in-VPC legal AI · on-premise contract AI ·
whitelabel legal AI platform · AI co-counsel · contract review software · AI contract review ·
AI due diligence · legal document automation · contract drafting AI · clause extraction ·
contract playbook software · redlining automation · legal research AI · retrieval-augmented generation ·
RAG for legal · contract corpus search · law firm AI · in-house legal AI · LegalTech ·
data residency · confidential AI · secure legal AI · VPC deployment.
