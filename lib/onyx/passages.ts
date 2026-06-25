import type { OnyxSource, MessageStart } from "./types";

export type PassageContext = {
  context: string;
  // 1-based citation number -> document_id (passage order == citation order)
  citationMap: Record<number, string>;
};

// Build the numbered passage block injected as `additional_context`, plus the
// citation-number -> document_id map. Passage N is cited as [N] in the answer.
export function buildPassageContext(docs: OnyxSource[]): PassageContext {
  const lines = docs.map((doc, i) => {
    const label = doc.semantic_identifier || doc.document_id;
    const text = (doc.blurb || "").replace(/\s+/g, " ").trim();
    return `[${i + 1}] ${label}: ${text}`;
  });
  const citationMap: Record<number, string> = Object.fromEntries(
    docs.map((doc, i) => [i + 1, doc.document_id])
  );
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
