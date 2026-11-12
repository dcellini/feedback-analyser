import type { DemoFeedbackId } from "./demo-feedback.js";

/**
 * CHAPTER 8 — PLACEHOLDER EMBEDDINGS (to be replaced in Milestone 3)
 *
 * WHAT IS THIS?
 *
 * Semantic search (Chapter 3) needs an embedding for:
 *
 *   1. Every feedback comment (prepared once, when the service starts).
 *   2. Every search query the agent sends to the searchFeedback tool.
 *
 * In replay mode we don't call Gemini, so those embeddings have to be
 * stored in the repository instead.
 *
 * WHY "PLACEHOLDER"?
 *
 * Real Gemini embeddings have thousands of numbers each and can only be
 * produced by calling the API. Until Milestone 3 records real ones (with
 * your approval, because it makes real Gemini calls), we use small
 * hand-made vectors instead.
 *
 * Each placeholder vector has one number per theme:
 *
 *   [management, workload, communication, recognition,
 *    facilities, pay, career, wellbeing, unrelated]
 *
 * For example, fb-005 ("pressure ... affect my sleep and my health") is
 * mostly about workload and wellbeing:
 *
 *   themeVector({ workload: 0.7, wellbeing: 0.8 })
 *   → [0, 0.7, 0, 0, 0, 0, 0, 0.8, 0]
 *
 * Cosine similarity then behaves sensibly: a "workload" query vector is
 * close to fb-003 and fb-004 and far from fb-023 (parking).
 *
 * The final "unrelated" dimension is used only by queries that match no
 * comment at all (e.g. "canteen food"). No feedback vector uses it, so
 * those queries score 0 against everything — exactly what we want for
 * the "insufficient evidence" example.
 *
 * IMPORTANT: The rest of the application doesn't know these are fake.
 * It uses the same EmbeddingProvider interface as real Gemini embeddings,
 * so swapping in real recordings later needs no code changes.
 */

/**
 * The themes used as placeholder embedding dimensions, in order.
 */
const themes = [
  "management",
  "workload",
  "communication",
  "recognition",
  "facilities",
  "pay",
  "career",
  "wellbeing",
  "unrelated",
] as const;

type Theme = (typeof themes)[number];

/**
 * Builds a placeholder vector from a readable description.
 *
 * Example:
 *   themeVector({ management: 1 }) → [1, 0, 0, 0, 0, 0, 0, 0, 0]
 *
 * `Partial<Record<Theme, number>>` means "an object whose keys are some
 * of the themes, each mapped to a number". Any missing theme becomes 0.
 */
const themeVector = (weights: Partial<Record<Theme, number>>): number[] =>
  themes.map((theme) => weights[theme] ?? 0);

/**
 * One placeholder vector per feedback record.
 *
 * `Record<DemoFeedbackId, number[]>` makes TypeScript check that EVERY
 * record in the dataset has a vector, and that there are no typos.
 */
export const demoFeedbackEmbeddings: Record<DemoFeedbackId, number[]> = {
  "fb-001": themeVector({ management: 1 }),
  "fb-002": themeVector({ management: 0.9, workload: 0.3 }),
  "fb-003": themeVector({ workload: 1 }),
  "fb-004": themeVector({ workload: 0.9, management: 0.2 }),
  "fb-005": themeVector({ workload: 0.7, wellbeing: 0.8 }),
  "fb-006": themeVector({ communication: 1 }),
  "fb-007": themeVector({ communication: 0.9, facilities: 0.3 }),
  "fb-008": themeVector({ communication: 0.9 }),
  "fb-009": themeVector({ recognition: 1 }),
  "fb-010": themeVector({ recognition: 0.9, management: 0.3 }),
  "fb-011": themeVector({ facilities: 1 }),
  "fb-012": themeVector({ facilities: 0.9 }),
  "fb-013": themeVector({ pay: 1 }),
  "fb-014": themeVector({ pay: 0.8, career: 0.5 }),
  "fb-015": themeVector({ career: 1 }),
  "fb-016": themeVector({ career: 0.9 }),
  "fb-017": themeVector({ wellbeing: 0.9 }),
  "fb-018": themeVector({ wellbeing: 1 }),
  "fb-019": themeVector({ wellbeing: 0.6, workload: 0.3 }),
  "fb-020": themeVector({ management: 0.8 }),
  "fb-021": themeVector({ communication: 0.8, workload: 0.4 }),
  "fb-022": themeVector({ management: 0.8, workload: 0.5 }),
  "fb-023": themeVector({ facilities: 0.8 }),
  "fb-024": themeVector({ pay: 0.7, recognition: 0.5 }),
};

/**
 * One placeholder vector per search query used in the recordings
 * (see demo-recordings.ts).
 *
 * In replay mode, if a recording sends a query that isn't listed here,
 * the embedding provider throws. The searchFeedback tool then fails and
 * the recordings test (demo-recordings.test.ts) catches it.
 */
export const demoQueryEmbeddings: Record<string, number[]> = {
  workload: themeVector({ workload: 1 }),
  "manager support": themeVector({ management: 1 }),
  "communication from leadership": themeVector({ communication: 1 }),
  "canteen food": themeVector({ unrelated: 1 }),
  "flexible and remote working": themeVector({ wellbeing: 1 }),
};
