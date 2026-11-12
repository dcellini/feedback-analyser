import "dotenv/config";

import { feedbackExamples } from "./fixtures/feedback-examples.js";
import { expectedAnalysis } from "./fixtures/expected-analysis.js";

import { createGeminiAIProvider } from "../providers/gemini-ai-provider.js";
import { createGeminiEmbeddingProvider } from "../embeddings/providers/gemini-embedding-provider.js";
import { createCachedEmbeddingProvider } from "../embeddings/providers/cached-embedding-provider.js";

import { runEvaluation } from "./run-evaluation.js";
import { createGeminiLLMJudge } from "./judge/gemini-llm-judge.js";

/**
 * Manual entry point for evaluating the real Gemini model.
 *
 * Unlike automated tests, this script uses real Gemini providers
 * and therefore makes external API requests when executed.
 *
 * We deliberately evaluate only one feedback example per run
 * to conserve our Gemini API quota.
 *
 * The workflow now uses three AI-powered operations:
 *
 * 1. Generate the feedback analysis using Gemini.
 * 2. Generate embeddings to compare expected and actual themes.
 * 3. Ask the Gemini LLM judge to evaluate the analysis.
 *
 * Embedding requests are made for each unique theme string.
 *
 * For example, if our expected themes are:
 *
 *   ["management", "recognition"]
 *
 * And Gemini returns:
 *
 *   ["management support", "recognition"]
 *
 * The embedding provider needs three unique embeddings:
 *
 *   "management"
 *   "recognition"
 *   "management support"
 *
 * Because "recognition" appears twice, our cached provider
 * can reuse its embedding.
 *
 * Expected usage for one example:
 *
 * - 1 Gemini request for feedback analysis.
 * - 1 Gemini request for the LLM judge.
 * - Up to one embedding request per unique theme string.
 *
 * The exact number of requests depends on the themes returned
 * by Gemini and the behaviour of our embedding provider.
 *
 * Run manually with:
 *
 * npx tsx src/evaluation/run-evaluation.manual.ts
 *
 * IMPORTANT: This script consumes real Gemini API quota.
 */

/*
 * STEP 1 — CREATE REAL GEMINI PROVIDERS
 *
 * This is where we decide which implementations to use.
 *
 * runEvaluation() only depends on interfaces:
 *
 * - AIProvider
 * - LLMJudge
 * - EmbeddingProvider
 *
 * It doesn't need to know that Gemini is supplying them.
 *
 * Creating these providers does not itself make API requests.
 */
const aiProvider = createGeminiAIProvider();
const judge = createGeminiLLMJudge();

/*
 * Wrap the Gemini embedding provider with our caching decorator.
 *
 * The underlying Gemini provider generates real embeddings.
 *
 * The cached provider stores previously generated vectors in
 * an in-memory Map, keyed by the original theme string.
 *
 * Example:
 *
 * First embed("management"):
 *   Cache miss → Gemini request → Store vector.
 *
 * Second embed("management"):
 *   Cache hit → Return stored vector, no Gemini request.
 *
 * The cache exists only for this execution of the script.
 * Running the script again creates a fresh, empty cache.
 */
const embeddingProvider = createCachedEmbeddingProvider(
  createGeminiEmbeddingProvider(process.env.GEMINI_API_KEY!),
);

/*
 * STEP 2 — SELECT FEEDBACK EXAMPLES
 *
 * We currently process only the first example.
 *
 * This limits the number of Gemini requests.
 *
 * With one example, we expect:
 *
 * - 2 LLM requests (analysis and judge).
 * - Additional embedding requests for unique theme strings.
 *
 * If we process multiple examples, the same cached embedding
 * provider can reuse embeddings across the entire run.
 */
const examples = feedbackExamples.slice(0, 1);

/*
 * STEP 3 — RUN THE COMPLETE EVALUATION WORKFLOW
 *
 * runEvaluation() will:
 *
 * 1. Ask the AI provider to analyse the feedback.
 * 2. Parse and validate the AI response using Zod.
 * 3. Compare sentiment, priority and themes deterministically.
 * 4. Compare theme meanings using embeddings.
 * 5. Evaluate the summary with simple deterministic checks.
 * 6. Ask the LLM judge to evaluate the overall analysis.
 * 7. Return all the individual evaluation results.
 *
 * We pass expectedAnalysis as a lookup keyed by feedback ID.
 *
 * IMPORTANT: Real Gemini requests begin here.
 */
const results = await runEvaluation({
  aiProvider,
  judge,
  embeddingProvider,
  examples,
  expectedAnalysis,
});

/*
 * STEP 4 — CALCULATE SUMMARY METRICS
 *
 * We calculate a separate pass rate for each evaluation method.
 *
 * Keeping these separate helps us understand differences between
 * exact matching, semantic matching and LLM judgement.
 */
const total = results.length;

const deterministicPasses = results.filter(
  (result) => result.evaluation.deterministic.passed,
).length;

const semanticPasses = results.filter((result) => result.evaluation.semanticThemes.passed).length;

const summaryPasses = results.filter((result) => result.evaluation.summary.passed).length;

const judgePasses = results.filter((result) => result.evaluation.judge.passed).length;

const averageJudgeScore =
  total === 0 ? 0 : results.reduce((sum, result) => sum + result.evaluation.judge.score, 0) / total;

/*
 * Calculate a percentage safely.
 *
 * Returning N/A for an empty dataset avoids division by zero.
 */
const percentage = (passed: number): string =>
  total === 0 ? "N/A" : `${Math.round((passed / total) * 100)}%`;

/*
 * STEP 5 — PRINT DETAILED RESULTS
 *
 * The detailed output shows exactly which checks passed
 * and failed for each feedback example.
 */
console.log("\n========== Evaluation Results ==========");

for (const result of results) {
  console.log(`\nFeedback: ${result.id}`);
  console.log(JSON.stringify(result, null, 2));
}

/*
 * STEP 6 — PRINT SUMMARY REPORT
 *
 * Example:
 *
 * Examples evaluated: 1
 * Deterministic pass rate: 0%
 * Semantic theme pass rate: 100%
 * Summary pass rate: 0%
 * LLM judge pass rate: 100%
 *
 * This would demonstrate that semantic matching recognised
 * the meaning of themes rejected by exact string matching.
 */
console.log("\n========== Evaluation Summary ==========");
console.log(`Examples evaluated: ${total}`);
console.log(`Deterministic pass rate: ${percentage(deterministicPasses)}`);
console.log(`Semantic theme pass rate: ${percentage(semanticPasses)}`);
console.log(`Summary pass rate: ${percentage(summaryPasses)}`);
console.log(`LLM judge pass rate: ${percentage(judgePasses)}`);
console.log(`Average judge score: ${averageJudgeScore.toFixed(2)}`);
