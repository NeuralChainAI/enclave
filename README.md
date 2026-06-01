# Enclave — Self-Hosted Private Legal AI for Law Firms & In-House Teams

> **Enclave is a self-hosted, private legal AI platform that runs entirely inside your own cloud (VPC) or on-premise — so your contract corpus, drafts, matter files, and client data never leave your security boundary.** AI co-counsel, contract review, due diligence, and drafting, grounded in *your* firm's documents and standards — not a public model's memory, and never used to train anyone else's model.

Enclave gives law firms, in-house legal teams, and M&A diligence groups a **whitelabeled, fully private AI workforce**: ask questions across your entire contract corpus, run extractions over thousands of documents, review and redline against your own playbook, draft in your firm's voice, and schedule autonomous agents — all behind your own firewall, under your own access controls.

---

## Why self-hosted, private AI

Legal work is privileged, confidential, and often contractually restricted from leaving a controlled environment. Public chatbots and multi-tenant SaaS break that model. Enclave is built the other way around:

- **Self-hosted in your VPC or on-prem** — deploy into AWS, Azure, GCP, or your own datacenter. Zero bytes of your data ever leave your boundary.
- **No training on your data** — your contracts and work product are never used to train shared or third-party models. Your corpus stays yours.
- **Attorney–client privilege preserved** — privileged and confidential material is processed inside the boundary you already trust, supporting confidentiality, professional-responsibility, and data-residency obligations.
- **Bring your own model** — route to a local open-weight LLM (Ollama), your own Amazon Bedrock / Azure OpenAI tenancy, or Claude, through a single LLM gateway (LiteLLM). No lock-in.
- **Your access controls** — document-level ACLs, SSO/SAML, and role-based access mean the AI only ever sees what a given user is allowed to see.
- **Auditable & governed** — every retrieval, answer, and agent run is logged for review, supervision, and compliance.

**Compliance posture:** SOC 2 Type II (in progress) · GDPR-ready · MIT open-core foundations · fully self-hosted.

---

## How it's built

Enclave integrates two open-source substrates and wraps them in a branded, legal-specific product layer:

- **Onyx** — the knowledge substrate. Retrieval-augmented generation (RAG) over your entire contract corpus, with 50+ enterprise connectors, document-level ACLs, and pin-cited, source-grounded answers.
- **Paperclip** — the agent substrate. Orchestration, scheduling, governance, and audit for multi-step legal workflows — an always-on AI workforce.
- **LiteLLM gateway** — model routing across local Ollama, BYO Bedrock/Azure, and Claude.

Everything runs side-by-side **inside your VPC**, connected to the systems you already use: iManage, NetDocuments, SharePoint, network drives, S3, your CLM, and email.

---

## Features

### Available in the product

- **AI Assistant (co-counsel)** — multi-turn conversational AI grounded in your corpus, with pin-cited sources and hand-offs to Diligence, Agents, and Draft.
- **Research — corpus-wide Q&A** — ask natural-language questions of your firm's whole contract corpus and get pin-cited answers with a source viewer and highlighted spans.
- **Diligence — multi-document extraction grid** — rows are documents, columns are extraction prompts; run structured extractions across thousands of contracts in a spreadsheet-style grid and export to CSV.
- **Review — clause review vs. playbook** — single-document review with severity-ranked clause findings and redlines grounded in your firm's playbook.
- **Playbooks — codified firm standards** — author rules with preferred / acceptable / fallback positions, severity, escalation, and trigger language, auto-generated from your executed precedents and consumed by Review, Assistant, and Agents.
- **Draft — AI drafting in your voice** — generate contracts and clauses from your executed precedents, with an editor canvas, precedent rail, and clause library.
- **Agents / Workflows — autonomous AI workforce** — scheduled agents that run 24/7 inside your VPC: auto-renewal watch, portfolio drift monitoring, obligation tracking, and custom agents described in plain English.
- **Connectors & ingestion** — connect your DMS, CLM, drives, and email; watch live in-VPC indexing and per-source sync status.
- **Dashboard** — an AI-forward home with an "ask your AI" box, capability tiles, KPI strip, a needs-attention band, and per-module activity.

### On the roadmap

We are actively building toward:

- **Negotiation copilot** — inline redline suggestions and counterparty-position comparison against your playbook, with one-click fallback language.
- **Obligation & deadline extraction** — automatic extraction of renewals, notice windows, and covenants, synced to calendars and alerts.
- **Clause library & clause comparison** — a managed, versioned library with side-by-side clause diffing across your corpus.
- **Privilege & PII detection / redaction** — automated flagging and redaction of privileged and personal data before sharing or export.
- **Conflict checks** — corpus-aware conflict-of-interest screening.
- **Approval & escalation routing** — configurable approval workflows tied to playbook severity and approver roles.
- **Governance & risk analytics** — dashboards on contract risk posture, deviation rates, and turnaround time.
- **Enterprise identity** — SSO/SAML, SCIM provisioning, and granular RBAC.
- **Firm-tuned models** — optional private fine-tuning / adapters trained only on your corpus, inside your boundary.
- **Integrations & API** — deeper CLM/DMS sync, e-signature, plus a public API and webhooks for embedding Enclave in your own systems.
- **Multi-language contracts** — review, extraction, and drafting across major contract languages.

---

## Who it's for

In-house legal · M&A and transactional diligence · BigLaw · procurement and vendor management · mid-market firms — any team that needs frontier AI on confidential legal work **without** sending that work to a third party.

---

## Preview the interface

The UI prototypes live in [`wireframe/`](./wireframe/). They are static HTML with no build step — open [`wireframe/index.html`](./wireframe/index.html) directly in a browser, or serve the folder:

```bash
cd wireframe
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## Keywords

self-hosted legal AI · private legal AI · on-premise legal AI · in-VPC legal AI · confidential AI for lawyers ·
secure legal AI platform · whitelabel legal AI · AI co-counsel · contract review software · AI contract review ·
AI due diligence · M&A due diligence automation · legal document automation · contract drafting AI ·
clause extraction · clause comparison · contract playbook software · redlining automation · negotiation copilot ·
legal research AI · retrieval-augmented generation · RAG for legal · contract corpus search · contract analytics ·
obligation management · legal workflow automation · AI agents for legal · law firm AI · in-house legal AI ·
LegalTech · LegalAI · data residency · attorney-client privilege · GDPR · SOC 2 · self-hosted AI · VPC deployment ·
bring your own model · open-source legal AI · Onyx · Paperclip.
