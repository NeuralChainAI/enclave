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
    "question USING ONLY the numbered SOURCE PASSAGES provided in the additional "
    "context.\n\n"
    "CITATION FORMAT — MANDATORY:\n"
    "- After EVERY sentence that uses a passage, append that passage's number in "
    "square brackets. Example: 'The term is two years [1].' or 'Liability is capped "
    "at $5,000,000 [3].'\n"
    "- A sentence may cite more than one passage, e.g. [1][2].\n"
    "- Refer to passages ONLY by their bracketed number. NEVER refer to a passage by "
    "the document's name or title in your prose.\n"
    "- Every factual sentence MUST carry at least one [n] citation.\n\n"
    "If the passages do not contain the answer, say you could not find it in the "
    "corpus. Never use outside knowledge; never invent facts, figures, citations, or "
    "document names. Do not call any tools."
)

SqlEngine.init_engine(pool_size=2, max_overflow=2)
CURRENT_TENANT_ID_CONTEXTVAR.set(POSTGRES_DEFAULT_SCHEMA)

with get_session_with_current_tenant() as db:
    # Several Onyx helpers below may commit internally; the explicit db.commit()
    # after each is intentional belt-and-suspenders — it keeps each step durable
    # regardless of the pinned image's internal commit behavior, so a partial
    # failure always leaves a coherent state that a clean re-run recovers from.

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
    if model_cfg_id is None:
        print(
            f"WARNING: model '{ANSWER_MODEL}' not found in model_configuration — the "
            "persona will fall back to the provider default (run enclave_seed_ollama.py "
            "and pull the model first)."
        )
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

    # 4. Mint a fresh ADMIN key. The old token is unrecoverable, so each run rotates
    # the key and the orchestrator (seed.sh) captures the new one. Prior enclave-seed
    # key + service-user rows remain as harmless local-dev cruft — wipe the db_volume
    # to reset. We deliberately avoid a cross-table cascade delete of old key users
    # here (FK-fragile against the black-box image, for negligible benefit locally).
    desc = insert_api_key(db, APIKeyArgs(name="enclave-seed", role=UserRole.ADMIN), user_id=None)
    db.commit()

    # 5. Memory tool off for every user. Runs AFTER the key is minted because the
    # enable_memory_tool/use_memories columns default to true, so a newly created
    # user (including this key's service user) would otherwise keep memory on and
    # let add_memory JSON leak into answers. This blanket UPDATE covers the
    # anonymous/default user and the key user in one pass.
    db.execute(text("update \"user\" set enable_memory_tool=false, use_memories=false"))
    db.commit()

    assert check_connectors_exist(db_session=db), "no connector with id>0 — search tool would stay unavailable"
    print(f"OK connector_id={connector_id} cc_pair_id={cc_pair_id} model_cfg_id={model_cfg_id}")
    print(f"ENCLAVE_CC_PAIR_ID={cc_pair_id}")
    print(f"ENCLAVE_ADMIN_KEY={desc.api_key}")
