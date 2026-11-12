import { describe, expect, it } from "vitest";
import { evaluateAnalysis } from "./evaluate-analysis.js";

import { createMockLLMJudge } from "./judge/mock-llm-judge.js";
import { expectedAnalysis } from "./fixtures/expected-analysis.js";
import { feedbackExamples } from "./fixtures/feedback-examples.js";
import { createMockEmbeddingProvider } from "../embeddings/providers/mock-embedding-provider.js";

/*
 * Group the tests for evaluateAnalysis() together.
 *
 * `describe()` doesn't change the behaviour of the tests.
 * It gives the test output a useful structure.
 */
describe("evaluateAnalysis", () => {
  /*
   * Create a mock embedding provider with predictable vectors.
   *
   * These are invented vectors, not real Gemini embeddings.
   *
   * management         → [1, 0]
   * management support → [0.9, 0.1]
   * recognition        → [0, 1]
   *
   * The management vectors are close together, so their cosine
   * similarity will be high (approximately 0.994).
   *
   * Recognition points in a different direction.
   *
   * This lets us test semantic matching without calling Gemini.
   */
  const embeddingProvider = createMockEmbeddingProvider({
    management: [1, 0],
    "management support": [0.9, 0.1],
    recognition: [0, 1],
  });

  /*
   * TEST 1 — ALL EVALUATION METHODS PASS
   *
   * Test the complete evaluation pipeline using four methods:
   *
   * - deterministic evaluation
   * - semantic theme evaluation
   * - summary evaluation
   * - LLM-as-a-judge
   *
   * We use mock providers so this test doesn't make real
   * Gemini API requests.
   */
  it("evaluates a feedback analysis using all evaluation methods", async () => {
    /*
     * Use the first example from our reusable evaluation fixtures.
     *
     * Keeping fixtures separate from tests allows us to reuse
     * realistic feedback across different evaluation methods.
     */
    const example = feedbackExamples[0];

    /*
     * Configure the mock judge to return a known result.
     *
     * We're testing whether evaluateAnalysis() correctly includes
     * the judge's response, not whether a real LLM can judge quality.
     */
    const judge = createMockLLMJudge({
      passed: true,
      score: 0.9,
      reasoning: "The analysis accurately reflects the feedback.",
    });

    /*
     * Run the complete evaluation pipeline.
     *
     * actual   = simulated AI-generated analysis
     * expected = reference analysis from our fixtures
     *
     * Both the judge and embedding provider are injected.
     */
    const result = await evaluateAnalysis({
      feedback: example.feedback,

      actual: {
        sentiment: "positive",
        themes: ["management", "recognition"],
        priority: "low",
        summary: "The employee is positive about management and feels recognition for their work.",
      },

      expected: expectedAnalysis[example.id],

      judge,
      embeddingProvider,
    });

    /*
     * All four evaluation methods should pass.
     *
     * Exact theme matching succeeds because both expected themes
     * appear in the actual themes.
     *
     * Semantic matching also succeeds because each theme matches
     * itself with cosine similarity 1.
     */
    expect(result.deterministic.passed).toBe(true);
    expect(result.semanticThemes.passed).toBe(true);
    expect(result.summary.passed).toBe(true);
    expect(result.judge.passed).toBe(true);
  });

  /*
   * TEST 2 — SEMANTIC MATCHING FIXES AN EXACT-MATCH FAILURE
   *
   * This recreates the original problem that motivated
   * our embeddings chapter.
   *
   * Expected theme: "management"
   * Actual theme:   "management support"
   *
   * Exact matching fails because the strings differ.
   *
   * Semantic matching succeeds because the mock vectors
   * point in almost the same direction.
   */
  it("recognises semantically related themes when exact matching fails", async () => {
    const example = feedbackExamples[0];

    const judge = createMockLLMJudge({
      passed: true,
      score: 0.9,
      reasoning: "The analysis accurately represents the feedback.",
    });

    /*
     * The actual analysis uses "management support" instead
     * of the expected "management".
     *
     * We retain "recognition" so the other expected theme
     * is still represented.
     */
    const result = await evaluateAnalysis({
      feedback: example.feedback,

      actual: {
        sentiment: "positive",
        themes: ["management support", "recognition"],
        priority: "low",
        summary: "The employee appreciates their supportive manager and feels recognised.",
      },

      expected: expectedAnalysis[example.id],

      judge,
      embeddingProvider,
    });

    /*
     * STEP 1 — DETERMINISTIC RESULT
     *
     * The exact theme check should fail because
     * "management" !== "management support".
     */
    expect(result.deterministic.themesCovered).toBe(false);
    expect(result.deterministic.passed).toBe(false);

    /*
     * STEP 2 — SEMANTIC RESULT
     *
     * The semantic evaluator should recognise that
     * "management" and "management support" are related.
     *
     * It should also match "recognition" to itself.
     */
    expect(result.semanticThemes.passed).toBe(true);

    /*
     * Check the individual management match.
     *
     * This verifies which actual theme was selected,
     * rather than only checking the overall result.
     */
    expect(result.semanticThemes.matches).toContainEqual({
      expected: "management",
      actual: "management support",
      similarity: expect.any(Number),
      passed: true,
    });

    /*
     * STEP 3 — LLM JUDGE
     *
     * The mock judge's result should still be included.
     */
    expect(result.judge.passed).toBe(true);
  });
});
