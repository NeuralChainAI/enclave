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
