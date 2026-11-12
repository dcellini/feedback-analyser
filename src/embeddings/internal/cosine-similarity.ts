/**
 * COSINE SIMILARITY
 *
 * Compares two vectors (arrays of numbers) to measure how closely
 * they point in the same direction.
 *
 * In our Feedback Analyser, an embedding model will eventually
 * convert text into vectors:
 *
 *   "management"         → [0.8, 0.6, 0.1]
 *   "management support" → [0.9, 0.5, 0.1]
 *   "office parking"     → [0.1, 0.2, 0.9]
 *
 * These are invented numbers for illustration.
 *
 * We can then compare those vectors using cosine similarity.
 * Similar meanings should generally produce higher scores when
 * using a suitable embedding model.
 *
 * RESULTS:
 *   1  = Same direction
 *   0  = Perpendicular directions
 *  -1  = Opposite directions
 *
 * Note: A high score doesn't guarantee identical meaning.
 * The embedding model determines what the numbers represent.
 */
export const cosineSimilarity = (a: readonly number[], b: readonly number[]): number => {
  // Example: [1, 0] and [0, 1] are both two-dimensional vectors.
  // [1, 0] and [0, 1, 0] cannot be compared directly.
  if (a.length !== b.length || a.length === 0) {
    throw new Error("Vectors must have the same non-zero length");
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;

    /**
     * STEP 1 — DOT PRODUCT
     *
     * Multiply numbers in matching positions and add them.
     *
     * Example:
     *   a = [1, 2]
     *   b = [3, 4]
     *
     *   (1 × 3) + (2 × 4) = 11
     *
     * This contributes to measuring how aligned the vectors are.
     */
    dotProduct += x * y;

    /**
     * STEP 2 — MAGNITUDES
     *
     * A vector's magnitude is its length.
     *
     * Example:
     *   a = [3, 4]
     *
     *   √(3² + 4²) = √25 = 5
     *
     * Here we accumulate the squared values.
     * We calculate the square roots at the end.
     */
    magnitudeA += x * x;
    magnitudeB += y * y;
  }

  // A vector such as [0, 0] has no direction.
  // We cannot calculate cosine similarity with a zero vector.
  if (magnitudeA === 0 || magnitudeB === 0) {
    throw new Error("Cannot compare zero vectors");
  }

  /**
   * STEP 3 — COSINE SIMILARITY
   *
   * Formula:
   *
   *   dot product / (length of A × length of B)
   *
   * Example:
   *   a = [1, 0]
   *   b = [1, 0]
   *
   *   Dot product = 1
   *   Length A = 1
   *   Length B = 1
   *
   *   Similarity = 1 / (1 × 1) = 1
   *
   * Another example:
   *   a = [1, 0]
   *   b = [0, 1]
   *
   *   Dot product = 0
   *   Similarity = 0
   *
   * Dividing by the lengths removes differences in vector size,
   * allowing us to compare their directions.
   */
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
};
