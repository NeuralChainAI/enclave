# Enclave — Deterministic Grounding for Research (design spec)

**Date:** 2026-06-25
**Status:** Approved (design) — pending spec review → implementation plan
**Author:** harry-neuralchainai
**Scope owner:** Enclave (`~/apps/Enclave`), talks to Onyx over its HTTP API.

---

## 1. Problem

The Research and Assistant pages are wired to Onyx, but retrieval is delegated to
the Onyx persona's own search tool against **persona 0** (agentic). On a small local
model this is unreliable: the model frequently emits the tool-call as plain text and
never executes a search, then hallucinates or says "I can't access documents." The
flagship grounded surface therefore does **not** reliably return cited answers.

Confirmed live state (2026-06-25, running stack):

- `app/api/onyx/session/route.ts` hardcodes `persona_id = 0`; `app/api/onyx/chat/route.ts`
  is a pass-through proxy. There is **no** `/admin/search` step and **no** passage injection.
- Onyx retrieval engine is **OpenSearch** (`OPENSEARCH_HOST=opensearch`; index
  `danswer_chunk_nomic_ai_nomic_embed_text_v1`, nomic-embed-text-v1 embeddings).
  **Not Vespa, not Postgres.** Postgres holds only relational metadata.
- The demo corpus is effectively empty: `connector_credential_pair` id 2
  ("Enclave Demo Corpus", PUBLIC) has **0 docs indexed**; the only document anywhere is a
  single `Globex-Initech MSA (DEMO TEST)` stub. OpenSearch chunk index holds 1 chunk.

Survived in Postgres from the June-5 spike (reusable):

- Tool-less persona **id 1 "Enclave Research"** (no rows in `persona__tool` → no tools).
- Connector **id 1 "Enclave Demo Corpus"** + cc_pair **id 2** (PUBLIC, INGESTION_API).
- LLM provider "Ollama (local)" with model configs `llama3.2:1b`, `llama3.2:3b`, `llama3.1:8b`.
- API key **record** `enclave-seed` (id 1) — but the token value lived in `/tmp` and is **lost**.

## 2. Goal / definition of done

By the end, the **Research page returns grounded, pin-cited answers from real CUAD
contracts**, reproducibly:

- A positive question (answerable from the corpus) → a streamed answer with `[n]`
  citations that resolve to the actual source document in the sources panel.
- A negative question (no support) → a clean "couldn't find it in the corpus" refusal,
  **no hallucination, no tool-call JSON leak**.
- The whole grounding setup (persona, connector/cc_pair, corpus, memory-tool-off, key mint)
  rebuilds from committed scripts + bundled corpus with one command — it does not depend on
  surviving DB state or lost `/tmp` files.

Verified live against the running api_server before the work is called done.

## 3. Non-goals (YAGNI guardrails)

- No changes to the **Assistant** page — persona 0, agentic general chat, stays as-is.
- No per-user auth / ACL propagation to Onyx (single shared service key remains).
- No Connect/Settings, no new modules (Diligence/Review/Playbooks/Draft/Agents).
- No re-theming or rebuild of Onyx's own UI.
- No change to the retrieval engine (OpenSearch is baked into the pinned Onyx image;
  Enclave does not choose or alter it).

## 4. Chosen approach

**App-orchestrated deterministic two-step RAG** (the validated June-5 design). The
Next.js server does retrieval itself and hands explicit passages to a tool-less persona,
so the model never routes a tool — it only reads provided passages and cites them.

Rejected alternatives:
- **Persona-driven search** (give the persona `internal_search`): this *is* the documented
  failure mode on small local models. Rejected.
- **Non-streaming two-step** (`stream:false`): simpler but loses Research's token streaming.
  Kept only as a fallback if streaming-with-`additional_context` misbehaves on 8b.

## 5. Architecture & data flow

```
Research page (client)
   │  POST /api/onyx/research  { question }
   ▼
/api/onyx/research  (Next server route, runtime="nodejs")
   │  1. POST {ONYX}/admin/search { query, filters:{} }            [ONYX_ADMIN_API_KEY]
   │       → top K docs (default K=5, env-tunable): { semantic_identifier, blurb,
   │         source_type, document_id }
   │  2. buildPassageContext(docs) → numbered block "[1] <semantic_id>: <blurb> …"
   │                                + citation_n → document_id map
   │  3. ensure chat session on persona 1 ("Enclave Research", tool-less)
   │       POST {ONYX}/chat/create-chat-session { persona_id: 1 }
   │  4. POST {ONYX}/chat/send-chat-message
   │       { message: <question>, chat_session_id, stream: true, include_citations: true,
   │         additional_context: "SOURCE PASSAGES:\n\n" + ctx }
   ▼
   - return the search docs to the page (sources panel; [n] resolves immediately)
   - pipe the NDJSON answer stream back (existing parseOnyxStream on the client)
```

The Assistant page keeps using `/api/onyx/session` + `/api/onyx/chat` unchanged.

### Verified API contracts (from the live api_server OpenAPI)

- `POST /admin/search` → `AdminSearchRequest { query: string (req), filters: BaseFilters (req) }`.
  Requires an admin API key.
- `POST /chat/create-chat-session` → `ChatSessionCreationRequest { persona_id?, description?, project_id? }`.
- `POST /chat/send-chat-message` → `SendMessageRequest`, relevant fields:
  `message (req)`, `chat_session_id`, `chat_session_info` (inline session create incl. `persona_id`),
  `stream: bool`, `include_citations: bool`, **`additional_context: string|null`**,
  `allowed_tool_ids`, `forced_tool_id`. **`additional_context` + `stream:true` are both supported.**
