import type { SearchResult } from "../../embeddings/semantic-search.js";

/**
 * Converts semantic search results into text that can be
 * supplied to an LLM as supporting context.
 *
 * This is part of our Retrieval-Augmented Generation (RAG)
 * workflow.
 *
 * Semantic search has already identified the feedback
 * most relevant to the user's question.
 *
 * Our responsibility here is simply to format that
 * feedback so the LLM can read it and identify sources.
 *
 * Example input:
 *
 * [
 *   {
 *     id: "feedback-001",
 *     text: "My manager is supportive.",
 *     similarity: 0.94
 *   }
 * ]
 *
 * Example output:
 *
 * Source: feedback-001
 * Feedback: My manager is supportive.
 *
 * We deliberately exclude the similarity score because
 * it is a retrieval measurement, not employee feedback.
 *
 * This function is deterministic:
 *
 * - No Gemini requests.
 * - No embeddings.
 * - No asynchronous operations.
 *
 * Given the same results, it always returns the same text.
 */
export const buildFeedbackContext = (results: readonly SearchResult[]): string => {
  /*
   * STEP 1 — FORMAT EACH SEARCH RESULT
   *
   * Each result becomes a small text block containing:
   *
   * - The source ID, used later for citations.
   * - The original employee feedback.
   *
   * We use map() to convert each result into a string.
   */
  const blocks = results.map(
    (result) => `Source: ${result.id}
Feedback: ${result.text}`,
  );

  /*
   * STEP 2 — COMBINE THE BLOCKS
   *
   * Separate records with a blank line to make the
   * context easier for the LLM to interpret.
   *
   * If there are no results, join() returns an empty string.
   */
  return blocks.join("\n\n");
};
