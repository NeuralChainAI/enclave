import type { OnyxSource } from "./types";

// Retrieval-relevance thresholds for the Research confidence signal.
//
// Onyx's hybrid (BM25 + dense-vector) scores are unbounded, not 0..1. Calibrated
// against the demo CUAD corpus + the nomic-embed-text-v1 embedding model: a
// specific match against a real document scores ~5+, while generic / weak term
// overlap (e.g. a query naming a document that isn't in the corpus) tops out
// around ~1-2, and a fully-unrelated query returns no documents at all.
//
// These are empirical — re-tune them if the corpus or the embedding model changes.
export const STRONG_MATCH_SCORE = 3;
export const MODERATE_MATCH_SCORE = 1;

export type MatchStrength = "strong" | "moderate" | "weak";
export type ConfidenceLevel = "high" | "low" | "none";

// Per-source retrieval relevance, bucketed for display.
export function matchStrength(score: number | null | undefined): MatchStrength {
  const s = score ?? 0;
  if (s >= STRONG_MATCH_SCORE) return "strong";
  if (s >= MODERATE_MATCH_SCORE) return "moderate";
  return "weak";
}

// Overall answer confidence, derived from the best-matching retrieved passage:
// - none: nothing cleared Onyx's relevance cutoff (no documents)
// - high: the top passage is a strong match → the answer is well-grounded
// - low:  only weak/generic matches → surface a caution banner
export function overallConfidence(sources: OnyxSource[]): {
  level: ConfidenceLevel;
  topScore: number | null;
} {
  if (sources.length === 0) return { level: "none", topScore: null };
  const topScore = Math.max(...sources.map((s) => s.score ?? 0));
  return { level: topScore >= STRONG_MATCH_SCORE ? "high" : "low", topScore };
}
