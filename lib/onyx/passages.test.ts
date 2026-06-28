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

test("buildSourcesPrelude round-trips blurbs containing quotes and newlines", () => {
  const docs = [src({ document_id: "a", blurb: 'He said "hello"\nworld\tand more' })];
  const line = buildSourcesPrelude(docs);
  expect(line.endsWith("\n")).toBe(true);
  const parsed = JSON.parse(line.trim());
  expect(parsed.obj.final_documents[0].blurb).toBe('He said "hello"\nworld\tand more');
});
