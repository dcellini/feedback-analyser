import type { EmbeddingProvider } from "../embedding-provider.js";
import { cosineSimilarity } from "../internal/cosine-similarity.js";

/**
 * Compares the semantic similarity of two text strings.
 *
 * This function coordinates two operations:
 *
 * 1. Convert each text into an embedding (array of numbers).
 * 2. Compare the embeddings using cosine similarity.
 *
 * Example:
 *
 *   await compareText({
 *     textA: "management",
 *     textB: "management support",
 *     embeddingProvider,
 *   });
 *
 * Returns a number between -1 and 1.
 *
 * A higher score generally suggests more similar meaning,
 * provided the embeddings come from a suitable model.
 *
 * We inject EmbeddingProvider so this works with either
 * a mock (during tests) or a real embedding model.
 */
export const compareText = async ({
  textA,
  textB,
  embeddingProvider,
}: {
  textA: string;
  textB: string;
  embeddingProvider: EmbeddingProvider;
}): Promise<number> => {
  // Both operations are independent, so run them concurrently.
  // This can reduce waiting time when using a real API.
  const [embeddingA, embeddingB] = await Promise.all([
    embeddingProvider.embed(textA),
    embeddingProvider.embed(textB),
  ]);

  // The provider supplies the vectors; our utility compares them.
  return cosineSimilarity(embeddingA, embeddingB);
};
