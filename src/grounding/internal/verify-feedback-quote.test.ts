
import { describe, expect, it } from "vitest";

import {
  verifyFeedbackQuote,
  type FeedbackEvidence,
} from "./verify-feedback-quote.js";

/**
 * CHAPTER 7 — STEP 3: GROUNDING & EVIDENCE VERIFICATION
 *
 * NEW TEST FILE
 *
 * PURPOSE:
 * Ensure our quotation verifier accepts genuine
 * evidence and rejects unsupported quotations.
 *
 * WHY UNIT TEST THIS?
 * Grounding is a reliability requirement.
 *
 * If we accidentally weaken the verification logic
 * in future, these tests should catch the regression.
 *
 * All tests are deterministic and run locally.
 * No Gemini API calls are made.
 */
describe("verifyFeedbackQuote", () => {
  /**
   * SHARED TEST DATA
   *
   * These are representative employee feedback records.
   *
   * Each test can reference the same evidence without
   * creating a new array.
   */
  const evidence: FeedbackEvidence[] = [
    {
      id: "feedback-001",
      text:
        "My manager is supportive and always " +
        "listens to my concerns.",
    },
    {
      id: "feedback-002",
      text:
        "Senior management rarely recognises " +
        "the extra effort our team puts in.",
    },
  ];

  /**
   * TEST 1 — VALID QUOTATION
   *
   * A quotation that matches its source should pass.
   */
  it("accepts a quotation from the correct source", () => {
    const result = verifyFeedbackQuote(
      {
        sourceId: "feedback-001",
        quote:
          "My manager is supportive and always " +
          "listens to my concerns.",
      },
      evidence,
    );

    expect(result).toEqual({ valid: true });
  });

  /**
   * TEST 2 — PARTIAL QUOTATION
   *
   * We allow a smaller passage from a longer comment.
   *
   * This is useful when Gemini quotes only the
   * relevant portion of an employee's feedback.
   */
  it("accepts a partial quotation from the source", () => {
    const result = verifyFeedbackQuote(
      {
        sourceId: "feedback-001",
        quote: "My manager is supportive",
      },
      evidence,
    );

    expect(result.valid).toBe(true);
  });

  /**
   * TEST 3 — FABRICATED QUOTATION
   *
   * The source exists, but the quoted words do not.
   *
   * This is the type of problem we encountered
   * during our Chapter 6 Gemini experiment.
   */
  it("rejects a quotation not found in the source", () => {
    const result = verifyFeedbackQuote(
      {
        sourceId: "feedback-001",
        quote: "Everyone is happy with management.",
      },
      evidence,
    );

    expect(result).toEqual({
      valid: false,
      reason:
        "Quotation does not match source: feedback-001",
    });
  });

  /**
   * TEST 4 — FABRICATED SOURCE ID
   *
   * An LLM might generate a plausible-looking ID
   * that doesn't actually exist.
   *
   * We must reject it even if the quotation
   * sounds reasonable.
   */
  it("rejects an unknown source ID", () => {
    const result = verifyFeedbackQuote(
      {
        sourceId: "feedback-999",
        quote: "My manager is supportive",
      },
      evidence,
    );

    expect(result).toEqual({
      valid: false,
      reason: "Unknown source ID: feedback-999",
    });
  });

  /**
   * TEST 5 — EMPTY QUOTATION
   *
   * An empty string would otherwise pass an
   * includes() comparison.
   */
  it("rejects empty quotations", () => {
    const result = verifyFeedbackQuote(
      {
        sourceId: "feedback-001",
        quote: "   ",
      },
      evidence,
    );

    expect(result).toEqual({
      valid: false,
      reason: "Quotation is empty.",
    });
  });

  /**
   * TEST 6 — WHITESPACE DIFFERENCES
   *
   * Formatting differences should not invalidate
   * an otherwise identical quotation.
   */
  it("allows differences in whitespace", () => {
    const result = verifyFeedbackQuote(
      {
        sourceId: "feedback-001",
        quote:
          "My manager is supportive\n" +
          "and always listens to my concerns.",
      },
      evidence,
    );

    expect(result.valid).toBe(true);
  });

  /**
   * TEST 7 — WRONG SOURCE ATTRIBUTION
   *
   * A quotation might exist in the evidence,
   * but be attributed to the wrong employee comment.
   *
   * We must verify the quotation against its
   * claimed source, not just any source.
   */
  it("rejects a quote attributed to the wrong source", () => {
    const result = verifyFeedbackQuote(
      {
        sourceId: "feedback-002",
        quote: "My manager is supportive",
      },
      evidence,
    );

    expect(result.valid).toBe(false);
  });
});
