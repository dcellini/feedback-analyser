import "dotenv/config";

import { prepareFeedback } from "../embeddings/prepare-feedback.js";
import { createGeminiEmbeddingProvider } from "../embeddings/providers/gemini-embedding-provider.js";
import { createCachedEmbeddingProvider } from "../embeddings/providers/cached-embedding-provider.js";

import { createGeminiRagAnswerProvider } from "./gemini-rag-answer-provider.js";
import { answerFeedbackQuestion } from "./answer-feedback-question.js";

/**
 * MANUAL RAG INTEGRATION
 *
 * Demonstrates our complete Retrieval-Augmented Generation
 * workflow using real Gemini providers.
 *
 * Unlike automated tests, running this script makes real
 * Gemini API requests.
 *
 * The workflow:
 *
 * 1. Prepare employee feedback by generating embeddings.
 * 2. Embed the user's question.
 * 3. Find the most relevant feedback using cosine similarity.
 * 4. Build context containing the retrieved feedback.
 * 5. Construct the RAG prompt.
 * 6. Ask Gemini to answer using the retrieved evidence.
 * 7. Return the answer and supporting feedback records.
 *
 * Expected Gemini API usage:
 *
 * - 3 embedding requests to prepare the feedback.
 * - 1 embedding request for the question.
 * - Up to 1 request to generate the answer.
 *
 * Maximum expected total: 5 requests.
 *
 * If no feedback meets our similarity threshold,
 * the answer-generation request is skipped.
 *
 * Run manually:
 *
 * npx tsx src/rag/answer-feedback-question.manual.ts
 *
 * IMPORTANT: This consumes real Gemini API quota.
 */

/*
 * STEP 1 — DEFINE A SMALL FEEDBACK DATASET
 *
 * In a production application, this would come from
 * a database or another persistent data source.
 *
 * We use three realistic examples to keep the number
 * of Gemini embedding requests low.
 */
const feedback = [
  {
    id: "feedback-001",
    text: "My manager is supportive and always listens to my concerns.",
  },
  {
    id: "feedback-002",
    text: "Senior management rarely recognises the extra effort our team puts in.",
  },
  {
    id: "feedback-003",
    text: "The office parking facilities are inadequate.",
  },
];

/*
 * STEP 2 — CREATE OUR REAL GEMINI PROVIDERS
 *
 * We use the same embedding provider for:
 *
 * - Preparing employee feedback.
 * - Embedding the user's question.
 *
 * The cached wrapper avoids repeated embedding requests
 * for identical text during this execution.
 *
 * Creating providers does not itself make API requests.
 */
const embeddingProvider = createCachedEmbeddingProvider(
  createGeminiEmbeddingProvider(process.env.GEMINI_API_KEY!),
);

const answerProvider = createGeminiRagAnswerProvider();

/*
 * STEP 3 — PREPARE FEEDBACK
 *
 * Generate an embedding for each feedback response.
 *
 * This is where our first Gemini requests happen.
 *
 * The returned objects contain:
 *
 * {
 *   id: string;
 *   text: string;
 *   embedding: number[];
 * }
 *
 * We do this once and reuse the resulting array.
 */
const preparedFeedback = await prepareFeedback({
  feedback,
  embeddingProvider,
});

/*
 * STEP 4 — DEFINE THE QUESTION
 *
 * Try changing this after the first successful run.
 *
 * Remember: each execution starts a new in-memory cache,
 * so feedback embeddings will be regenerated.
 */
const question = "What are employees saying about management?";

/*
 * STEP 5 — RUN THE COMPLETE RAG WORKFLOW
 *
 * answerFeedbackQuestion() will:
 *
 * - Embed the question.
 * - Search the prepared feedback.
 * - Filter weak matches.
 * - Build context and a grounded prompt.
 * - Ask Gemini to generate an answer.
 *
 * This may make additional Gemini API requests.
 *
 * minSimilarity is an experimental retrieval threshold,
 * not a guaranteed measure of relevance.
 */
const result = await answerFeedbackQuestion({
  question,
  feedback: preparedFeedback,
  embeddingProvider,
  answerProvider,
  limit: 3,
  minSimilarity: 0.7,
});

/*
 * STEP 6 — PRINT THE RESULTS
 *
 * Display the question, generated answer and supporting
 * feedback records.
 *
 * Returning sources alongside the answer allows us
 * to inspect which evidence Gemini was given.
 */
console.log("\n========== RAG Question ==========");
console.log(question);

console.log("\n========== Generated Answer ==========");
console.log(result.answer);

console.log("\n========== Retrieved Sources ==========");

for (const source of result.sources) {
  console.log(`\nSource: ${source.id}`);
  console.log(`Similarity: ${source.similarity.toFixed(3)}`);
  console.log(`Feedback: ${source.text}`);
}

/*
 * STEP 7 — SHOW A SUMMARY
 *
 * This confirms how many feedback records passed
 * the retrieval threshold.
 */
console.log("\n========== RAG Summary ==========");
console.log(`Feedback records available: ${feedback.length}`);
console.log(`Sources retrieved: ${result.sources.length}`);
console.log(`Minimum similarity: 0.7`);
