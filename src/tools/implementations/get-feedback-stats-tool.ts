
import type { SearchableFeedback } from "../../embeddings/semantic-search.js";

/**
 * CHAPTER 6 — NEW: Feedback Statistics Tool
 *
 * WHY ARE WE ADDING THIS?
 *
 * In Chapter 5, Gemini could only request one tool:
 * searchFeedback().
 *
 * In Chapter 6, we're introducing a second tool so
 * Gemini can choose between different actions.
 *
 * This tool calculates basic statistics about our
 * employee feedback without using an LLM.
 *
 * REUSED CONCEPT FROM CHAPTER 5:
 * The factory function and closure pattern.
 */

/**
 * Describes the data returned by our statistics tool.
 *
 * Example:
 * {
 *   totalFeedback: 3
 * }
 */
export interface FeedbackStats {
  totalFeedback: number;
}

/**
 * Defines the function signature of our tool.
 *
 * Unlike searchFeedback(), this tool doesn't need
 * a query or any other arguments.
 */
export type GetFeedbackStatsTool = () => FeedbackStats;

/**
 * CHAPTER 6 — NEW
 *
 * Creates our statistics tool.
 *
 * INPUT:
 * An array of feedback records.
 *
 * OUTPUT:
 * A function that can calculate the total number
 * of feedback records.
 *
 * We use the same factory/closure approach as
 * createSearchFeedbackTool() from Chapter 5.
 */
export const createGetFeedbackStatsTool = ({
  feedback,
}: {
  feedback: readonly SearchableFeedback[];
}): GetFeedbackStatsTool => {
  /**
   * This returned function remembers the feedback
   * array provided when the factory was called.
   *
   * No Gemini request is made.
   * No embeddings are generated.
   */
  return () => ({
    totalFeedback: feedback.length,
  });
};
