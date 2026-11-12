import { describe, expect, it } from "vitest";
import { evaluateSummary } from "./evaluate-summary.js";

/*
 * Group the tests for evaluateSummary() together.
 *
 * These tests verify our simple deterministic approach to checking
 * whether important themes appear in an AI-generated summary.
 */
describe("evaluateSummary", () => {
  /*
   * Test the case where all of the required themes appear in the summary.
   *
   * This is a deliberately simple evaluation rule:
   *
   *     expected theme → appears as text in summary
   *
   * It does not try to understand the meaning of the summary.
   */
  it("passes when the important themes are represented", () => {
    const result = evaluateSummary(
      /*
       * Original employee feedback.
       *
       * This is passed into evaluateSummary() because the original
       * feedback is the source of truth for what the summary should
       * represent.
       *
       * Our current evaluator doesn't actually use this parameter yet,
       * but keeping it in the interface gives us room to make the
       * evaluation more sophisticated later.
       */
      "Communication from senior management has been really poor.",

      /*
       * AI-generated summary.
       */
      "Employees are unhappy with poor communication from senior management.",

      /*
       * Themes that we expect the summary to represent.
       */
      ["communication", "senior management"],
    );

    /*
     * Both expected themes appear in the summary, so the deterministic
     * evaluator should pass.
     */
    expect(result).toEqual({
      themesMentioned: true,
      passed: true,
    });
  });

  /*
   * Test the case where an important theme is missing from the summary.
   *
   * The original feedback is about communication and senior management,
   * but the generated summary talks about the working environment instead.
   */
  it("fails when an important theme is missing", () => {
    const result = evaluateSummary(
      "Communication from senior management has been really poor.",

      /*
       * This summary doesn't mention either expected theme.
       */
      "Employees are unhappy with their working environment.",

      ["communication", "senior management"],
    );

    /*
     * The evaluator should identify that the required themes weren't
     * represented and therefore fail the evaluation.
     */
    expect(result).toEqual({
      themesMentioned: false,
      passed: false,
    });
  });
});
