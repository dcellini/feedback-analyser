import type { EmbeddingProvider } from "../embeddings/embedding-provider.js";

import type { FeedbackAnalysis } from "../analysis/internal/feedback-schema.js";
import { evaluateFeedback } from "./deterministic/evaluate-feedback.js";
import { evaluateSummary } from "./deterministic/evaluate-summary.js";
import type { LLMJudge } from "./judge/llm-judge.js";
import { evaluateThemes } from "./semantic/evaluate-themes.js";

/**
 * The reference values we use when evaluating an AI-generated analysis.
 *
 * This deliberately doesn't contain the summary because summary quality
 * is harder to evaluate through exact comparison.
 *
 * `themes` is readonly because our evaluation code only reads the themes;
 * it never needs to modify them.
 */
export type ExpectedAnalysis = {
  sentiment: FeedbackAnalysis["sentiment"];
  themes: readonly string[];
  priority: FeedbackAnalysis["priority"];
};

/**
 * Orchestrates the different evaluation methods for an AI-generated
 * feedback analysis.
 *
 * This is the coordinator for our evaluation pipeline:
 *
 *                   AI analysis
 *                        |
 *                        v
 *                evaluateAnalysis()
 *                        |
 *          +-------------+-------------+
 *          |             |             |
 *          v             v             v
 *    Deterministic    Semantic       Summary
 *      evaluation      themes       evaluation
 *          |             |             |
 *          +-------------+-------------+
 *                        |
 *                        v
 *                    LLM judge
 *                        |
 *                        v
 *                Combined results
 *
 * The diagram groups the evaluation methods for readability.
 * They are separate checks; the LLM judge does not consume
 * the results of the other evaluators.
 *
 * Each evaluator has a specific responsibility:
 *
 * - evaluateFeedback() checks sentiment, priority and exact theme coverage.
 * - evaluateThemes() checks whether expected and actual themes are
 *   semantically similar using embeddings.
 * - evaluateSummary() performs a simple deterministic summary check.
 * - LLMJudge evaluates the overall meaning and quality of the analysis.
 *
 * Keeping the results separate allows us to understand WHY an
 * analysis failed rather than receiving one unexplained pass/fail.
 */
export const evaluateAnalysis = async ({
  feedback,
  actual,
  expected,
  judge,
  embeddingProvider,
}: {
  feedback: string;
  actual: FeedbackAnalysis;
  expected: ExpectedAnalysis;
  judge: LLMJudge;
  embeddingProvider: EmbeddingProvider;
}) => {
  /*
   * STEP 1 — DETERMINISTIC EVALUATION
   *
   * Check:
   * - sentiment matches
   * - priority matches
   * - expected themes are covered using exact matching
   *
   * Example:
   *
   * Expected theme: "management"
   * Actual theme:   "management support"
   *
   * Exact theme matching fails because the wording differs.
   *
   * No AI API calls are required for these checks.
   */
  const deterministic = evaluateFeedback(actual, expected);

  /*
   * STEP 2 — SEMANTIC THEME EVALUATION
   *
   * Compare expected themes against actual themes using embeddings.
   *
   * Example:
   *
   * Expected: "management"
   * Actual:   "management support"
   *
   * Our real Gemini experiment returned similarity ≈ 0.929.
   *
   * With our current threshold of 0.85, this passes.
   *
   * This does not change the deterministic result.
   * Both results are retained so we can compare them.
   *
   * The embedding provider is injected, so tests can use a mock
   * and real executions can use Gemini or a cached provider.
   */
  const semanticThemes = await evaluateThemes({
    expectedThemes: expected.themes,
    actualThemes: actual.themes,
    embeddingProvider,
  });

  /*
   * STEP 3 — SUMMARY EVALUATION
   *
   * Check whether the generated summary includes expected theme words.
   *
   * This is currently a simple deterministic check.
   *
   * For example, a summary might describe a supportive manager
   * without containing the exact word "management".
   *
   * Such a summary could be accurate but fail this check.
   *
   * We pass the original feedback as context, although the current
   * implementation doesn't use it yet.
   */
  const summaryEvaluation = evaluateSummary(feedback, actual.summary, expected.themes);

  /*
   * STEP 4 — LLM JUDGE
   *
   * Ask the judge to assess the analysis against the original feedback.
   *
   * This can assess aspects that are difficult to check using
   * simple rules:
   *
   * - whether sentiment reflects the feedback
   * - whether the summary captures its meaning
   * - whether priority is sensible
   * - whether unsupported information was introduced
   *
   * The judge is injected through the LLMJudge interface.
   *
   * In tests we use a mock judge, avoiding real API requests.
   */
  const judgeResult = await judge.evaluate(feedback, actual);

  /*
   * STEP 5 — RETURN ALL EVALUATION RESULTS
   *
   * Example:
   *
   * deterministic.themesCovered → false
   * semanticThemes.passed        → true
   * summary.passed               → false
   * judge.passed                 → true
   *
   * This tells us:
   *
   * - Exact theme matching rejected the wording.
   * - Semantic matching recognised the related meaning.
   * - The simple summary check rejected the summary.
   * - The LLM judge considered the analysis acceptable.
   *
   * Instead of hiding these differences behind one score,
   * we return each result for inspection.
   *
   * This is important because our evaluation methods
   * can themselves produce false positives or negatives.
   */
  return {
    deterministic,
    summary: summaryEvaluation,
    judge: judgeResult,
    semanticThemes,
  };
};
