
import type { EmbeddingProvider } from "../../embeddings/embedding-provider.js";
import type { EmbeddedFeedback } from "../../embeddings/prepare-feedback.js";
import { semanticSearch } from "../../embeddings/semantic-search.js";

/**
 * Arguments accepted by our searchFeedback tool.
 *
 * Eventually Gemini will provide these arguments
 * when requesting a search.
 *
 * We deliberately expose only:
 * - query: What to search for.
 * - limit: Maximum number of results.
 *
 * Gemini should not control our embedding provider
 * or have direct access to our dataset.
 */
export interface SearchFeedbackArgs {
  query: string;
  limit?: number;
}

/**
 * Creates a search tool using our existing semantic search.
 *
 * This is a factory function.
 *
 * It accepts the dependencies required to perform searches
 * and returns a new function that can execute them.
 *
 * We use dependency injection so the tool works with
 * both real Gemini embeddings and mock embeddings.
 */
export const createSearchFeedbackTool = ({
  feedback,
  embeddingProvider,
}: {
  feedback: readonly EmbeddedFeedback[];
  embeddingProvider: EmbeddingProvider;
}) => {
  /**
   * This inner function is our actual search tool.
   *
   * It retains access to feedback and embeddingProvider
   * through a JavaScript closure.
   *
   * The caller only needs to supply a query and
   * optionally a result limit.
   */
  return async ({
    query,
    limit = 5,
  }: SearchFeedbackArgs) => {
    /*
     * Reuse semanticSearch() from Chapter 3.
     *
     * It:
     * 1. Generates an embedding for the query.
     * 2. Compares it with stored feedback embeddings.
     * 3. Ranks feedback by cosine similarity.
     * 4. Returns the highest-ranked records.
     */
    const results = await semanticSearch({
      query,
      feedback,
      embeddingProvider,
      limit,
    });

    /*
     * Return the search results to the caller.
     *
     * Each result contains:
     * - id: Source identifier.
     * - text: Original employee feedback.
     * - similarity: Cosine similarity score.
     *
     * Later, these results will be sent back to Gemini
     * after it requests this tool.
     */
    return results;
  };
};
