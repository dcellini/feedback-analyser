import { describe, expect, it, vi } from "vitest";
import { createCachedEmbeddingProvider } from "./cached-embedding-provider.js";

describe("createCachedEmbeddingProvider", () => {
  it("reuses an embedding for repeated text", async () => {
    // The underlying provider is a mock we can spy on.
    const embed = vi.fn(async (_text: string): Promise<number[]> => {
      return [0.9, 0.1];
    });

    const cachedProvider = createCachedEmbeddingProvider({ embed });

    // First call: cache miss → underlying provider called.
    const first = await cachedProvider.embed("management");

    // Second call: cache hit → stored result returned.
    const second = await cachedProvider.embed("management");

    expect(first).toEqual([0.9, 0.1]);
    expect(second).toEqual([0.9, 0.1]);

    // The expensive operation happened only once.
    expect(embed).toHaveBeenCalledTimes(1);
  });

  it("generates separate embeddings for different text", async () => {
    const embed = vi.fn(async (text: string): Promise<number[]> => {
      return text === "management" ? [1, 0] : [0, 1];
    });

    const cachedProvider = createCachedEmbeddingProvider({ embed });

    await cachedProvider.embed("management");
    await cachedProvider.embed("recognition");
    await cachedProvider.embed("management");

    // Two unique strings → two underlying calls.
    expect(embed).toHaveBeenCalledTimes(2);
    expect(embed).toHaveBeenCalledWith("management");
    expect(embed).toHaveBeenCalledWith("recognition");
  });

  it("does not cache failed embedding requests", async () => {
    const embed = vi
      .fn<(_text: string) => Promise<number[]>>()
      .mockRejectedValueOnce(new Error("Temporary API failure"))
      .mockResolvedValueOnce([1, 0]);

    const cachedProvider = createCachedEmbeddingProvider({ embed });

    // First call fails.
    await expect(cachedProvider.embed("management")).rejects.toThrow("Temporary API failure");

    // Second call retries the original provider.
    await expect(cachedProvider.embed("management")).resolves.toEqual([1, 0]);

    expect(embed).toHaveBeenCalledTimes(2);
  });
});
