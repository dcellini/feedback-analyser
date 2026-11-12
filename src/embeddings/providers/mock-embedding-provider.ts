import type { EmbeddingProvider } from "../embedding-provider.js";

/**
 * Creates a fake embedding provider for local testing.
 *
 * Instead of calling an AI model, we supply known vectors
 * for specific text inputs.
 *
 * Example:
 *
 *   const provider = createMockEmbeddingProvider({
 *     management: [1, 0],
 *     "management support": [0.9, 0.1],
 *     parking: [0, 1],
 *   });
 *
 *   await provider.embed("management");
 *   // Returns [1, 0]
 *
 * This allows us to test similarity calculations
 * without spending Gemini requests.
 *
 * IMPORTANT:
 * These numbers are invented for testing.
 * The mock does not understand language.
 */
export const createMockEmbeddingProvider = (
  embeddings: Record<string, number[]>,
): EmbeddingProvider => {
  return {
    async embed(text: string): Promise<number[]> {
      const embedding = embeddings[text];

      // Fail clearly if our test requests text we haven't configured.
      if (!embedding) {
        throw new Error(`No mock embedding configured for: ${text}`);
      }

      return embedding;
    },
  };
};
