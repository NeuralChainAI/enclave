"use client";

import { useEffect, useState } from "react";
import { parseOnyxStream } from "@/lib/onyx/stream";
import { renderWithCitations } from "@/lib/onyx/citations";
import { extractCitedNumbers } from "@/lib/onyx/passages";
import type { OnyxSource } from "@/lib/onyx/types";

type Status = "idle" | "streaming" | "done" | "error";

const SUGGESTIONS = [
  "Which counterparties are above our preferred indemnity cap?",
  "Summarize the change-of-control provisions across our active MSAs",
  "Compare governing-law clauses between our US and EU contracts",
  "Where do we deviate from our standard limitation-of-liability language?",
];

export default function ResearchPage() {
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<OnyxSource[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState("");
  const [tookMs, setTookMs] = useState<number | null>(null);
  const [activeNum, setActiveNum] = useState<number | null>(null);

  // Pick up a question handed off from the Dashboard ask-hero.
  useEffect(() => {
    const handoff = sessionStorage.getItem("enclave:ask");
    if (handoff) {
      sessionStorage.removeItem("enclave:ask");
      // Intentional one-time hydration from sessionStorage on mount; can't use a
      // lazy useState initializer because sessionStorage is unavailable during SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuestion(handoff);
      ask(handoff);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ask(q: string) {
    const query = q.trim();
    if (!query || status === "streaming") return;

    setSubmitted(query);
    setAnswer("");
    setSources([]);
    setErrMsg("");
    setTookMs(null);
    setActiveNum(null);
    setStatus("streaming");

    const started = performance.now();
    try {
      const res = await fetch("/api/onyx/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);

      for await (const packet of parseOnyxStream(res)) {
        if ("error" in packet) {
          throw new Error(String(packet.error));
        }
        switch (packet.type) {
          case "message_start":
            if (packet.final_documents) setSources(packet.final_documents);
            break;
          case "message_delta":
            setAnswer((prev) => prev + (packet.content ?? ""));
            break;
          case "error":
            throw new Error("the model stream returned an error");
        }
      }
      setStatus("done");
      setTookMs(performance.now() - started);
    } catch (e) {
      setErrMsg((e as Error).message);
      setStatus("error");
    }
  }

  const citedSet = new Set(extractCitedNumbers(answer));
  // sources are returned in retrieval order; source[n-1] is citation [n].
  const citedList = sources
    .map((doc, i) => ({ num: i + 1, doc }))
    .filter(({ num }) => citedSet.has(num));

  const showLayout = status !== "idle";

  return (
    <main className="main">
      <div className="page-head">
        <div>
          <div className="eyebrow">Powered by Onyx · hybrid BM25 + vector · ACL-aware</div>
          <h1 className="page-title">Research</h1>
          <p className="page-sub">
            Ask anything across your entire contract corpus. Every answer pin-cited to
            source documents. Your corpus stays in your VPC.
          </p>
        </div>
        <div className="page-actions">
          <span className="stat-pill">
            <strong>{sources.length || "—"}</strong> sources retrieved
          </span>
          <span className="stat-pill">
            <strong>{citedList.length || "—"}</strong> cited
          </span>
        </div>
      </div>

      <div className="qa-input" style={{ marginBottom: 8 }}>
        <span style={{ color: "var(--text-faint)", fontSize: 16 }}>⌕</span>
        <input
          value={question}
          placeholder="What's the median indemnity cap across our SaaS MSAs signed in the last 24 months?"
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") ask(question);
          }}
        />
        <button
          className="send"
          disabled={status === "streaming" || !question.trim()}
          onClick={() => ask(question)}
        >
          {status === "streaming" ? "…" : "Ask"}
        </button>
      </div>
      <div className="scope-row" style={{ marginBottom: 24 }}>
        <span className="label">Scope:</span>
        <span>All matters</span>
        <span>·</span>
        <span style={{ color: "var(--accent)" }}>+ add filter</span>
      </div>

      {!showLayout ? null : (
        <div className="vault-layout">
          <div className="chat-panel">
            <div className="message-block">
              <div className="message-q">{submitted}</div>
              <div className="message-q-meta">
                {status === "streaming"
                  ? "Retrieving and answering…"
                  : status === "error"
                    ? "Error"
                    : `${sources.length} sources retrieved · ${citedList.length} cited`}
              </div>

              {status === "error" ? (
                <div className="answer" style={{ color: "var(--sev-high)" }}>
                  {errMsg}
                </div>
              ) : (
                <div className="answer">
                  {answer ? renderWithCitations(answer, setActiveNum) : "…"}
                </div>
              )}

              {status === "done" && (
                <div className="answer-stats">
                  <span>
                    Retrieval: <strong>Hybrid BM25+vec</strong>
                  </span>
                  <span>
                    Sources: <strong>{sources.length}</strong>
                  </span>
                  <span>
                    Cited: <strong>{citedList.length}</strong>
                  </span>
                  {tookMs != null && (
                    <span>
                      Took: <strong>{(tookMs / 1000).toFixed(1)}s</strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="suggestions">
              <div className="suggestions-title">Suggested follow-ups</div>
              <ul>
                {SUGGESTIONS.map((s) => (
                  <li
                    key={s}
                    onClick={() => {
                      setQuestion(s);
                      ask(s);
                    }}
                  >
                    → {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="sources-panel">
            <div className="sources-head">
              <h3>Sources</h3>
              <span className="count">
                {citedList.length} cited · {sources.length} retrieved
              </span>
            </div>
            {sources.length === 0 ? (
              <div className="sources-empty">
                {status === "streaming"
                  ? "Retrieving from your corpus…"
                  : "No sources retrieved for this question."}
              </div>
            ) : (
              sources.map((doc, i) => {
                const num = i + 1;
                const isCited = citedSet.has(num);
                return (
                  <div
                    key={doc.document_id}
                    className={`source-item${activeNum === num ? " active" : ""}${isCited ? "" : " uncited"}`}
                    onClick={() => setActiveNum(num)}
                  >
                    <div className="source-head">
                      <span className="source-cite-num">{num}</span>
                      <span className="source-doc">{doc.semantic_identifier}</span>
                    </div>
                    <div className="source-meta">
                      {doc.source_type}
                      {isCited ? " · cited" : ""}
                    </div>
                    {doc.blurb && <div className="source-excerpt">{doc.blurb}</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </main>
  );
}
