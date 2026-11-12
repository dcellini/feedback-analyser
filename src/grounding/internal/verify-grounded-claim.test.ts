
import { describe, expect, it } from "vitest";

import { verifyGroundedClaim } from "./verify-grounded-claim.js";

import type { FeedbackEvidence } from "./verify-feedback-quote.js";

/**
 * CHAPTER 7 — STEP 3B: CLAIM VERIFICATION TESTS
 *
 * NEW FILE
 *
 * PURPOSE:
 * Verify that claim source references are genuine.
 *
 * These are deterministic unit tests.
 *
 * No Gemini API calls are required.
 */

const evidence: FeedbackEvidence[] = [
  {
    id: "feedback-001",
    text: "My manager is supportive.",
  },
  {
    id: "feedback-002",
    text: "Communication could be better.",
  },
];

describe("verifyGroundedClaim", () => {
  /**
   * TEST 1 — VALID SOURCE
   *
   * The referenced feedback record exists.
   *
   * EXPECTED: Pass.
   */
  it("accepts a claim referencing an existing source", () => {
    const result = verifyGroundedClaim(
      {
        text: "An employee described supportive management.",
        sourceIds: ["feedback-001"],
      },
      evidence,
    );

    expect(result).toEqual({ valid: true });
  });

  /**
   * TEST 2 — UNKNOWN SOURCE
   *
   * The referenced feedback record was never retrieved.
   *
   * EXPECTED: Fail.
   */
  it("rejects an invented source ID", () => {
    const result = verifyGroundedClaim(
      {
        text: "Employees received pay rises.",
        sourceIds: ["feedback-999"],
      },
      evidence,
    );

    expect(result).toEqual({
      valid: false,
      reason: "Unknown source ID: feedback-999",
    });
  });

  /**
   * TEST 3 — MULTIPLE VALID SOURCES
   *
   * Every referenced source exists.
   *
   * EXPECTED: Pass.
   */
  it("accepts multiple valid source IDs", () => {
    const result = verifyGroundedClaim(
      {
        text: "Employees have mixed views.",
        sourceIds: [
          "feedback-001",
          "feedback-002",
        ],
      },
      evidence,
    );

    expect(result).toEqual({ valid: true });
  });

  /**
   * TEST 4 — ONE INVALID SOURCE
   *
   * Even if one reference is valid, every source
   * must exist.
   *
   * EXPECTED: Fail.
   */
  it("rejects a claim containing an invalid source", () => {
    const result = verifyGroundedClaim(
      {
        text: "Employees have mixed views.",
        sourceIds: [
          "feedback-001",
          "feedback-999",
        ],
      },
      evidence,
    );

    expect(result).toEqual({
      valid: false,
      reason: "Unknown source ID: feedback-999",
    });
  });

  /**
   * TEST 5 — NO SOURCES
   *
   * A claim without references cannot be verified.
   *
   * EXPECTED: Fail.
   *
   * Normally Zod would reject this first.
   */
  it("rejects claims without source IDs", () => {
    const result = verifyGroundedClaim(
      {
        text: "Everyone is happy.",
        sourceIds: [],
      },
      evidence,
    );

    expect(result).toEqual({
      valid: false,
      reason: "Claim has no supporting source IDs.",
    });
  });

  /**
   * TEST 6 — NO EVIDENCE
   *
   * No feedback was retrieved.
   *
   * EXPECTED: Fail.
   */
  it("rejects claims when no evidence exists", () => {
    const result = verifyGroundedClaim(
      {
        text: "Employees appreciate management.",
        sourceIds: ["feedback-001"],
      },
      [],
    );

    expect(result).toEqual({
      valid: false,
      reason: "Unknown source ID: feedback-001",
    });
  });

  /**
   * TEST 7 — LIMITATION
   *
   * This test demonstrates that source existence
   * does not prove semantic accuracy.
   *
   * The claim is unsupported by the text, but
   * its source ID exists.
   *
   * EXPECTED: The reference check passes.
   */
  it("does not verify the meaning of a claim", () => {
    const result = verifyGroundedClaim(
      {
        text: "All employees received a pay rise.",
        sourceIds: ["feedback-001"],
      },
      evidence,
    );

    expect(result).toEqual({ valid: true });
  });
});