- `POST /onyx-api/ingestion` (+ `GET`, `DELETE /{document_id}`) for corpus ingestion.

## 6. Components

### 6a. App layer (Next 16.2.7 / React 19 — read `node_modules/next/dist/docs/` before coding, per AGENTS.md)

- **`lib/onyx/passages.ts`** *(new, pure, unit-tested)* — `buildPassageContext(docs)` →
  `{ context: string, citationMap: Record<number, string> }`. No network. The TDD core.
- **`lib/onyx/client.ts`** *(edit)* — add:
  - `adminSearch(query, filters?, k=5)` → `POST /admin/search` using `ONYX_ADMIN_API_KEY`;
    returns the top `k` docs (`k` from `ONYX_RESEARCH_TOP_K`, default 5).
  - `RESEARCH_PERSONA_ID = 1`.
  - `sendGroundedMessage({ question, passageContext, chatSessionId })` → `send-chat-message`
    with `additional_context`, `stream:true`, `include_citations:true`.
  - Read new server-only env `ONYX_ADMIN_API_KEY` (admin search needs an admin key; the
    existing optional `ONYX_API_KEY` is insufficient for `/admin/*`).
- **`app/api/onyx/research/route.ts`** *(new)* — orchestrates steps 1–4; returns the doc
  list (first chunk / header) then pipes the answer stream. Adds upstream **timeout +
  abort** wiring (a gap in the current routes).
- **`app/research/page.tsx`** *(edit)* — point `ask()` at `/api/onyx/research`; render the
  returned passages as the sources panel; keep `renderWithCitations`. Add a "no sources"
  empty state.

### 6b. Seed / reproducibility layer (committed, idempotent)

- **`deploy/seed/enclave_seed_grounding.py`** *(new)* — runs **inside** the `api_server`
  container (imports Onyx internals, like the existing `enclave_seed_ollama.py`). Idempotently
  ensures, looking up by name and updating in place:
  1. connector "Enclave Demo Corpus" (id>0) + PUBLIC cc_pair (so `check_connectors_exist`
     is true → `SearchTool.is_available` true; required even though the app drives search).
  2. tool-less persona "Enclave Research" (`tool_ids=[]`) with the RAG system prompt
     ("answer only from the numbered passages, cite [n], say you couldn't find it otherwise,
     never invent facts").
  3. demo/anonymous user: `enable_memory_tool=false`, `use_memories=false` (prevents the
     MemoryTool `add_memory` JSON leak documented on 8b).
  4. ingest every file in `corpus/` against that cc_pair via the ingestion path.
- **`deploy/seed/corpus/cuad/*.txt`** *(new)* — ~8–10 real CUAD contracts (CC BY 4.0),
  fetched once and committed, chosen for varied governing-law / indemnity / renewal /
  limitation-of-liability terms to support multi-document questions.
- **`deploy/seed/corpus/ATTRIBUTION.md`** *(new)* — CUAD CC-BY-4.0 attribution.
- **`deploy/seed/README.md`** *(new)* — one-command seed + admin-key-mint recipe
  (replaces the lost `/tmp` lore).

### 6c. Admin key & model

- **Admin key:** re-mint the `enclave-seed` key (old token unrecoverable), write to
  `.env.local` as `ONYX_ADMIN_API_KEY` (gitignored; documented in `.env.local.example`).
  The mint is scripted so it is repeatable.
- **Model:** the answer step uses **`llama3.1:8b`** (noisy CUAD text needs the larger model;
  the deterministic search means the model only reads provided passages, which 8b handles).
  Confirm 8b is pulled and the provider default resolves; if the in-stack ollama lacks it,
  document the native-Ollama-on-:11435 path from the local-run notes.

## 7. Error handling

- `/admin/search` returns 0 docs → still send to the persona; its prompt yields a clean
  "not found in the corpus" answer. UI shows a "no sources" state.
- `ONYX_ADMIN_API_KEY` missing → route returns 500 "grounding not configured" — an explicit
  error, **not** a silent fallback to ungrounded chat.
- Upstream timeout / client abort wired through to the Onyx fetch (today: neither exists).
- `parseOnyxStream` currently swallows malformed lines silently; the new route should at
  least log upstream non-2xx and stream errors.

## 8. Testing & verification

- **Unit (no network, TDD core):** `buildPassageContext` — numbering, `citation_n→document_id`
  map, empty-docs case, blurb truncation/escaping.
- **Integration (live stack is up):**
  1. Run the seed; assert cc_pair 2 doc count > 0 and OpenSearch chunk index grew.
  2. Ask Research a **positive** question → expect a grounded, `[n]`-cited answer from a real
     CUAD doc. Capture the actual answer text as evidence.
  3. Ask a **negative** question → expect a clean refusal, no hallucination, no tool JSON.
- No success claim until the positive/negative live checks pass with captured output.

## 9. Risks / open items

- CUAD contracts are long and noisy → citation quality on 8b is the main risk; mitigated by
  app-side retrieval + top-N blurb passages + a strict RAG prompt. Fallback: `stream:false`.
- Exact Onyx internal function signatures for the seed (`create_connector`,
  `add_credential_to_connector`, `upsert_persona`) must be re-verified against the pinned
  image at implement time — the June-5 notes may have drifted.
- In-stack ollama may only have `llama3.2:1b` pulled; provisioning 8b (pull or native :11435)
  is an environment step, tracked but outside the app code.
- `/admin/search` response field names (`blurb` vs `match_highlights` vs full chunk) to be
  confirmed against a live call when wiring `adminSearch`.

## 10. Commit / identity

All commits in this repo are authored **and** committed as
`harry-neuralchainai <harleen@neuralchainai.com>`. No push unless explicitly requested;
verify the pushing handle is harry before any push.
