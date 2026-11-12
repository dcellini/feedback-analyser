import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "./cosine-similarity.js";

describe("cosineSimilarity", () => {
  it("returns 1 for vectors pointing in the same direction", () => {
    // Both vectors point in exactly the same direction.
    // The similarity should therefore be 1.
    const result = cosineSimilarity([1, 0], [1, 0]);

    expect(result).toBe(1);
  });

  it("returns 0 for perpendicular vectors", () => {
    // [1, 0] points along the horizontal axis.
    // [0, 1] points along the vertical axis.
    // Their directions are perpendicular, giving similarity 0.
    const result = cosineSimilarity([1, 0], [0, 1]);

    expect(result).toBe(0);
  });

  it("returns -1 for vectors pointing in opposite directions", () => {
    // The vectors point in exactly opposite directions.
    // Cosine similarity should therefore be -1.
    const result = cosineSimilarity([1, 0], [-1, 0]);

    expect(result).toBe(-1);
  });

  it("throws an error when vectors have different lengths", () => {
    // Every number represents a dimension.
    // Vectors must have matching dimensions to be compared.
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
      "Vectors must have the same non-zero length",
    );
  });

  it("throws an error when a vector contains only zeros", () => {
    // A zero vector has no direction.
    // Cosine similarity is undefined for a zero vector.
    expect(() => cosineSimilarity([0, 0], [1, 2])).toThrow("Cannot compare zero vectors");
  });
});
