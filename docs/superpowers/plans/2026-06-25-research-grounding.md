# Research Grounding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Enclave Research page return reliable, pin-cited answers from real CUAD contracts via an app-orchestrated deterministic two-step RAG, with a committed, reproducible seed.

**Architecture:** The Next.js server retrieves passages itself (`POST /admin/search`, admin key), builds a numbered passage block, and sends it as `additional_context` to the tool-less Onyx persona id 1 ("Enclave Research"), which answers only from those passages and cites `[n]`. The model never routes a tool. A committed Python seed (run inside `api_server`) rebuilds the connector/cc_pair/persona/memory-flags/admin-key, and a host-side ingester loads bundled CUAD contracts.

**Tech Stack:** Next.js 16.2.7 (App Router, `runtime="nodejs"` routes), React 19, TypeScript, bun (`bun test`), Onyx 4.0.x HTTP API (OpenSearch retrieval), Python (Onyx internal DB layer for the seed).

**Verified facts (live api_server, 2026-06-25):**
- `POST /admin/search` → `AdminSearchRequest {query, filters}`; returns `{documents: SavedSearchDoc[]}` (fields incl. `document_id, semantic_identifier, link, blurb, source_type, score, match_highlights`). **Requires an admin API key — returns 403 without one even under `AUTH_TYPE=disabled`.**
- `POST /chat/send-chat-message` → `SendMessageRequest` supports `additional_context: string` together with `stream: true` and `include_citations: true`.
- `POST /chat/create-chat-session` → `{persona_id}`.
- `POST /onyx-api/ingestion` → `IngestionDocument {document: DocumentBase, cc_pair_id}`.
- Survived in DB: persona id 1 "Enclave Research" (tool-less), connector id 1 + cc_pair id 2 (PUBLIC), models `llama3.2:1b/3b`, `llama3.1:8b` (model_configuration id 4). Lost: the admin key token; corpus is empty (cc_pair 2 = 0 docs).
- Onyx internal signatures (in the pinned image): `create_connector(db_session, connector_data: ConnectorBase)`; `add_credential_to_connector(db_session, user, connector_id, credential_id, cc_pair_name, access_type, groups, ..., seeding_flow=False)`; `upsert_persona(user, name, description, starter_messages, system_prompt, task_prompt, datetime_aware, is_public, db_session, tool_ids=None, persona_id=None, default_model_configuration_id=None, ...)`; `insert_api_key(db_session, APIKeyArgs{name, role}, user_id) -> ApiKeyDescriptor(.api_key)`; `UserRole.ADMIN`; `ConnectorBase {name, source, input_type, connector_specific_config, refresh_freq, prune_freq, indexing_start}`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/onyx/passages.ts` *(new)* | Pure grounded-flow helpers: `buildPassageContext`, `extractCitedNumbers`, `buildSourcesPrelude`. No network. |
| `lib/onyx/passages.test.ts` *(new)* | `bun test` unit tests for the pure helpers. |
| `lib/onyx/client.ts` *(modify)* | Add `adminSearch`, `RESEARCH_PERSONA_ID`, admin auth header, optional `additionalContext` on `sendChatMessageStream`. |
| `app/api/onyx/research/route.ts` *(new)* | Orchestrates search → passages → grounded send; streams `prelude + answer`. Timeout/abort wired. |
| `app/research/page.tsx` *(modify)* | Call `/api/onyx/research`; resolve `[n]` → source by index. |
| `.env.local.example` *(modify)* | Document `ONYX_ADMIN_API_KEY`, `ONYX_RESEARCH_TOP_K`. |
| `deploy/seed/fetch_cuad.py` *(new)* | One-time: download CUAD subset → `corpus/cuad/*.txt` + `ATTRIBUTION.md`. Output committed. |
| `deploy/seed/enclave_seed_grounding.py` *(new)* | Inside `api_server`: connector + PUBLIC cc_pair + tool-less persona (8b, RAG prompt) + memory-off + mint admin key. Prints `ENCLAVE_ADMIN_KEY` + `ENCLAVE_CC_PAIR_ID`. Idempotent. |
| `deploy/seed/ingest_corpus.py` *(new)* | Host-side: POST each `corpus/cuad/*.txt` to `/onyx-api/ingestion`. |
| `deploy/seed/seed.sh` *(new)* | Orchestrator: run seed, capture key/cc_pair → `.env.local`, ingest corpus. |
| `deploy/seed/corpus/cuad/*.txt` *(new, committed)* | ~10 real CUAD contracts. |
| `deploy/seed/corpus/ATTRIBUTION.md` *(new)* | CUAD CC-BY-4.0 credit. |
| `deploy/seed/README.md` *(new)* | One-command recipe. |

---

## Task 1: Setup branch + confirm test runner

**Files:** none (git + smoke)

- [ ] **Step 1: Create a feature branch (commits in this repo are authored as harry).**

Run:
```bash
cd /Users/ishwinder/apps/Enclave
git config user.name   # expect: harry-neuralchainai
git config user.email  # expect: harleen@neuralchainai.com
git checkout -b feat/research-grounding
```
Expected: switched to a new branch `feat/research-grounding`.

- [ ] **Step 2: Confirm `bun test` works with a throwaway test.**

Create `lib/onyx/_smoke.test.ts`:
```ts
import { test, expect } from "bun:test";
test("smoke", () => { expect(1 + 1).toBe(2); });
```
Run: `bun test lib/onyx/_smoke.test.ts`
Expected: `1 pass`.

- [ ] **Step 3: Remove the smoke test (no commit).**

Run: `rm lib/onyx/_smoke.test.ts`

---

## Task 2: Pure passage helpers (TDD core)

**Files:**
- Create: `lib/onyx/passages.ts`
- Test: `lib/onyx/passages.test.ts`

- [ ] **Step 1: Write the failing tests.**

Create `lib/onyx/passages.test.ts`:
```ts
import { test, expect } from "bun:test";
import {
  buildPassageContext,
  extractCitedNumbers,
  buildSourcesPrelude,
} from "./passages";
import type { OnyxSource } from "./types";

function src(partial: Partial<OnyxSource>): OnyxSource {
  return {
    document_id: "d",
    semantic_identifier: "Doc",
    link: null,
    blurb: "",
    source_type: "ingestion_api",
    score: null,
    match_highlights: [],
    ...partial,
  };
}

test("buildPassageContext numbers passages 1-based and maps citations", () => {
  const docs = [
    src({ document_id: "a", semantic_identifier: "MSA A", blurb: "Liability capped at $5,000,000." }),
    src({ document_id: "b", semantic_identifier: "MSA B", blurb: "Governed by Delaware law." }),
  ];
  const { context, citationMap } = buildPassageContext(docs);
  expect(context).toBe(
    "[1] MSA A: Liability capped at $5,000,000.\n\n[2] MSA B: Governed by Delaware law."
  );
  expect(citationMap).toEqual({ 1: "a", 2: "b" });
});

test("buildPassageContext collapses whitespace and falls back to document_id", () => {
  const docs = [src({ document_id: "x", semantic_identifier: "", blurb: "  multi\n  line   blurb " })];
  const { context } = buildPassageContext(docs);
  expect(context).toBe("[1] x: multi line blurb");
});

test("buildPassageContext handles empty input", () => {
  expect(buildPassageContext([])).toEqual({ context: "", citationMap: {} });
});

test("extractCitedNumbers returns sorted unique numbers present in the answer", () => {
  expect(extractCitedNumbers("Per [2] and [1], also [2] again.")).toEqual([1, 2]);
  expect(extractCitedNumbers("no citations here")).toEqual([]);
});

test("buildSourcesPrelude emits a single Onyx message_start envelope line", () => {
  const docs = [src({ document_id: "a", semantic_identifier: "MSA A" })];
  const line = buildSourcesPrelude(docs);
  expect(line.endsWith("\n")).toBe(true);
  const parsed = JSON.parse(line.trim());
  expect(parsed.obj.type).toBe("message_start");
  expect(parsed.obj.final_documents[0].document_id).toBe("a");
});
```

- [ ] **Step 2: Run the tests to verify they fail.**

Run: `bun test lib/onyx/passages.test.ts`
Expected: FAIL — `Cannot find module './passages'`.

- [ ] **Step 3: Implement `lib/onyx/passages.ts`.**

```ts
import type { OnyxSource, MessageStart } from "./types";

export type PassageContext = {
  context: string;
  // 1-based citation number -> document_id (passage order == citation order)
  citationMap: Record<number, string>;
};

// Build the numbered passage block injected as `additional_context`, plus the
// citation-number -> document_id map. Passage N is cited as [N] in the answer.
export function buildPassageContext(docs: OnyxSource[]): PassageContext {
  const citationMap: Record<number, string> = {};
  const lines = docs.map((doc, i) => {
    const n = i + 1;
    citationMap[n] = doc.document_id;
    const label = doc.semantic_identifier || doc.document_id;
    const text = (doc.blurb || "").replace(/\s+/g, " ").trim();
    return `[${n}] ${label}: ${text}`;
  });
  return { context: lines.join("\n\n"), citationMap };
}

// Distinct [n] markers present in the answer text, ascending.
export function extractCitedNumbers(answer: string): number[] {
  const found = new Set<number>();
  for (const m of answer.matchAll(/\[(\d+)\]/g)) found.add(parseInt(m[1], 10));
  return [...found].sort((a, b) => a - b);
}

// First NDJSON line of the research stream: an Onyx-shaped `message_start`
// envelope carrying our retrieved docs, so the page's existing parseOnyxStream
// sets the sources panel immediately (the tool-less persona returns no docs).
export function buildSourcesPrelude(docs: OnyxSource[]): string {
  const obj: MessageStart = {
    type: "message_start",
    final_documents: docs,
    pre_answer_processing_seconds: null,
  };
  return JSON.stringify({ placement: 0, obj }) + "\n";
}
```

- [ ] **Step 4: Run the tests to verify they pass.**

Run: `bun test lib/onyx/passages.test.ts`
Expected: `5 pass`.

- [ ] **Step 5: Commit.**

```bash
git add lib/onyx/passages.ts lib/onyx/passages.test.ts
git commit -m "feat: pure passage/citation helpers for grounded research"
```

---

## Task 3: Onyx client — adminSearch + grounded send

**Files:**
- Modify: `lib/onyx/client.ts`
- Test: `lib/onyx/client.test.ts` *(new)*

- [ ] **Step 1: Write the failing test (stub `fetch`).**

Create `lib/onyx/client.test.ts`:
```ts
import { test, expect, mock, afterEach } from "bun:test";

afterEach(() => { delete (process.env as Record<string, string>).ONYX_ADMIN_API_KEY; });

test("adminSearch posts query+filters with the admin bearer and returns documents", async () => {
  process.env.ONYX_ADMIN_API_KEY = "sk-test";
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = mock(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ documents: [{ document_id: "a" }] }), { status: 200 });
  }) as unknown as typeof fetch;

  const { adminSearch } = await import("./client?admin");
  const docs = await adminSearch("liability cap");

  expect(calls[0].url).toContain("/admin/search");
  expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
  expect(JSON.parse(calls[0].init.body as string)).toEqual({ query: "liability cap", filters: {} });
  expect(docs[0].document_id).toBe("a");
});

test("adminSearch throws a clear error when the admin key is missing", async () => {
  const { adminSearch } = await import("./client?nokey");
  await expect(adminSearch("x")).rejects.toThrow(/ONYX_ADMIN_API_KEY/);
});
```
> Note: the `?admin` / `?nokey` import suffixes force bun to re-evaluate the module so the env var read at call time is honored. `adminSearch` reads the env inside the function (below), so this is belt-and-suspenders.

- [ ] **Step 2: Run the test to verify it fails.**

Run: `bun test lib/onyx/client.test.ts`
Expected: FAIL — `adminSearch` is not exported.

- [ ] **Step 3: Implement the additions in `lib/onyx/client.ts`.**

Append/extend so the file reads:
```ts
// Server-only Onyx client. Credentials stay here; the browser never talks to
// Onyx directly — it goes through the /api/onyx/* route handlers.
import type { OnyxSource } from "./types";

const ONYX_API_URL = process.env.ONYX_API_URL ?? "http://localhost:3001/api";
const ONYX_API_KEY = process.env.ONYX_API_KEY;

// Tool-less "Enclave Research" persona (seeded). The app drives retrieval; this
// persona only answers from the passages we inject as additional_context.
export const RESEARCH_PERSONA_ID = 1;

function authHeaders(): Record<string, string> {
  return ONYX_API_KEY ? { Authorization: `Bearer ${ONYX_API_KEY}` } : {};
}

// /admin/* requires an API key with ADMIN role even when AUTH_TYPE=disabled.
function adminAuthHeaders(): Record<string, string> {
  const key = process.env.ONYX_ADMIN_API_KEY;
  if (!key) {
    throw new Error(
      "ONYX_ADMIN_API_KEY is not set — grounded research needs an admin key (run deploy/seed/seed.sh)."
    );
  }
  return { Authorization: `Bearer ${key}` };
}

export async function createChatSession(personaId = 0): Promise<string> {
  const res = await fetch(`${ONYX_API_URL}/chat/create-chat-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ persona_id: personaId }),
  });
  if (!res.ok) {
    throw new Error(
      `create-chat-session failed: ${res.status} ${await res.text().catch(() => "")}`
    );
  }
  const data = (await res.json()) as { chat_session_id: string };
  return data.chat_session_id;
}

// Deterministic retrieval over the corpus. Returns the top-K docs.
export async function adminSearch(
  query: string,
  filters: Record<string, unknown> = {},
  k = Number(process.env.ONYX_RESEARCH_TOP_K ?? 5)
): Promise<OnyxSource[]> {
  const res = await fetch(`${ONYX_API_URL}/admin/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ query, filters }),
  });
  if (!res.ok) {
    throw new Error(`admin/search failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as { documents: OnyxSource[] };
  return (data.documents ?? []).slice(0, k);
}

export async function sendChatMessageStream(opts: {
  message: string;
  chatSessionId?: string | null;
  includeCitations?: boolean;
  additionalContext?: string;
  signal?: AbortSignal;
}): Promise<Response> {
  const body: Record<string, unknown> = {
    message: opts.message,
    stream: true,
    include_citations: opts.includeCitations ?? true,
  };
  if (opts.chatSessionId) body.chat_session_id = opts.chatSessionId;
  if (opts.additionalContext) body.additional_context = opts.additionalContext;

  return fetch(`${ONYX_API_URL}/chat/send-chat-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `bun test lib/onyx/client.test.ts`
Expected: `2 pass`.

- [ ] **Step 5: Commit.**

```bash
git add lib/onyx/client.ts lib/onyx/client.test.ts
git commit -m "feat: adminSearch + additional_context grounded send in Onyx client"
```

---

## Task 4: Research API route (orchestration + stream)

**Files:**
- Create: `app/api/onyx/research/route.ts`

> **Before coding:** per `AGENTS.md`, read `node_modules/next/dist/docs/` for the App-Router Route Handler + streaming `Response` conventions in Next 16 (`grep -rl "Route Handler\|ReadableStream" node_modules/next/dist/docs/ | head`). Confirm `runtime` export and streaming `Response` usage match this version before writing.

- [ ] **Step 1: Implement the route.**

```ts
import { NextRequest } from "next/server";
import { adminSearch, createChatSession, sendChatMessageStream, RESEARCH_PERSONA_ID } from "@/lib/onyx/client";
import { buildPassageContext, buildSourcesPrelude } from "@/lib/onyx/passages";

export const runtime = "nodejs";

const ANSWER_TIMEOUT_MS = Number(process.env.ONYX_RESEARCH_TIMEOUT_MS ?? 120_000);

export async function POST(req: NextRequest) {
  let payload: { question?: string };
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const question = payload.question?.trim();
  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  // Step 1: deterministic retrieval.
  let docs;
  try {
    docs = await adminSearch(question);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }

  // Step 2: numbered passages.
  const { context } = buildPassageContext(docs);

  // Step 3 + 4: grounded send to the tool-less persona, abort-wired + timed out.
  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), ANSWER_TIMEOUT_MS);
  req.signal.addEventListener("abort", () => ac.abort());

  let upstream: Response;
  try {
    const chatSessionId = await createChatSession(RESEARCH_PERSONA_ID);
    upstream = await sendChatMessageStream({
      message: question,
      chatSessionId,
      includeCitations: true,
      additionalContext: docs.length ? `SOURCE PASSAGES:\n\n${context}` : undefined,
      signal: ac.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    return Response.json({ error: `onyx unreachable: ${(e as Error).message}` }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    clearTimeout(timeout);
    const text = await upstream.text().catch(() => "");
    return Response.json({ error: `onyx ${upstream.status}: ${text}` }, { status: 502 });
  }

  // Prepend our retrieved docs as a message_start, then pipe Onyx's answer.
  const prelude = new TextEncoder().encode(buildSourcesPrelude(docs));
  const upstreamBody = upstream.body;
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(prelude);
      const reader = upstreamBody.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (e) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ error: String(e) }) + "\n"));
      } finally {
        clearTimeout(timeout);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Typecheck.**

Run: `bunx tsc --noEmit`
Expected: no errors in `app/api/onyx/research/route.ts` or `lib/onyx/*`.

- [ ] **Step 3: Commit.**

```bash
git add app/api/onyx/research/route.ts
git commit -m "feat: /api/onyx/research two-step grounded route with sources prelude"
```

---

## Task 5: Point the Research page at the grounded route

**Files:**
- Modify: `app/research/page.tsx`

- [ ] **Step 1: Add a cited-number import at the top.**

Change the imports block to add `extractCitedNumbers`:
```ts
import { renderWithCitations } from "@/lib/onyx/citations";
import { extractCitedNumbers } from "@/lib/onyx/passages";
```

- [ ] **Step 2: Replace the `ask` fetch target and request body.**

Replace the block (lines ~65-70) that calls `ensureSession()` + `fetch("/api/onyx/chat", ...)` with a single grounded call:
```ts
      const res = await fetch("/api/onyx/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
```
Delete the now-unused `ensureSession` function and the `sessionRef` ref (the route creates the session server-side).

- [ ] **Step 3: Resolve citations from retrieved sources by index (passage N == citation [N]).**

Replace the `byDocId` / `citedList` derivation (lines ~103-107) with:
```ts
  const citedNums = extractCitedNumbers(answer);
  const citedSet = new Set(citedNums);
  // sources are returned in retrieval order; source[n-1] is citation [n].
  const citedList = sources
    .map((doc, i) => ({ num: i + 1, doc }))
    .filter(({ num }) => citedSet.has(num));
```
Leave the `citation_info` case in the stream `switch` as-is (harmless if Onyx emits it).

- [ ] **Step 4: Show all retrieved sources (not only cited) so a grounded-but-uncited answer still shows provenance.**

In the sources panel, change the empty-check + list to render from `sources` with cited highlighting. Replace the `{citedList.length === 0 ? (...) : citedList.map(...)}` block with:
```tsx
            {sources.length === 0 ? (
              <div className="sources-empty">
                {status === "streaming"
                  ? "Retrieving from your corpus…"
                  : "No sources retrieved for this question."}
              </div>
            ) : (
              sources.map((doc, i) => {
                const num = i + 1;
                return (
                  <div
                    key={doc.document_id}
                    className={`source-item${activeNum === num ? " active" : ""}${citedSet.has(num) ? "" : " uncited"}`}
                    onClick={() => setActiveNum(num)}
                  >
                    <div className="source-head">
                      <span className="source-cite-num">{num}</span>
                      <span className="source-doc">{doc.semantic_identifier}</span>
                    </div>
                    <div className="source-meta">
                      {doc.source_type}
                      {citedSet.has(num) ? " · cited" : ""}
                    </div>
                    {doc.blurb && <div className="source-excerpt">{doc.blurb}</div>}
                  </div>
                );
              })
            )}
```

- [ ] **Step 4b: Update the header source-count pill to show retrieved count.**

The pills at lines ~123-128 already read `sources.length` and `citedList.length` — leave them; they now reflect retrieved vs cited correctly.

- [ ] **Step 5: Typecheck + lint.**

Run: `bunx tsc --noEmit && bun run lint`
Expected: no errors (no unused `sessionRef`/`ensureSession`).

- [ ] **Step 6: Commit.**

```bash
git add app/research/page.tsx
git commit -m "feat: Research page uses deterministic grounded route + index-based citations"
```

---

## Task 6: Fetch + commit the CUAD corpus

**Files:**
- Create: `deploy/seed/fetch_cuad.py`
- Create (output, committed): `deploy/seed/corpus/cuad/*.txt`, `deploy/seed/corpus/ATTRIBUTION.md`

- [ ] **Step 1: Write `deploy/seed/fetch_cuad.py`.**

```python
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
```

- [ ] **Step 2: Run it.**

Run: `python3 deploy/seed/fetch_cuad.py`
Expected: `done: 10 contracts in .../corpus/cuad`. Verify: `ls deploy/seed/corpus/cuad/*.txt | wc -l` → `10`.

> If the Zenodo URL is unreachable, fall back to the HuggingFace mirror
> `https://huggingface.co/datasets/theatticusproject/cuad/resolve/main/CUAD_v1.zip`
> (same archive layout) and re-run.

- [ ] **Step 3: Write `deploy/seed/corpus/ATTRIBUTION.md`.**

```markdown
# Corpus attribution

The contracts under `cuad/` are from the **Contract Understanding Atticus Dataset
(CUAD) v1**, by The Atticus Project, licensed **CC BY 4.0**
(https://creativecommons.org/licenses/by/4.0/).

Source: https://www.atticusprojectai.org/cuad · Zenodo record 4595826.
Files are unmodified excerpts used here as a demo corpus for Enclave's grounded
Research feature. No endorsement by The Atticus Project is implied.
```

- [ ] **Step 4: Commit corpus + fetcher.**

```bash
git add deploy/seed/fetch_cuad.py deploy/seed/corpus/cuad deploy/seed/corpus/ATTRIBUTION.md
git commit -m "feat: bundle CUAD demo corpus (CC BY 4.0) + one-time fetcher"
```

---

## Task 7: Grounding seed script (inside api_server)

**Files:**
- Create: `deploy/seed/enclave_seed_grounding.py`

- [ ] **Step 1: Write the seed.**

```python
#!/usr/bin/env python3
"""Enclave grounding seed (local-dev/demo; not part of upstream Onyx).

Run INSIDE the api_server container (imports Onyx internals):
    docker cp deploy/seed/enclave_seed_grounding.py onyx-api_server-1:/tmp/seed.py
    docker exec onyx-api_server-1 python /tmp/seed.py

Idempotently ensures: the "Enclave Demo Corpus" connector (id>0) + a PUBLIC
cc_pair (so SearchTool.is_available is true), the tool-less "Enclave Research"
persona (id 1) pinned to llama3.1:8b with a strict RAG prompt, the memory tool
disabled for all users (prevents add_memory JSON leaking into answers), and a
freshly minted ADMIN api key. Prints ENCLAVE_ADMIN_KEY and ENCLAVE_CC_PAIR_ID
on the last two lines for the orchestrator to capture.
"""
from sqlalchemy import text

from shared_configs.configs import POSTGRES_DEFAULT_SCHEMA
from shared_configs.contextvars import CURRENT_TENANT_ID_CONTEXTVAR
from onyx.db.engine.sql_engine import SqlEngine, get_session_with_current_tenant
from onyx.db.connector import create_connector, check_connectors_exist
from onyx.db.connector_credential_pair import add_credential_to_connector
from onyx.db.persona import upsert_persona, get_personas
from onyx.db.api_key import insert_api_key
from onyx.server.api_key.models import APIKeyArgs
from onyx.server.documents.models import ConnectorBase
from onyx.db.enums import AccessType
from onyx.connectors.models import InputType
from onyx.configs.constants import DocumentSource
from onyx.auth.schemas import UserRole

CONNECTOR_NAME = "Enclave Demo Corpus"
PERSONA_NAME = "Enclave Research"
ANSWER_MODEL = "llama3.1:8b"
RAG_PROMPT = (
    "You are Enclave Research, a legal research assistant. Answer the user's "
    "question USING ONLY the numbered SOURCE PASSAGES given in the additional "
    "context. Cite every claim with the bracketed number of the passage it comes "
    "from, e.g. [1] or [2]. If the passages do not contain the answer, say you "
    "could not find it in the corpus. Never use outside knowledge; never invent "
    "facts, figures, citations, or document names. Do not call any tools."
)

SqlEngine.init_engine(pool_size=2, max_overflow=2)
CURRENT_TENANT_ID_CONTEXTVAR.set(POSTGRES_DEFAULT_SCHEMA)

with get_session_with_current_tenant() as db:
    # 1. Connector (id>0) — reuse by name if present.
    row = db.execute(
        text("select id from connector where name=:n order by id limit 1"),
        {"n": CONNECTOR_NAME},
    ).first()
    if row:
        connector_id = row[0]
    else:
        created = create_connector(
            db_session=db,
            connector_data=ConnectorBase(
                name=CONNECTOR_NAME,
                source=DocumentSource.INGESTION_API,
                input_type=InputType.LOAD_STATE,
                connector_specific_config={},
                refresh_freq=None,
                prune_freq=None,
                indexing_start=None,
            ),
        )
        connector_id = created.id
        db.commit()

    # 2. PUBLIC cc_pair on the default public credential (id 0) — reuse by name.
    row = db.execute(
        text("select id from connector_credential_pair where name=:n order by id limit 1"),
        {"n": CONNECTOR_NAME},
    ).first()
    if row:
        cc_pair_id = row[0]
    else:
        add_credential_to_connector(
            db_session=db,
            user=None,
            connector_id=connector_id,
            credential_id=0,
            cc_pair_name=CONNECTOR_NAME,
            access_type=AccessType.PUBLIC,
            groups=None,
            seeding_flow=True,
        )
        db.commit()
        cc_pair_id = db.execute(
            text("select id from connector_credential_pair where name=:n order by id desc limit 1"),
            {"n": CONNECTOR_NAME},
        ).first()[0]

    # 3. Tool-less persona pinned to the 8b model, with the RAG prompt.
    model_cfg = db.execute(
        text("select id from model_configuration where name=:m order by id limit 1"),
        {"m": ANSWER_MODEL},
    ).first()
    model_cfg_id = model_cfg[0] if model_cfg else None
    existing = next((p for p in get_personas(db_session=db) if p.name == PERSONA_NAME), None)
    upsert_persona(
        user=None,
        name=PERSONA_NAME,
        description="Deterministic, corpus-grounded legal research (app-driven retrieval).",
        starter_messages=None,
        system_prompt=RAG_PROMPT,
        task_prompt="",
        datetime_aware=False,
        is_public=True,
        db_session=db,
        tool_ids=[],
        persona_id=existing.id if existing else None,
        default_model_configuration_id=model_cfg_id,
    )
    db.commit()

    # 4. Memory tool off for every user (covers the anonymous/default user).
    db.execute(text("update \"user\" set enable_memory_tool=false, use_memories=false"))
    db.commit()

    # 5. Mint a fresh ADMIN key (the old token is unrecoverable).
    desc = insert_api_key(db, APIKeyArgs(name="enclave-seed", role=UserRole.ADMIN), user_id=None)
    db.commit()

    assert check_connectors_exist(db_session=db), "no connector with id>0 — search tool would stay unavailable"
    print(f"OK connector_id={connector_id} cc_pair_id={cc_pair_id} model_cfg_id={model_cfg_id}")
    print(f"ENCLAVE_CC_PAIR_ID={cc_pair_id}")
    print(f"ENCLAVE_ADMIN_KEY={desc.api_key}")
```

- [ ] **Step 2: Dry-run the seed against the running stack.**

Run:
```bash
docker cp deploy/seed/enclave_seed_grounding.py onyx-api_server-1:/tmp/seed.py
docker exec onyx-api_server-1 python /tmp/seed.py
```
Expected: a final `ENCLAVE_ADMIN_KEY=on_...` line and `ENCLAVE_CC_PAIR_ID=<n>`. If any import path differs in this image, fix it here (the verified signatures are in the plan header) and re-run — it is idempotent.

- [ ] **Step 3: Commit.**

```bash
git add deploy/seed/enclave_seed_grounding.py
git commit -m "feat: idempotent grounding seed (connector, cc_pair, persona, key)"
```

---

## Task 8: Corpus ingester + orchestrator + README

**Files:**
- Create: `deploy/seed/ingest_corpus.py`
- Create: `deploy/seed/seed.sh`
- Create: `deploy/seed/README.md`

- [ ] **Step 1: Write `deploy/seed/ingest_corpus.py` (runs on host, against :8080).**

```python
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
```

- [ ] **Step 2: Write `deploy/seed/seed.sh` (orchestrator).**

```bash
#!/usr/bin/env bash
# Rebuild Enclave's grounded-research demo state end to end.
#   ./deploy/seed/seed.sh
# Assumes the Onyx stack is up (docker compose) and corpus/cuad/*.txt exist.
set -euo pipefail
cd "$(dirname "$0")/../.."
CONTAINER="${ONYX_API_CONTAINER:-onyx-api_server-1}"

echo "→ seeding connector / cc_pair / persona / key (inside $CONTAINER)…"
docker cp deploy/seed/enclave_seed_grounding.py "$CONTAINER":/tmp/seed.py
OUT="$(docker exec "$CONTAINER" python /tmp/seed.py)"
echo "$OUT"
KEY="$(echo "$OUT" | grep '^ENCLAVE_ADMIN_KEY=' | cut -d= -f2-)"
CC="$(echo "$OUT" | grep '^ENCLAVE_CC_PAIR_ID=' | cut -d= -f2-)"
test -n "$KEY" && test -n "$CC" || { echo "seed did not emit key/cc_pair"; exit 1; }

echo "→ writing ONYX_ADMIN_API_KEY to .env.local…"
touch .env.local
# replace any existing line, then append fresh
grep -v '^ONYX_ADMIN_API_KEY=' .env.local > .env.local.tmp || true
mv .env.local.tmp .env.local
echo "ONYX_ADMIN_API_KEY=$KEY" >> .env.local

echo "→ ingesting corpus into cc_pair $CC…"
ONYX_ADMIN_KEY="$KEY" ONYX_CC_PAIR_ID="$CC" python3 deploy/seed/ingest_corpus.py

echo "✓ grounding seeded. Restart 'bun dev' so it picks up .env.local."
```

- [ ] **Step 3: Write `deploy/seed/README.md`.**

```markdown
# Enclave grounding seed

Rebuilds the deterministic-RAG demo: connector + PUBLIC cc_pair + tool-less
"Enclave Research" persona (llama3.1:8b, strict RAG prompt) + memory tool off +
a fresh ADMIN api key, then ingests the bundled CUAD corpus.

## Prerequisites
- Onyx stack up: `cd deploy/docker_compose && docker compose up -d`
- `llama3.1:8b` available to the Ollama provider (pull it, or run native Ollama
  on :11435 per the run-setup notes), and set as the persona's model.
- Corpus present: `deploy/seed/corpus/cuad/*.txt` (committed; regenerate with
  `python3 deploy/seed/fetch_cuad.py`).

## Run
```bash
./deploy/seed/seed.sh
```
This mints `ONYX_ADMIN_API_KEY` into `.env.local` (gitignored) and ingests the
corpus. Restart `bun dev`. Open `/research` and ask a corpus question.

## Notes
- The seed is idempotent — re-running reuses the connector/cc_pair/persona by name
  and re-mints the key. Config persists in Postgres; only re-run after a volume wipe
  or to rotate the key.
- The app never lets the model route a search tool: `/api/onyx/research` calls
  `/admin/search` itself and injects passages as `additional_context`.
```

- [ ] **Step 4: Make scripts executable + commit.**

```bash
chmod +x deploy/seed/seed.sh deploy/seed/ingest_corpus.py deploy/seed/fetch_cuad.py
git add deploy/seed/ingest_corpus.py deploy/seed/seed.sh deploy/seed/README.md
git commit -m "feat: corpus ingester + one-command grounding seed orchestrator"
```

---

## Task 9: Document env vars

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Append the grounding env vars.**

Add to `.env.local.example`:
```bash

# Admin API key for deterministic Research retrieval (POST /admin/search).
# /admin/* requires an ADMIN-role key even when AUTH_TYPE=disabled.
# Minted + written to .env.local automatically by deploy/seed/seed.sh.
ONYX_ADMIN_API_KEY=

# How many passages to retrieve per Research question (default 5).
# ONYX_RESEARCH_TOP_K=5
```

- [ ] **Step 2: Commit.**

```bash
git add .env.local.example
git commit -m "docs: document ONYX_ADMIN_API_KEY and ONYX_RESEARCH_TOP_K"
```

---

## Task 10: Live end-to-end verification (definition of done)

**Files:** none (verification + evidence capture)

- [ ] **Step 1: Ensure `llama3.1:8b` is available to Onyx.**

Run: `docker exec onyx-ollama-1 ollama list | grep -E '8b' || echo "8b not pulled"`
If missing, either `docker exec onyx-ollama-1 ollama pull llama3.1:8b` (needs RAM/disk) or run native Ollama on :11435 per the run-setup notes and point the provider's `api_base` there. Confirm the "Enclave Research" persona resolves the 8b model.

- [ ] **Step 2: Seed everything.**

Run: `./deploy/seed/seed.sh`
Expected: ends with `✓ grounding seeded`, `.env.local` contains `ONYX_ADMIN_API_KEY=on_...`.

- [ ] **Step 3: Confirm the corpus is indexed.**

Run:
```bash
docker exec onyx-relational_db-1 psql -U postgres -d postgres -P pager=off -t \
  -c "select count(*) from document where from_ingestion_api;"
```
Expected: ≥ 10. Then confirm retrieval returns docs:
```bash
KEY=$(grep ONYX_ADMIN_API_KEY .env.local | cut -d= -f2-)
curl -s -X POST http://localhost:8080/admin/search -H "Authorization: Bearer $KEY" \
  -H 'Content-Type: application/json' -d '{"query":"limitation of liability","filters":{}}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('docs:',len(d['documents']));print([x['semantic_identifier'] for x in d['documents'][:3]])"
```
Expected: `docs: >0` with real CUAD contract names.

- [ ] **Step 4: Start the app and run the positive check.**

Run: `bun dev` (separate shell), then:
```bash
curl -s -X POST http://localhost:3000/api/onyx/research -H 'Content-Type: application/json' \
  -d '{"question":"What law governs these agreements and what are the liability caps?"}' --no-buffer | head -c 4000
```
Expected: first line is a `message_start` with `final_documents` (the retrieved CUAD docs); subsequent `message_delta` lines form an answer that contains `[n]` citations referencing those passages. Capture the assembled answer text as evidence.

- [ ] **Step 5: Run the negative check (no hallucination).**

```bash
curl -s -X POST http://localhost:3000/api/onyx/research -H 'Content-Type: application/json' \
  -d '{"question":"What is the capital of France according to our contracts?"}' --no-buffer | head -c 3000
```
Expected: the answer says it could not find it in the corpus — **no invented facts, no tool-call JSON** (`add_memory`, `internal_search`, etc.).

- [ ] **Step 6: Browser smoke.**

Open `http://localhost:3000/research`, ask the positive question, confirm: streamed answer, `[n]` chips clickable, sources panel lists the retrieved CUAD contracts with the cited ones marked, no console errors.

- [ ] **Step 7: Final full test + typecheck.**

Run: `bun test && bunx tsc --noEmit`
Expected: all unit tests pass, no type errors.

- [ ] **Step 8: Capture evidence + (optionally) open a PR.**

Record the positive/negative answers in the task notes. Do not push unless asked; if asked, verify the pushing handle is `harry-neuralchainai` first (see commit-identity rule).

---

## Self-review (coverage vs spec)

- **Two-step app-orchestrated RAG** → Tasks 3 (adminSearch + grounded send), 4 (route). ✓
- **Tool-less persona, RAG prompt, memory-off, 8b** → Task 7. ✓
- **Reproducible committed seed + CUAD corpus + attribution** → Tasks 6, 7, 8. ✓
- **Re-mint admin key → .env.local (gitignored)** → Tasks 7, 8 (`seed.sh`), 9 (example). ✓
- **Research page rewire + citation resolution + no-sources state** → Task 5. ✓
- **Streaming preserved (`additional_context` + `stream:true`)** → Tasks 3, 4. ✓
- **Error handling: missing key (500), 0 docs (clean refusal), timeout/abort** → Tasks 3 (key error), 4 (timeout/abort, 0-docs branch), 7/RAG prompt (refusal). ✓
- **Unit tests (pure helpers) + live positive/negative verification** → Tasks 2, 3, 10. ✓
- **Non-goals untouched** (Assistant route unchanged; no Connect/Settings/new modules; engine unchanged). ✓
- **Identity:** branch + harry author; no push without ask → Tasks 1, 10. ✓

**Type consistency:** `OnyxSource` reused everywhere; `buildPassageContext`/`extractCitedNumbers`/`buildSourcesPrelude` names match between `passages.ts`, its test, the route, and the page; `adminSearch`/`RESEARCH_PERSONA_ID`/`sendChatMessageStream({additionalContext})` names match between `client.ts` and the route. `ENCLAVE_ADMIN_KEY`/`ENCLAVE_CC_PAIR_ID` emitted by the seed match what `seed.sh` greps and what `ingest_corpus.py` reads (`ONYX_ADMIN_KEY`/`ONYX_CC_PAIR_ID`). No placeholders remain.
