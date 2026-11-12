import type { EmbeddingProvider } from "../embedding-provider.js";

/**
 * CACHING EMBEDDING PROVIDER
 *
 * Wraps any existing EmbeddingProvider with an in-memory cache.
 *
 * Example:
 *
 * First call:
 *   embed("management") → cache miss
 *   → underlying provider generates [0.9, 0.1]
 *   → store in Map
 *   → return [0.9, 0.1]
 *
 * Second call:
 *   embed("management") → cache hit
 *   → return [0.9, 0.1] without calling provider
 *
 * The cache belongs to this wrapper instance.
 * Creating a new wrapper creates a new, empty cache.
 */
export const createCachedEmbeddingProvider = (provider: EmbeddingProvider): EmbeddingProvider => {
  /**
   * STEP 1 — CREATE THE CACHE
   *
   * Map stores key/value pairs:
   *
   * Key:   Original text
   * Value: Generated embedding
   *
   * Example:
   * "management" → [0.9, 0.1]
   * "recognition" → [0.1, 0.9]
   */
  const cache = new Map<string, number[]>();

  return {
    async embed(text: string): Promise<number[]> {
      /**
       * STEP 2 — CHECK THE CACHE
       *
       * Example:
       * cache.get("management") → [0.9, 0.1]
       *
       * If the result exists, return it immediately.
       */
      const cached = cache.get(text);

      if (cached !== undefined) {
        return cached;
      }

      /**
       * STEP 3 — CACHE MISS
       *
       * The text hasn't been embedded before.
       *
       * Call the original provider (mock or real Gemini).
       */
      const embedding = await provider.embed(text);

      /**
       * STEP 4 — STORE THE RESULT
       *
       * Example:
       * cache.set("management", [0.9, 0.1])
       *
       * Future requests for this exact text reuse it.
       */
      cache.set(text, embedding);

      return embedding;
    },
  };
};
