import { test, expect } from "bun:test";
import { matchStrength, overallConfidence } from "./confidence";
import type { OnyxSource } from "./types";

const src = (score: number | null): OnyxSource => ({
  document_id: "d",
  semantic_identifier: "Doc",
  link: null,
  blurb: "",
  source_type: "ingestion_api",
  score,
  match_highlights: [],
});

test("matchStrength buckets a score into strong/moderate/weak", () => {
  expect(matchStrength(5.6)).toBe("strong");
  expect(matchStrength(3)).toBe("strong");
  expect(matchStrength(1.19)).toBe("moderate");
  expect(matchStrength(1)).toBe("moderate");
  expect(matchStrength(0.9)).toBe("weak");
  expect(matchStrength(null)).toBe("weak");
});

test("overallConfidence is high when the top score is a strong match", () => {
  expect(overallConfidence([src(5.6), src(1.1)])).toEqual({ level: "high", topScore: 5.6 });
});

test("overallConfidence is low when the top score is weak/moderate (Apollo case)", () => {
  expect(overallConfidence([src(1.19), src(1.16)])).toEqual({ level: "low", topScore: 1.19 });
});

test("overallConfidence is none when nothing was retrieved", () => {
  expect(overallConfidence([])).toEqual({ level: "none", topScore: null });
});

test("overallConfidence takes the max score regardless of order", () => {
  expect(overallConfidence([src(0.8), src(5.0)])).toEqual({ level: "high", topScore: 5.0 });
});
