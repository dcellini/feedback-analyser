
import { describe, expect, it } from "vitest";

import { validateGroundedAnswer } from "./validate-grounded-answer.js";

/**
 * CHAPTER 7 — NUMERICAL ANSWER VALIDATION
 *
 * Tests numerical verification within our main
 * grounded-answer validation workflow.
 *
 * AI models can generate plausible but incorrect
 * numbers, even when they have access to real data.
 *
 * To reduce this risk, our application compares
 * structured numerical claims against statistics
 * calculated by a trusted application tool.
 *
 * The workflow is:
 *
 * 1. The AI generates a structured numerical claim.
 * 2. Zod validates the claim's structure.
 * 3. The validator looks up the trusted metric.
 * 4. The claimed value is checked against the metric.
 * 5. Incorrect or unsupported claims are rejected.
 *
 * These are deterministic unit tests using local data.
 * No Gemini API calls are made.
 */

/**
 * BASE ANSWER FIXTURE
 *
 * Represents a valid "answered" response without
 * any evidence-based claims or quotations.
 *
 * The status field is required by our new
 * discriminated union schema.
 *
 * Each test can add numericalClaims while keeping
 * the remaining answer structure valid.
 *
 * No feedback evidence is supplied because these
 * tests focus exclusively on numerical verification.
 */
const baseAnswer = {
  status: "answered" as const,
  summary: "Feedback analysis completed.",
  claims: [],
  quotations: [],
  numericalClaims: [],
};

describe("validateGroundedAnswer numerical claims", () => {
  /**
   * TEST 1 — CORRECT NUMERICAL CLAIM
   *
   * The AI claims there are exactly 42 feedback records.
   * Our trusted statistics also report 42.
   *
   * The "eq" operator means "equals".
   *
   * EXPECTED: Accept the claim and return the answer.
   */
  it("accepts a correct numerical claim", () => {
    const answer = {
      ...baseAnswer,
      numericalClaims: [
        {
          metric: "totalFeedback",
          operator: "eq",
          value: 42,
        },
      ],
    };

    expect(
      validateGroundedAnswer(
        answer,
        [],
        { totalFeedback: 42 },
      ),
    ).toEqual(answer);
  });

  /**
   * TEST 2 — INCORRECT NUMERICAL CLAIM
   *
   * The AI claims there are 50 feedback records,
   * but the trusted tool reports only 42.
   *
   * This simulates an AI hallucinating a number.
   *
   * EXPECTED: Reject the claim because the values differ.
   */
  it("rejects an invented numerical value", () => {
    const answer = {
      ...baseAnswer,
      numericalClaims: [
        {
          metric: "totalFeedback",
          operator: "eq",
          value: 50,
        },
      ],
    };

    expect(() =>
      validateGroundedAnswer(
        answer,
        [],
        { totalFeedback: 42 },
      ),
    ).toThrow("Numerical claim failed");
  });

  /**
   * TEST 3 — MISSING TRUSTED STATISTICS
   *
   * The AI claims there are 42 feedback records,
   * but no statistics were provided for verification.
   *
   * Even though 42 happens to be correct, the
   * validator has no evidence to confirm it.
   *
   * EXPECTED: Reject the claim rather than trust
   * the AI's unsupported numerical assertion.
   */
  it("rejects numerical claims without statistics", () => {
    const answer = {
      ...baseAnswer,
      numericalClaims: [
        {
          metric: "totalFeedback",
          operator: "eq",
          value: 42,
        },
      ],
    };

    expect(() =>
      validateGroundedAnswer(
        answer,
        [],
      ),
    ).toThrow("Trusted statistics are missing");
  });

  /**
   * TEST 4 — NO NUMERICAL CLAIMS
   *
   * The answer contains no structured numerical claims.
   *
   * Therefore, numerical verification has nothing
   * to check and trusted statistics are not required.
   *
   * EXPECTED: Accept the answer without statistics.
   */
  it("accepts answers without numerical claims", () => {
    expect(
      validateGroundedAnswer(
        baseAnswer,
        [],
      ),
    ).toEqual(baseAnswer);
  });

  /**
   * TEST 5 — UNSUPPORTED METRIC
   *
   * The AI attempts to reference "happyEmployees",
   * which is not part of our permitted metric schema.
   *
   * The trusted tool only provides totalFeedback.
   *
   * Zod should reject the unsupported metric before
   * numerical comparison takes place.
   *
   * EXPECTED: Reject the invalid claim structure.
   */
  it("rejects unsupported numerical metrics", () => {
    const answer = {
      ...baseAnswer,
      numericalClaims: [
        {
          metric: "happyEmployees",
          operator: "eq",
          value: 100,
        },
      ],
    };

    expect(() =>
      validateGroundedAnswer(
        answer,
        [],
        { totalFeedback: 42 },
      ),
    ).toThrow();
  });
});
