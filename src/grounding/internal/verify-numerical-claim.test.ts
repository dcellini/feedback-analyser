
import { describe, expect, it } from "vitest";

import { verifyNumericalClaim } from "./verify-numerical-claim.js";

/**
 * CHAPTER 7 — NUMERICAL CLAIM VERIFICATION
 *
 * Unit tests for verifying AI-generated numerical
 * claims against trusted application statistics.
 *
 * WHY THIS MATTERS:
 *
 * An LLM can generate convincing but incorrect
 * numbers, even when provided with accurate data.
 *
 * Rather than trusting the model's answer, our
 * application checks structured numerical claims
 * using ordinary TypeScript comparison logic.
 *
 * A numerical claim contains:
 *
 * - text:     The claim as a human-readable sentence.
 * - metric:   The statistic being referenced.
 * - operator: The comparison to perform.
 * - value:    The number being claimed.
 *
 * SUPPORTED OPERATORS:
 *
 * eq  -> equal to
 * gt  -> greater than
 * gte -> greater than or equal to
 * lt  -> less than
 * lte -> less than or equal to
 *
 * The verifier:
 *
 * 1. Validates the claim structure using Zod.
 * 2. Validates the trusted statistics.
 * 3. Compares the claimed value with the actual value.
 * 4. Returns a verification result.
 *
 * Unlike validateGroundedAnswer(), this function
 * returns { valid: true } or { valid: false, reason }
 * rather than throwing for ordinary verification failures.
 *
 * These are deterministic unit tests.
 * No Gemini API calls are made.
 */

/**
 * TRUSTED STATISTICS FIXTURE
 *
 * Simulates statistics calculated by our application,
 * such as the result of getFeedbackStats.
 *
 * Every test uses a true total of 42 submissions.
 *
 * The claimed value can vary, but the trusted
 * statistic remains unchanged.
 */
const stats = {
  totalFeedback: 42,
};

describe("verifyNumericalClaim", () => {
  /**
   * TEST 1 — CORRECT EQUALITY CLAIM
   *
   * The model claims exactly 42 submissions.
   * The trusted statistic is also 42.
   *
   * operator: "eq" means equality.
   *
   * EXPECTED:
   * Verification succeeds.
   */
  it("accepts a correct equality claim", () => {
    const result = verifyNumericalClaim(
      {
        text: "There were 42 submissions.",
        metric: "totalFeedback",
        operator: "eq",
        value: 42,
      },
      stats,
    );

    expect(result).toEqual({ valid: true });
  });

  /**
   * TEST 2 — INCORRECT EQUALITY CLAIM
   *
   * The model claims exactly 50 submissions,
   * but the trusted statistic is 42.
   *
   * The structure is valid, but the comparison fails.
   *
   * EXPECTED:
   * Verification fails with a reason explaining
   * the claimed and actual values.
   */
  it("rejects an invented total", () => {
    const result = verifyNumericalClaim(
      {
        text: "There were 50 submissions.",
        metric: "totalFeedback",
        operator: "eq",
        value: 50,
      },
      stats,
    );

    expect(result).toEqual({
      valid: false,
      reason:
        "Numerical claim failed: totalFeedback " +
        "eq 50 (actual value: 42).",
    });
  });

  /**
   * TEST 3 — CORRECT GREATER-THAN CLAIM
   *
   * The model claims more than 40 submissions.
   *
   * operator: "gt" means strictly greater than.
   *
   * Since 42 > 40, the comparison is true.
   *
   * EXPECTED:
   * Verification succeeds.
   */
  it("accepts a correct greater-than claim", () => {
    const result = verifyNumericalClaim(
      {
        text: "There were more than 40 submissions.",
        metric: "totalFeedback",
        operator: "gt",
        value: 40,
      },
      stats,
    );

    expect(result).toEqual({ valid: true });
  });

  /**
   * TEST 4 — INCORRECT LESS-THAN CLAIM
   *
   * The model claims fewer than 40 submissions.
   *
   * operator: "lt" means strictly less than.
   *
   * Since 42 is not less than 40, the claim is false.
   *
   * EXPECTED:
   * Verification fails.
   */
  it("rejects an incorrect less-than claim", () => {
    const result = verifyNumericalClaim(
      {
        text: "There were fewer than 40 submissions.",
        metric: "totalFeedback",
        operator: "lt",
        value: 40,
      },
      stats,
    );

    expect(result.valid).toBe(false);
  });

  /**
   * TEST 5 — MISSING TRUSTED STATISTICS
   *
   * The model claims exactly 42 submissions,
   * but no trusted statistics are available.
   *
   * Even though the claim happens to be correct,
   * the verifier cannot establish that.
   *
   * EXPECTED:
   * Reject the claim rather than trust the model.
   *
   * This is a fail-closed approach:
   * missing evidence must not count as verification.
   */
  it("rejects claims without statistics", () => {
    const result = verifyNumericalClaim(
      {
        text: "There were 42 submissions.",
        metric: "totalFeedback",
        operator: "eq",
        value: 42,
      },
      undefined,
    );

    expect(result).toEqual({
      valid: false,
      reason: "Trusted statistics are missing or invalid.",
    });
  });

  /**
   * TEST 6 — MALFORMED TRUSTED STATISTICS
   *
   * The statistics object contains:
   *
   *   totalFeedback: "42"
   *
   * This is a string, not a number.
   *
   * JavaScript can sometimes coerce values during
   * comparisons, but we should not rely on coercion
   * when validating AI-generated claims.
   *
   * EXPECTED:
   * Reject the malformed statistics.
   */
  it("rejects malformed statistics", () => {
    const result = verifyNumericalClaim(
      {
        text: "There were 42 submissions.",
        metric: "totalFeedback",
        operator: "eq",
        value: 42,
      },
      {
        totalFeedback: "42",
      },
    );

    expect(result.valid).toBe(false);
  });

  /**
   * TEST 7 — UNSUPPORTED METRIC
   *
   * The model invents a metric named happyEmployees.
   *
   * Our schema currently permits totalFeedback,
   * not arbitrary metric names.
   *
   * Without this restriction, the model could
   * claim to verify statistics that our application
   * does not actually calculate.
   *
   * EXPECTED:
   * Zod rejects the claim structure and the verifier
   * returns an invalid result.
   */
  it("rejects unsupported metrics", () => {
    const result = verifyNumericalClaim(
      {
        text: "There were 100 happy employees.",
        metric: "happyEmployees",
        operator: "eq",
        value: 100,
      },
      stats,
    );

    expect(result).toEqual({
      valid: false,
      reason: "Invalid numerical claim structure.",
    });
  });

  /**
   * TEST 8 — UNSUPPORTED COMPARISON OPERATOR
   *
   * The model uses "approximately", which is not
   * one of our supported comparison operators.
   *
   * Approximate comparisons require an explicit
   * tolerance rule, which we have not implemented.
   *
   * EXPECTED:
   * Reject the unsupported operator rather than
   * guessing what "approximately" means.
   */
  it("rejects unknown comparison operators", () => {
    const result = verifyNumericalClaim(
      {
        text: "There were approximately 42 submissions.",
        metric: "totalFeedback",
        operator: "approximately",
        value: 42,
      },
      stats,
    );

    expect(result.valid).toBe(false);
  });
});
