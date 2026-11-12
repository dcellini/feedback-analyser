import type { EmbeddingProvider } from "./embedding-provider.js";
import type { SearchableFeedback } from "./semantic-search.js";

/**
 * Feedback that has already been converted into an embedding.
 *
 * Example:
 * {
 *   id: "1",
 *   text: "My manager ignores my concerns.",
 *   embedding: [0.9, 0.1]
 * }
 *
 * These vectors can be reused for multiple searches.
 */
export interface EmbeddedFeedback extends SearchableFeedback {
  embedding: number[];
}

/**
 * PREPARE FEEDBACK FOR SEMANTIC SEARCH
 *
 * Converts each feedback response into an embedding once.
 *
 * Example input:
 *
 * [
 *   { id: "1", text: "My manager ignores my concerns." },
 *   { id: "2", text: "The office needs better parking." }
 * ]
 *
 * Example output (invented vectors):
 *
 * [
 *   {
 *     id: "1",
 *     text: "My manager ignores my concerns.",
 *     embedding: [0.9, 0.1]
 *   },
 *   {
 *     id: "2",
 *     text: "The office needs better parking.",
 *     embedding: [0, 1]
 *   }
 * ]
 *
 * The caller can keep this collection in memory and reuse it
 * whenever someone performs a search.
 */
export const prepareFeedback = async ({
  feedback,
  embeddingProvider,
}: {
  feedback: readonly SearchableFeedback[];
  embeddingProvider: EmbeddingProvider;
}): Promise<EmbeddedFeedback[]> => {
  /**
   * STEP 1 — PROCESS EVERY FEEDBACK RESPONSE
   *
   * Promise.all() generates embeddings concurrently.
   *
   * We use map() to transform each feedback item into
   * a new object containing its embedding.
   */
  return Promise.all(
    feedback.map(async (item): Promise<EmbeddedFeedback> => {
      // Example:
      // "My manager ignores my concerns." → [0.9, 0.1]
      const embedding = await embeddingProvider.embed(item.text);

      /**
       * STEP 2 — RETURN THE ENRICHED FEEDBACK
       *
       * Spread (...item) preserves the original id and text.
       *
       * We add the new embedding property alongside them.
       */
      return {
        ...item,
        embedding,
      };
    }),
  );
};
