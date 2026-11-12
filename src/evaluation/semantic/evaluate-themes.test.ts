import { describe, expect, it, vi } from "vitest";
import { evaluateThemes } from "./evaluate-themes.js";
import { createMockEmbeddingProvider } from "../../embeddings/providers/mock-embedding-provider.js";

describe("evaluateThemes", () => {
  it("accepts themes with similar meanings but different wording", async () => {
    // These vectors simulate an embedding model identifying
    // management and management support as closely related.
    const embeddingProvider = createMockEmbeddingProvider({
      management: [1, 0],
      "management support": [0.9, 0.1],
      recognition: [0, 1],
    });

    const result = await evaluateThemes({
      expectedThemes: ["management", "recognition"],
      actualThemes: ["management support", "recognition"],
      embeddingProvider,
    });

    expect(result.passed).toBe(true);
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0]?.actual).toBe("management support");
  });

  it("rejects unrelated themes", async () => {
    // Perpendicular vectors represent unrelated concepts
    // in this controlled test.
    const embeddingProvider = createMockEmbeddingProvider({
      management: [1, 0],
      parking: [0, 1],
    });

    const result = await evaluateThemes({
      expectedThemes: ["management"],
      actualThemes: ["parking"],
      embeddingProvider,
    });

    expect(result.passed).toBe(false);
    expect(result.matches[0]?.similarity).toBe(0);
  });

  it("fails when no generated themes are provided", async () => {
    const embeddingProvider = createMockEmbeddingProvider({});

    const result = await evaluateThemes({
      expectedThemes: ["management"],
      actualThemes: [],
      embeddingProvider,
    });

    expect(result.passed).toBe(false);
    expect(result.matches[0]?.actual).toBeNull();
  });

  it("generates each unique embedding only once", async () => {
    // We use vi.fn() to track how many times embed() is called.
    // This proves caching works without contacting Gemini.
    const embed = vi.fn(async (text: string): Promise<number[]> => {
      const vectors: Record<string, number[]> = {
        management: [1, 0],
        "management support": [0.9, 0.1],
        recognition: [0, 1],
      };

      const vector = vectors[text];

      if (!vector) {
        throw new Error(`Missing embedding for: ${text}`);
      }

      return vector;
    });

    const result = await evaluateThemes({
      expectedThemes: ["management", "recognition"],
      actualThemes: ["management support", "recognition"],
      embeddingProvider: { embed },
    });

    expect(result.passed).toBe(true);

    // Without caching:
    //   2 expected × 2 actual × 2 embeddings = 8 calls.
    //
    // With caching:
    //   Only 3 unique text strings = 3 calls.
    expect(embed).toHaveBeenCalledTimes(3);

    expect(embed).toHaveBeenCalledWith("management");
    expect(embed).toHaveBeenCalledWith("management support");
    expect(embed).toHaveBeenCalledWith("recognition");
  });
});
