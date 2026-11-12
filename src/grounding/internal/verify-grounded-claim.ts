

import type { GroundedClaim } from "../grounded-answer-schema.js";
import type { FeedbackEvidence } from "./verify-feedback-quote.js";

/**
 * CHAPTER 7 — STEP 3B: CLAIM VERIFICATION
 *
 * NEW FILE
 *
 * PURPOSE:
 * Check that every source ID referenced by a
 * factual claim exists in our retrieved evidence.
 *
 * WHY?
 * An LLM can invent source IDs just as easily
 * as it can invent quotations.
 *
 * We must verify references independently.
 *
 * EXAMPLE — PASS:
 *
 * claim:
 * {
 *   text: "An employee described supportive management.",
 *   sourceIds: ["feedback-001"]
 * }
 *
 * evidence:
 * [
 *   {
 *     id: "feedback-001",
 *     text: "My manager is supportive."
 *   }
 * ]
 *
 * EXAMPLE — FAIL:
 *
 * claim:
 * {
 *   text: "Employees received pay rises.",
 *   sourceIds: ["feedback-999"]
 * }
 *
 * evidence:
 * [
 *   {
 *     id: "feedback-001",
 *     text: "My manager is supportive."
 *   }
 * ]
 *
 * IMPORTANT:
 * This verifies source existence, not whether
 * the source semantically supports the claim.
 */

/**
 * CHAPTER 7 — NEW
 *
 * A discriminated union.
 *
 * Successful verification:
 * { valid: true }
 *
 * Failed verification:
 * {
 *   valid: false,
 *   reason: "Unknown source ID: feedback-999"
 * }
 *
 * WHY?
 * TypeScript can narrow the result based on
 * the value of `valid`.
 */
export type ClaimVerificationResult =
  | { valid: true }
  | {
      valid: false;
      reason: string;
    };

/**
 * CHAPTER 7 — NEW
 *
 * Verify a claim against retrieved feedback.
 */
export const verifyGroundedClaim = (
  claim: GroundedClaim,
  evidence: FeedbackEvidence[],
): ClaimVerificationResult => {
  /**
   * DEFENSIVE CHECK
   *
   * Our Zod schema already requires at least
   * one source ID.
   *
   * We check again because this function could
   * be called independently of Zod validation.
   */
  if (claim.sourceIds.length === 0) {
    return {
      valid: false,
      reason: "Claim has no supporting source IDs.",
    };
  }

  /**
   * Check every source ID.
   *
   * Array.some() returns true if at least
   * one evidence record has the matching ID.
   *
   * EXAMPLE:
   *
   * evidence.some(item => item.id === "feedback-001")
   *
   * Returns true when feedback-001 exists.
   */
  for (const sourceId of claim.sourceIds) {
    const sourceExists = evidence.some(
      (item) => item.id === sourceId,
    );

    if (!sourceExists) {
      return {
        valid: false,
        reason: `Unknown source ID: ${sourceId}`,
      };
    }
  }

  /**
   * Every referenced source exists.
   *
   * This does not mean the claim is necessarily true.
   */
  return { valid: true };
};
