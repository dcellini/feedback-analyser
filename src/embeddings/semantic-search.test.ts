import { describe, expect, it, vi } from "vitest";
import { semanticSearch } from "./semantic-search.js";
import { createMockEmbeddingProvider } from "./providers/mock-embedding-provider.js";
import { prepareFeedback } from "./prepare-feedback.js";

describe("semanticSearch", () => {
  it("ranks feedback by similarity to the query", async () => {
    const feedback = [
      { id: "1", text: "My manager ignores my concerns." },
      { id: "2", text: "The office needs better parking." },
      { id: "3", text: "Senior leaders rarely communicate." },
    ];

    /**
     * Our mock provides predictable vectors.
     *
     * Query:       [1, 0]
     * Management:  [0.9, 0.1]
     * Parking:     [0, 1]
     * Leadership:  [0.8, 0.2]
     *
     * These are invented numbers.
     * They let us test ranking without calling Gemini.
     */
    const embeddingProvider = createMockEmbeddingProvider({
      "Problems with leadership": [1, 0],
      "My manager ignores my concerns.": [0.9, 0.1],
      "The office needs better parking.": [0, 1],
      "Senior leaders rarely communicate.": [0.8, 0.2],
    });

    const preparedFeedback = await prepareFeedback({
      feedback,
      embeddingProvider,
    });

    const results = await semanticSearch({
      query: "Problems with leadership",
      feedback: preparedFeedback,
      embeddingProvider,
    });

    // Expected order: management, leadership, parking.
    expect(results.map((result) => result.id)).toEqual(["1", "3", "2"]);

    // Highest-ranking response should have the highest score.
    expect(results[0]!.similarity).toBeGreaterThan(results[1]!.similarity);
  });

  it("limits the number of returned results", async () => {
    const feedback = [
      { id: "1", text: "Management concerns" },
      { id: "2", text: "Office parking" },
    ];

    const embeddingProvider = createMockEmbeddingProvider({
      leadership: [1, 0],
      "Management concerns": [1, 0],
      "Office parking": [0, 1],
    });

    const preparedFeedback = await prepareFeedback({
      feedback,
      embeddingProvider,
    });

    const results = await semanticSearch({
      query: "leadership",
      feedback: preparedFeedback,
      embeddingProvider,
      limit: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("1");
  });

  it("returns no results for an empty feedback collection", async () => {
    const embeddingProvider = createMockEmbeddingProvider({
      leadership: [1, 0],
    });

    const results = await semanticSearch({
      query: "leadership",
      feedback: [],
      embeddingProvider,
    });

    expect(results).toEqual([]);
  });

  // Add inside describe("semanticSearch", ...)
  it("reuses prepared feedback embeddings across searches", async () => {
    /**
     * Our mock records every embedding request.
     *
     * Two feedback responses are embedded during preparation.
     * Each search should only embed its query.
     */
    const embed = vi.fn(async (text: string): Promise<number[]> => {
      const vectors: Record<string, number[]> = {
        "Manager concerns": [1, 0],
        "Office parking": [0, 1],
        leadership: [1, 0],
        facilities: [0, 1],
      };

      const vector = vectors[text];

      if (!vector) {
        throw new Error(`Missing embedding: ${text}`);
      }

      return vector;
    });

    const embeddingProvider = { embed };

    const preparedFeedback = await prepareFeedback({
      feedback: [
        { id: "1", text: "Manager concerns" },
        { id: "2", text: "Office parking" },
      ],
      embeddingProvider,
    });

    // Preparation generates two embeddings.
    expect(embed).toHaveBeenCalledTimes(2);

    await semanticSearch({
      query: "leadership",
      feedback: preparedFeedback,
      embeddingProvider,
    });

    // Only the search query requires a new embedding.
    expect(embed).toHaveBeenCalledTimes(3);

    await semanticSearch({
      query: "facilities",
      feedback: preparedFeedback,
      embeddingProvider,
    });

    // Another query, but still no feedback re-embedding.
    expect(embed).toHaveBeenCalledTimes(4);
  });
});
