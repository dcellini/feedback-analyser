import { GoogleGenAI } from "@google/genai";
import type { EmbeddingProvider } from "../embedding-provider.js";

/**
 * REAL GEMINI EMBEDDING PROVIDER
 *
 * Converts text into numerical vectors using Gemini.
 *
 * Unlike our mock provider, this makes a real API request
 * every time embed() reaches the underlying Gemini client.
 *
 * Example:
 *   embed("management") → [0.12, -0.03, ...]
 *
 * The numbers are illustrative.
 */
export const createGeminiEmbeddingProvider = (apiKey: string): EmbeddingProvider => {
  const ai = new GoogleGenAI({ apiKey });

  return {
    async embed(text: string): Promise<number[]> {
      /**
       * STEP 1 — REQUEST AN EMBEDDING
       *
       * SEMANTIC_SIMILARITY tells the model we're
       * comparing the meanings of pieces of text.
       */
      const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
        config: {
          taskType: "SEMANTIC_SIMILARITY",
          outputDimensionality: 768,
        },
      });

      /**
       * STEP 2 — EXTRACT THE VECTOR
       *
       * The API returns an embeddings collection.
       * Because we supplied one text, we expect one vector.
       */
      const embedding = response.embeddings?.[0]?.values;

      if (!embedding || embedding.length === 0) {
        throw new Error("Gemini returned no embedding");
      }

      return embedding;
    },
  };
};
