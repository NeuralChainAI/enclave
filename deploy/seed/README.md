# Enclave grounding seed

Rebuilds the deterministic-RAG demo: connector + PUBLIC cc_pair + tool-less
"Enclave Research" persona (llama3.1:8b, strict RAG prompt) + memory tool off +
a fresh ADMIN api key, ingests the bundled CUAD corpus, and enables anonymous
Onyx access so the chat endpoints work under `AUTH_TYPE=disabled`.

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
- Anonymous access (`public:anonymous_user_enabled`) lives in Redis, which runs
  without persistence — it is lost whenever the cache container restarts. Re-run
  `seed.sh` (or just the `redis-cli set` at its tail) to restore it.
- Answer quality / citations depend on the model. `llama3.1:8b` returns correct,
  grounded answers and refuses cleanly when the corpus lacks the answer, but does
  not reliably emit inline `[n]` citation markers. The citation UI (numbered
  sources panel, `[n]` chips, index-based resolution) lights up fully when a more
  capable model is routed via LiteLLM.
