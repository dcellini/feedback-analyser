import { describe, expect, it } from "vitest";
import { evaluateFeedback } from "./evaluate-feedback.js";

/*
 * Group the tests for evaluateFeedback() together.
 *
 * These tests focus only on the deterministic part of our evaluation
 * system. No AI or external service is involved.
 */
describe("evaluateFeedback", () => {
  /*
   * Test the happy path where all of the objective parts of the analysis
   * match the expected result.
   *
   * Notice that `actual.themes` contains an additional "management" theme.
   *
   * That's intentional. Our evaluator checks that the expected themes
   * are covered; it does not require the AI to return exactly the same
   * list of themes.
   */
  it("passes when the important parts of the analysis are correct", () => {
    /*
     * This represents the analysis produced by our AI.
     *
     * `as const` keeps values such as "negative" as their literal types
     * rather than widening them to the general `string` type.
     */
    const actual = {
      sentiment: "negative" as const,
      themes: ["communication", "leadership", "management"],
      priority: "medium" as const,
      summary: "Communication from leadership is poor.",
    };

    /*
     * This is our reference/expected analysis.
     *
     * Notice that it doesn't contain a summary. We don't try to compare
     * summaries exactly because summary quality is more subjective and is
     * evaluated separately.
     */
    const expected = {
      sentiment: "negative" as const,
      themes: ["communication", "leadership"],
      priority: "medium" as const,
    };

    /*
     * `toEqual()` compares the returned object with the complete expected
     * object.
     *
     * This lets us verify not only the overall `passed` result, but also
     * each individual evaluation result.
     */
    expect(evaluateFeedback(actual, expected)).toEqual({
      sentimentCorrect: true,
      priorityCorrect: true,
      themesCovered: true,
      passed: true,
    });
  });

  /*
   * Test one specific failure condition: incorrect sentiment.
   *
   * The other values remain correct. This is important because it proves
   * that the evaluator identifies the particular failure rather than
   * simply returning false for everything.
   */
  it("fails when the sentiment is wrong", () => {
    const actual = {
      sentiment: "positive" as const,
      themes: ["communication", "leadership"],
      priority: "medium" as const,
      summary: "Communication from leadership is poor.",
    };

    const expected = {
      sentiment: "negative" as const,
      themes: ["communication", "leadership"],
      priority: "medium" as const,
    };

    /*
     * We expect:
     *
     * sentimentCorrect → false
     * priorityCorrect  → true
     * themesCovered    → true
     *
     * Therefore the overall result must be false.
     */
    expect(evaluateFeedback(actual, expected)).toEqual({
      sentimentCorrect: false,
      priorityCorrect: true,
      themesCovered: true,
      passed: false,
    });
  });
});
