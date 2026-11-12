import { describe, expect, it } from "vitest";
import { compareText } from "./compare-text.js";
import { createMockEmbeddingProvider } from "../providers/mock-embedding-provider.js";

describe("compareText", () => {
  it("returns a high similarity score for related text", async () => {
    // These vectors are deliberately similar.
    // They simulate an embedding model recognising related meanings.
    const embeddingProvider = createMockEmbeddingProvider({
      management: [1, 0],
      "management support": [0.9, 0.1],
    });

    const result = await compareText({
      textA: "management",
      textB: "management support",
      embeddingProvider,
    });

    // The vectors point in almost the same direction.
    expect(result).toBeGreaterThan(0.99);
  });

  it("returns a low similarity score for unrelated text", async () => {
    // Perpendicular mock vectors simulate unrelated meanings.
    const embeddingProvider = createMockEmbeddingProvider({
      management: [1, 0],
      parking: [0, 1],
    });

    const result = await compareText({
      textA: "management",
      textB: "parking",
      embeddingProvider,
    });

    expect(result).toBe(0);
  });

  it("rejects when an embedding cannot be generated", async () => {
    // The mock has no configured embedding for "unknown".
    // The error should propagate to the caller.
    const embeddingProvider = createMockEmbeddingProvider({
      management: [1, 0],
    });

    await expect(
      compareText({
        textA: "management",
        textB: "unknown",
        embeddingProvider,
      }),
    ).rejects.toThrow("No mock embedding configured for: unknown");
  });
});
