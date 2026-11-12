/**
 * Defines how our application converts text into an embedding.
 *
 * An embedding is an array of numbers representing features
 * learned from the text by an embedding model.
 *
 * Example (invented numbers):
 *
 *   embed("management") → [0.8, 0.6, 0.1]
 *
 *   embed("management support") → [0.9, 0.5, 0.1]
 *
 * The interface doesn't care whether the embedding comes
 * from Gemini, another AI provider or a mock used in tests.
 *
 * This keeps our application independent of a specific AI service.
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
}
