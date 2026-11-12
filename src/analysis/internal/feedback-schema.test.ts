import { feedbackAnalysisSchema } from "./feedback-schema.js";
import { describe, expect, it } from "vitest";

/*
 * These tests verify the runtime validation provided by Zod.
 *
 * Remember the important distinction:
 *
 * TypeScript types protect our code at compile time.
 * Zod validates actual data at runtime.
 *
 * This matters particularly for our AI application because the AI
 * response is external data and cannot be trusted simply because
 * TypeScript says it should have a particular shape.
 */
describe("feedback analysis schema", () => {
  /*
   * A correctly structured FeedbackAnalysis should be accepted.
   *
   * `parse()` returns the validated value when the data is valid.
   * If the data is invalid, it throws an error.
   *
   * We don't need the returned value here, so we're simply checking
   * that validation does not throw.
   */
  it("accepts valid feedback analysis", () => {
    expect(() =>
      feedbackAnalysisSchema.parse({
        sentiment: "positive",
        themes: ["usability", "performance"],
        priority: "high",
        summary: "The app is very responsive and easy to use.",
      }),
    ).not.toThrow();
  });

  /*
   * Test several invalid fields at once.
   *
   * This confirms that the schema rejects data that doesn't match the
   * expected FeedbackAnalysis structure.
   */
  it("rejects invalid feedback analysis", () => {
    expect(() =>
      feedbackAnalysisSchema.parse({
        /*
         * Not one of the allowed sentiment values.
         */
        sentiment: "very_negative",

        /*
         * themes must be an array of strings.
         */
        themes: "performance",

        /*
         * priority must be "low", "medium" or "high".
         */
        priority: 7,

        /*
         * summary must be a string.
         */
        summary: null,
      }),
    ).toThrow();
  });

  /*
   * Test the sentiment rule independently.
   *
   * This is useful because if the schema changes later, this test makes
   * it clear exactly which validation rule has been broken.
   */
  it("rejects invalid sentiment", () => {
    expect(() =>
      feedbackAnalysisSchema.parse({
        sentiment: "super positive",
        themes: ["usability", "performance"],
        priority: "high",
        summary: "The app is very responsive and easy to use.",
      }),
    ).toThrow();
  });

  /*
   * Test that themes must be an array.
   *
   * The schema also requires every item in the array to be a string.
   */
  it("rejects invalid themes", () => {
    expect(() =>
      feedbackAnalysisSchema.parse({
        sentiment: "positive",
        themes: 12,
        priority: "high",
        summary: "The app is very responsive and easy to use.",
      }),
    ).toThrow();
  });

  /*
   * Test the priority rule independently.
   *
   * `null` is invalid because priority must be one of our three allowed
   * string values.
   */
  it("rejects invalid priority", () => {
    expect(() =>
      feedbackAnalysisSchema.parse({
        sentiment: "positive",
        themes: ["usability", "performance"],
        priority: null,
        summary: "The app is very responsive and easy to use.",
      }),
    ).toThrow();
  });
});
