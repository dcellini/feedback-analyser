import type { FeedbackAnalysis } from "../../analysis/internal/feedback-schema.js";

/**
 * The parts of an AI analysis that we can compare deterministically
 * against an expected result.
 *
 * Bigger picture:
 * This is part of our AI evaluation system. We have an expected/reference
 * analysis for our test examples, and we compare the AI's actual output
 * against it.
 *
 * We deliberately don't require the expected analysis to be a complete
 * FeedbackAnalysis. For example, we don't currently evaluate the summary
 * here because summary quality is more subjective and is handled separately
 * by evaluateSummary() and our LLM judge.
 */
type ExpectedAnalysis = {
  sentiment: FeedbackAnalysis["sentiment"];
  themes: readonly string[];
  priority: FeedbackAnalysis["priority"];
};

/**
 * Performs deterministic checks against an AI-generated feedback analysis.
 *
 * Bigger picture:
 *
 *     AI-generated analysis
 *              ↓
 *       evaluateFeedback()
 *              ↓
 *     objective pass/fail checks
 *
 * This evaluator is intentionally simple. Some aspects of AI output can be
 * checked with normal TypeScript/JavaScript logic, such as whether the
 * sentiment and priority match our expected values.
 *
 * This is only one part of our overall evaluation system. We also have:
 *
 * - evaluateSummary() for summary-related checks
 * - an LLM judge for more subjective quality assessment
 *
 * Keeping these separate means each evaluation method has one clear job.
 */
export const evaluateFeedback = (actual: FeedbackAnalysis, expected: ExpectedAnalysis) => {
  // Sentiment has a fixed set of allowed values, so we can make an
  // objective comparison rather than asking another AI whether it is correct.
  const sentimentCorrect = actual.sentiment === expected.sentiment;

  // Priority is also a controlled set of values, so this is another
  // deterministic check.
  const priorityCorrect = actual.priority === expected.priority;

  /*
   * Check that every important theme from our expected/reference analysis
   * appears in the AI's themes.
   *
   * We use `every()` because we want all required themes to be covered.
   *
   * Example:
   *
   * expected.themes = ["management", "recognition"]
   * actual.themes   = ["management", "recognition", "communication"]
   *
   * → true
   *
   * The AI is allowed to identify additional reasonable themes. We are
   * therefore checking that the expected themes are covered, rather than
   * requiring the two arrays to be exactly identical.
   */
  const themesCovered = expected.themes.every((theme) => actual.themes.includes(theme));

  /*
   * Return the individual results as well as the overall result.
   *
   * Returning the individual checks is useful when evaluating AI systems:
   * if something fails, we want to know WHAT failed rather than just seeing
   * `passed: false`.
   *
   * For example, we might eventually see:
   *
   * {
   *   sentimentCorrect: true,
   *   priorityCorrect: false,
   *   themesCovered: true,
   *   passed: false
   * }
   *
   * That tells us the model understood the feedback reasonably well but
   * assigned the wrong priority.
   */
  return {
    sentimentCorrect,
    priorityCorrect,
    themesCovered,

    // The overall deterministic evaluation only passes when every
    // individual check passes.
    passed: sentimentCorrect && priorityCorrect && themesCovered,
  };
};
