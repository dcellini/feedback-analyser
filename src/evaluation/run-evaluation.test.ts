
import { describe, expect, it } from "vitest";
import { runEvaluation } from "./run-evaluation.js";
import { createMockAIProvider } from "../providers/mock-ai-provider.js";
import { createMockEmbeddingProvider } from "../embeddings/providers/mock-embedding-provider.js";
import { feedbackExamples } from "./fixtures/feedback-examples.js";
import { expectedAnalysis } from "./fixtures/expected-analysis.js";
import { createMockLLMJudge } from "./judge/mock-llm-judge.js";

describe("runEvaluation", () => {
  it("evaluates every feedback example using injected providers", async () => {
    /*
     * STEP 1 — MOCK AI PROVIDER
     *
     * Configure a predictable AI response.
     *
     * Our mock returns the same analysis for every example.
     * That's fine here: we're testing orchestration, not AI accuracy.
     */
    const aiProvider = createMockAIProvider({
      sentiment: "positive",
      themes: ["management", "recognition"],
      priority: "low",
      summary: "The employee is positive about management and recognition.",
    });

    /*
     * STEP 2 — MOCK LLM JUDGE
     *
     * Configure a predictable judge result.
     *
     * No external API is involved.
     */
    const judge = createMockLLMJudge({
      passed: true,
      score: 0.9,
      reasoning: "The analysis is acceptable.",
    });

    /*
     * STEP 3 — MOCK EMBEDDING PROVIDER
     *
     * The semantic evaluator now needs embeddings for:
     *
     * - the expected themes from our evaluation fixtures
     * - the actual themes returned by our mock AI provider
     *
     * Rather than hardcoding a mapping for every fixture theme,
     * we collect all the theme strings and assign deterministic
     * vectors to them.
     *
     * This test isn't checking whether semantic similarity is
     * accurate. We already test that in evaluate-themes.test.ts.
     *
     * Here, we're checking that the complete evaluation pipeline
     * runs and returns semantic evaluation results.
     */

    const allThemes = [
      ...new Set([
        ...Object.values(expectedAnalysis).flatMap((analysis) => analysis.themes),
        "management",
        "recognition",
      ]),
    ];

    /*
     * Assign each unique theme its own vector.
     *
     * For example:
     *
     * management  → [1, 0, 0, ...]
     * recognition → [0, 1, 0, ...]
     *
     * Each vector has a 1 at its own index and 0 elsewhere.
     *
     * These are called one-hot vectors.
     *
     * Identical themes will have cosine similarity 1.
     * Different themes will have cosine similarity 0.
     *
     * This is useful for orchestration testing because the
     * vectors are deterministic and require no Gemini calls.
     */
    const mockEmbeddings = Object.fromEntries(
      allThemes.map((theme, index) => [
        theme,
        allThemes.map((_, vectorIndex) => (index === vectorIndex ? 1 : 0)),
      ]),
    );

    const embeddingProvider = createMockEmbeddingProvider(mockEmbeddings);

    /*
     * STEP 4 — RUN THE COMPLETE EVALUATION PIPELINE
     *
     * Pass all three providers into runEvaluation():
     *
     * - aiProvider generates the analysis
     * - judge evaluates its quality
     * - embeddingProvider supplies theme embeddings
     *
     * Also provide our reference analysis lookup.
     */
    const results = await runEvaluation({
      aiProvider,
      judge,
      embeddingProvider,
      expectedAnalysis,
    });

    /*
     * STEP 5 — VERIFY THE RESULTS
     *
     * Verify that every fixture was processed and that each result
     * contains an evaluation from the judge and semantic evaluator.
     *
     * We don't expect every deterministic or semantic check to pass
     * because our mock AI returns the same analysis each time.
     */
    expect(results).toHaveLength(feedbackExamples.length);

    expect(results.map((result) => result.id)).toEqual(
      feedbackExamples.map((example) => example.id),
    );

    for (const result of results) {
      expect(result.evaluation.judge).toEqual({
        passed: true,
        score: 0.9,
        reasoning: "The analysis is acceptable.",
      });

      /*
       * Check that semantic evaluation ran.
       *
       * We don't require it to pass for every example.
       * We only check that it returned the expected structure.
       */
      expect(result.evaluation.semanticThemes).toEqual({
        passed: expect.any(Boolean),
        matches: expect.any(Array),
      });
    }
  });
});
