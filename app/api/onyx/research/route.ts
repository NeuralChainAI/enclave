import { NextRequest } from "next/server";
import { adminSearch, createChatSession, sendChatMessageStream, RESEARCH_PERSONA_ID } from "@/lib/onyx/client";
import { buildPassageContext, buildSourcesPrelude } from "@/lib/onyx/passages";
import type { OnyxSource } from "@/lib/onyx/types";

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
  let docs: OnyxSource[];
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
