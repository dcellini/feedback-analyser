import { groundedAnswerSchema, type GroundedAnswer } from "./grounded-answer-schema.js";
import { type FeedbackEvidence, verifyFeedbackQuote } from "./internal/verify-feedback-quote.js";
import { verifyGroundedClaim } from "./internal/verify-grounded-claim.js";
import { verifyNumericalClaim } from "./internal/verify-numerical-claim.js";

// CHAPTER 8: grounding failures now use a dedicated error class (same message).
import { GroundingVerificationError } from "./grounding-verification-error.js";

/**
 * CHAPTER 7 — GROUNDED ANSWER VERIFICATION
 *
 * Validates and verifies structured AI responses
 * before they are accepted by our application.
 *
 * The response can have two states:
 *
 * 1. "answered"
 *    The model provides an answer that must pass
 *    our grounding and numerical checks.
 *
 * 2. "insufficient_evidence"
 *    The model explicitly states that it cannot
 *    answer reliably using the available evidence.
 *
 * VERIFICATION PROCESS:
 *
 * 1. Validate the response structure using Zod.
 * 2. Handle insufficient-evidence responses.
 * 3. Verify quotations against retrieved feedback.
 * 4. Verify feedback claim source references.
 * 5. Verify numerical claims against trusted statistics.
 *
 * IMPORTANT:
 *
 * Trusted statistics must originate from
 * application-executed tools, not from Gemini.
 *
 * The verifier checks structured claims and
 * quotations. It does not independently verify
 * every statement in the free-text summary.
 */

export const validateGroundedAnswer = (
  answer: unknown,
  evidence: FeedbackEvidence[],
  trustedStats?: unknown,
): GroundedAnswer => {
  /**
   * STEP 1 — VALIDATE RESPONSE STRUCTURE
   *
   * Model output is untrusted until Zod parses it.
   *
   * The discriminated union uses the "status"
   * property to select the correct schema.
   *
   * This also ensures insufficient-evidence
   * responses cannot contain factual claims,
   * quotations or numerical claims.
   */
  const validatedAnswer = groundedAnswerSchema.parse(answer);

  /**
   * STEP 2 — HANDLE INSUFFICIENT EVIDENCE
   *
   * The model has explicitly indicated that
   * it cannot answer the question reliably.
   *
   * Zod has already verified that all three
   * claim arrays are empty.
   *
   * There are therefore no structured claims
   * or quotations to verify.
   *
   * Return the validated non-answer.
   *
   * NOTE:
   * This does not independently establish
   * whether the model genuinely lacked evidence.
   */
  if (validatedAnswer.status === "insufficient_evidence") {
    return validatedAnswer;
  }

  /**
   * STEP 3 — VERIFY QUOTATIONS
   *
   * Every quotation must match the text of
   * a retrieved feedback record.
   *
   * Fabricated quotations or incorrect source
   * references must cause verification to fail.
   */
  for (const quotation of validatedAnswer.quotations) {
    const result = verifyFeedbackQuote(quotation, evidence);

    if (!result.valid) {
      throw new GroundingVerificationError(result.reason);
    }
  }

  /**
   * STEP 4 — VERIFY FEEDBACK CLAIM SOURCES
   *
   * Every factual claim must reference one
   * or more retrieved feedback records.
   *
   * This establishes that referenced sources
   * exist, but does not prove that the sources
   * semantically support every claim.
   */
  for (const claim of validatedAnswer.claims) {
    const result = verifyGroundedClaim(claim, evidence);

    if (!result.valid) {
      throw new GroundingVerificationError(result.reason);
    }
  }

  /**
   * STEP 5 — VERIFY NUMERICAL CLAIMS
   *
   * Numerical claims are checked against
   * trusted application statistics.
   *
   * Our existing verifyNumericalClaim function
   * expects a "text" property.
   *
   * We supply a placeholder because our answer
   * schema deliberately excludes model-generated
   * numerical display text.
   *
   * Only the structured metric, operator and
   * value are used for numerical verification.
   */
  for (const claim of validatedAnswer.numericalClaims) {
    const result = verifyNumericalClaim(
      {
        ...claim,
        text: "Structured numerical claim",
      },
      trustedStats,
    );

    if (!result.valid) {
      throw new GroundingVerificationError(result.reason);
    }
  }

  /**
   * STEP 6 — RETURN VERIFIED ANSWER
   *
   * All applicable verification checks passed.
   *
   * The caller receives the validated structured
   * answer, including its "answered" status.
   *
   * Numerical display text can be generated
   * from the verified structured fields.
   */
  return validatedAnswer;
};
