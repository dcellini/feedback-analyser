import type { AIProvider } from "../providers/ai-provider.js";
import type { EmbeddingProvider } from "../embeddings/embedding-provider.js";

import { feedbackExamples } from "./fixtures/feedback-examples.js";
import { evaluateAnalysis, type ExpectedAnalysis } from "./evaluate-analysis.js";
import { feedbackAnalyser } from "../analysis/feedback-analyser.js";
import type { LLMJudge } from "./judge/llm-judge.js";

/**
 * Runs employee feedback examples through the complete AI analysis
 * and evaluation pipeline.
 *
 * Three dependencies are injected:
 *
 * - aiProvider generates the feedback analysis.
 * - judge evaluates its overall quality.
 * - embeddingProvider compares themes by semantic similarity.
 *
 * This allows us to use mocks in automated tests and real Gemini
 * providers in manual runs without changing the evaluation logic.
 *
 * The examples parameter allows the caller to control which
 * feedback examples are evaluated.
 *
 * This is useful when working with real AI providers because
 * each example may require:
 *
 * 1. An AI request to generate the feedback analysis.
 * 2. Embedding requests to compare expected and actual themes.
 * 3. An LLM request to judge the analysis.
 *
 * A cached embedding provider can avoid repeated embedding requests
 * for identical theme text.
 *
 * No Gemini requests happen unless real providers are supplied.
 */

/**
 * A lookup containing expected analyses indexed by feedback ID.
 *
 * Example:
 *
 * {
 *   "positive-manager": {
 *     sentiment: "positive",
 *     themes: ["management", "recognition"],
 *     priority: "low"
 *   },
 *   "negative-communication": {
 *     sentiment: "negative",
 *     themes: ["communication"],
 *     priority: "medium"
 *   }
 * }
 *
 * ExpectedAnalysis describes ONE reference analysis.
 *
 * Record<string, ExpectedAnalysis> describes a collection where
 * each string key (feedback ID) maps to an ExpectedAnalysis.
 */
type ExpectedAnalysisLookup = Record<string, ExpectedAnalysis>;

export const runEvaluation = async ({
  aiProvider,
  judge,
  embeddingProvider,
  examples = feedbackExamples,
  expectedAnalysis,
}: {
  aiProvider: AIProvider;
  judge: LLMJudge;
  embeddingProvider: EmbeddingProvider;
  examples?: readonly (typeof feedbackExamples)[number][];
  expectedAnalysis: ExpectedAnalysisLookup;
}) => {
  const results = [];

  /*
   * STEP 1 — PROCESS EACH FEEDBACK EXAMPLE
   *
   * By default, we evaluate the entire dataset.
   *
   * Callers can supply a smaller selection to reduce the
   * number of real AI requests.
   *
   * Example:
   *
   * examples = feedbackExamples.slice(0, 1)
   *
   * This processes only the first feedback example.
   */
  for (const example of examples) {
    /*
     * STEP 2 — GENERATE THE AI ANALYSIS
     *
     * Use our existing feedbackAnalyser service.
     *
     * This validates the external AI response:
     *
     * JSON string
     *     ↓
     * JSON.parse()
     *     ↓
     * unknown
     *     ↓
     * Zod validation
     *     ↓
     * FeedbackAnalysis
     *
     * The result is a validated FeedbackAnalysis object.
     */
    const actual = await feedbackAnalyser({
      feedback: example.feedback,
      aiProvider,
    });

    /*
     * STEP 3 — FIND THE EXPECTED ANALYSIS
     *
     * Each feedback example has an ID.
     *
     * We use that ID to look up its reference analysis.
     *
     * Example:
     *
     * example.id = "positive-manager"
     *
     * expectedAnalysis["positive-manager"] returns:
     *
     * {
     *   sentiment: "positive",
     *   themes: ["management", "recognition"],
     *   priority: "low"
     * }
     */
    const expected = expectedAnalysis[example.id];

    /*
     * Ensure this feedback example has an expected analysis.
     *
     * Without this check, expected could be undefined.
     * TypeScript then prevents us from passing it to evaluateAnalysis().
     *
     * The check also gives us a useful error if a fixture is missing.
     */
    if (!expected) {
      throw new Error(`Missing expected analysis for feedback: ${example.id}`);
    }

    /*
     * STEP 4 — RUN THE EVALUATION METHODS
     *
     * evaluateAnalysis() combines:
     *
     * 1. Deterministic evaluation:
     *    Exact checks for sentiment, priority and themes.
     *
     * 2. Semantic theme evaluation:
     *    Uses embeddings to compare theme meanings.
     *
     * 3. Summary evaluation:
     *    Checks expected theme wording in the summary.
     *
     * 4. LLM judge:
     *    Evaluates the overall meaning and quality.
     *
     * We pass embeddingProvider through to evaluateAnalysis().
     *
     * evaluateAnalysis() then passes it to evaluateThemes().
     *
     * This is dependency injection: the orchestration layer
     * supplies the implementation rather than each evaluator
     * creating its own provider.
     */
    const evaluation = await evaluateAnalysis({
      feedback: example.feedback,
      actual,
      expected,
      judge,
      embeddingProvider,
    });

    /*
     * STEP 5 — COLLECT THE RESULTS
     *
     * Store both the generated analysis and its evaluation.
     *
     * Example result:
     *
     * {
     *   id: "positive-manager",
     *   actual: {
     *     sentiment: "positive",
     *     themes: ["management support", "recognition"],
     *     priority: "low",
     *     summary: "..."
     *   },
     *   evaluation: {
     *     deterministic: { ... },
     *     semanticThemes: { ... },
     *     summary: { ... },
     *     judge: { ... }
     *   }
     * }
     *
     * Keeping the individual results allows us to understand
     * why a model succeeded or failed.
     */
    results.push({
      id: example.id,
      actual,
      evaluation,
    });
  }

  /*
   * STEP 6 — RETURN ALL RESULTS
   *
   * One result is returned for each processed feedback example.
   *
   * Later, these results can be used to compare prompts,
   * models and evaluation strategies.
   */
  return results;
};
