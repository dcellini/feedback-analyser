import type { EmbeddingProvider } from "../embeddings/embedding-provider.js";
import type { EmbeddedFeedback } from "../embeddings/prepare-feedback.js";
import { semanticSearch, type SearchResult } from "../embeddings/semantic-search.js";

import type { RagAnswerProvider } from "./rag-answer-provider.js";
import { buildRagPrompt } from "./internal/build-rag-prompt.js";
import { buildFeedbackContext } from "./internal/build-feedback-context.js";

/**
 * The result returned by our complete RAG workflow.
 *
 * We return both the AI-generated answer and the feedback
 * records used to generate it.
 *
 * This allows the caller to:
 *
 * - Display the answer.
 * - Show the supporting feedback.
 * - Inspect similarity scores.
 * - Verify whether the answer is grounded in its sources.
 */
export interface FeedbackQuestionResult {
  answer: string;
  sources: SearchResult[];
}

/**
 * Answers a question using retrieved employee feedback.
 *
 * This is the main orchestration function for our RAG workflow.
 *
 * It combines components we've already built:
 *
 * - semanticSearch() from Chapter 3.
 * - buildFeedbackContext() from Chapter 4.
 * - buildRagPrompt() from Chapter 4.
 * - RagAnswerProvider from Chapter 4.
 *
 * The workflow does not know whether Gemini or a mock
 * provider is generating the answer.
 *
 * That decision belongs to the caller.
 */
export const answerFeedbackQuestion = async ({
  question,
  feedback,
  embeddingProvider,
  answerProvider,
  limit = 5,
  minSimilarity = 0.7,
}: {
  question: string;
  feedback: readonly EmbeddedFeedback[];
  embeddingProvider: EmbeddingProvider;
  answerProvider: RagAnswerProvider;
  limit?: number;
  minSimilarity?: number;
}): Promise<FeedbackQuestionResult> => {
  /*
   * STEP 1 — RETRIEVE RELEVANT FEEDBACK
   *
   * semanticSearch() embeds the question and compares
   * it against the previously prepared feedback vectors.
   *
   * It returns results ranked by cosine similarity.
   *
   * The limit controls how many records are returned.
   */
  const searchResults = await semanticSearch({
    query: question,
    feedback,
    embeddingProvider,
    limit,
  });

  /*
   * STEP 2 — FILTER OUT LOW-SIMILARITY RESULTS
   *
   * Our semantic search function currently returns the
   * highest-ranked results even when they are weak matches.
   *
   * We apply a minimum similarity threshold here to
   * avoid supplying clearly unrelated feedback to Gemini.
   *
   * 0.7 is an initial experimental threshold.
   * It is not a universal definition of relevance.
   */
  const relevantResults = searchResults.filter((result) => result.similarity >= minSimilarity);

  /*
   * STEP 3 — HANDLE NO RELEVANT FEEDBACK
   *
   * If nothing passes the threshold, we return a
   * predictable answer without calling the LLM.
   *
   * This avoids unnecessary Gemini requests and
   * reduces the risk of unsupported answers.
   */
  if (relevantResults.length === 0) {
    return {
      answer: "I couldn't find relevant employee feedback to answer that question.",
      sources: [],
    };
  }

  /*
   * STEP 4 — BUILD THE SUPPORTING CONTEXT
   *
   * Convert the retrieved feedback into text containing
   * source IDs and the original employee comments.
   *
   * We exclude similarity scores from the context.
   */
  const context = buildFeedbackContext(relevantResults);

  /*
   * STEP 5 — BUILD THE RAG PROMPT
   *
   * Combine:
   *
   * - Instructions for Gemini.
   * - Retrieved employee feedback.
   * - The user's question.
   *
   * The prompt tells Gemini to answer using only the
   * supplied evidence and cite source IDs.
   */
  const prompt = buildRagPrompt({
    question,
    context,
  });

  /*
   * STEP 6 — GENERATE THE ANSWER
   *
   * The injected provider generates the response.
   *
   * In automated tests, this will be a mock provider.
   *
   * In real usage, this can be Gemini.
   *
   * This is the only step that calls the answer model.
   * semanticSearch() may also call the embedding model
   * to embed the question.
   */
  const answer = await answerProvider.generateAnswer(prompt);

  /*
   * STEP 7 — RETURN ANSWER AND SOURCES
   *
   * Keeping the original source records alongside
   * the generated answer allows us to inspect what
   * information was available to the model.
   */
  return {
    answer,
    sources: relevantResults,
  };
};
