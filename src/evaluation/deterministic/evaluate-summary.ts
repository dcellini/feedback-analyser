/**
 * Checks whether an AI-generated summary mentions all of the themes
 * that we consider important for a piece of feedback.
 *
 * Bigger picture:
 *
 *     Employee feedback
 *            ↓
 *       AI analysis
 *            ↓
 *        summary
 *            ↓
 *    evaluateSummary()
 *            ↓
 *      deterministic check
 *
 * This is deliberately a simple evaluator. We are checking whether the
 * expected theme words actually appear in the summary.
 *
 * This is useful because deterministic checks are cheap, predictable and
 * easy to test. However, they have an important limitation: they check
 * wording rather than meaning.
 */
export const evaluateSummary = (feedback: string, summary: string, requiredThemes: readonly string[]) => {
  /*
   * Normalise the summary so that the comparison is case-insensitive.
   *
   * For example:
   *
   * "The employee has concerns about Management"
   *
   * should match:
   *
   * "management"
   *
   * Without normalisation, the different capitalisation would cause
   * String.includes() to return false.
   */
  const normalisedSummary = summary.toLowerCase();

  /*
   * Check that EVERY required theme appears somewhere in the summary.
   *
   * `every()` means the result is only true when all required themes
   * are found.
   *
   * We also lowercase each theme so that the comparison is
   * case-insensitive on both sides.
   */
  const themesMentioned = requiredThemes.every((theme) =>
    normalisedSummary.includes(theme.toLowerCase()),
  );

  /*
   * Return both the individual check and the overall result.
   *
   * At the moment they are the same value because this evaluator has
   * only one criterion: all required themes must be mentioned.
   *
   * Keeping `themesMentioned` separate is useful because we may add
   * other deterministic summary checks later.
   */
  return {
    themesMentioned,
    passed: themesMentioned,
  };
};
