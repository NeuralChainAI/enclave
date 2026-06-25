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
