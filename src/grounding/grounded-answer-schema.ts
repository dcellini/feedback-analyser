
import { z } from "zod";
import { numericalClaimSchema } from "./internal/verify-numerical-claim.js";



/**
 * CHAPTER 7 — STRUCTURED GROUNDED ANSWERS
 *
 * Every AI response must explicitly indicate
 * whether it can answer the user's question.
 *
 * Two possible states:
 *
 * 1. "answered"
 *    The model provides an answer that must
 *    pass our existing grounding checks.
 *
 * 2. "insufficient_evidence"
 *    The model cannot answer reliably using
 *    the available evidence.
 *
 * We use a discriminated union so Zod can
 * enforce different rules for each state.
 */

/**
 * FEEDBACK CLAIM
 *
 * A factual claim supported by one or more
 * retrieved feedback records.
 */
export const groundedClaimSchema = z.strictObject({
  text: z.string().min(1),

  sourceIds: z.array(
    z.string().min(1),
  ).min(1),
});

/**
 * GROUNDED QUOTATION
 *
 * A quotation must reference the feedback
 * record from which it originated.
 */
export const groundedQuotationSchema = z.strictObject({
  sourceId: z.string().min(1),

  quote: z.string().min(1),
});

/**
 * NUMERICAL CLAIM
 *
 * Only structured numerical fields are accepted.
 *
 * The free-text "text" property is excluded
 * because display text should be generated
 * from verified numerical values.
 */
export const groundedNumericalClaimSchema =
  numericalClaimSchema.omit({
    text: true,
  });

/**
 * ANSWERED RESPONSE
 *
 * The model claims to have sufficient evidence
 * to answer the user's question.
 *
 * Our application must still verify the
 * quotations, source IDs and numerical claims.
 */
const answeredSchema = z.strictObject({
  status: z.literal("answered"),

  summary: z.string().min(1),

  claims: z.array(groundedClaimSchema),

  quotations: z.array(groundedQuotationSchema),

  numericalClaims: z.array(
    groundedNumericalClaimSchema,
  ),
});

/**
 * INSUFFICIENT EVIDENCE RESPONSE
 *
 * The model explicitly indicates that it
 * cannot answer reliably.
 *
 * We require all claim arrays to be empty.
 *
 * This prevents an insufficient-evidence
 * response from also containing unsupported
 * factual claims or quotations.
 */
const insufficientEvidenceSchema = z.strictObject({
  status: z.literal("insufficient_evidence"),

  summary: z.string().min(1),

  claims: z.array(groundedClaimSchema).length(0),

  quotations: z.array(groundedQuotationSchema).length(0),

  numericalClaims: z.array(
    groundedNumericalClaimSchema,
  ).length(0),
});

/**
 * GROUNDED ANSWER SCHEMA
 *
 * Zod uses the "status" field to determine
 * which response structure to validate.
 *
 * This is called a discriminated union.
 *
 * It gives us a type-safe way to represent
 * both successful and insufficient-evidence
 * responses.
 */
export const groundedAnswerSchema = z.discriminatedUnion(
  "status",
  [
    answeredSchema,
    insufficientEvidenceSchema,
  ],
);

export type GroundedAnswer = z.infer<
  typeof groundedAnswerSchema
>;

export type GroundedClaim = z.infer<
  typeof groundedClaimSchema
>;
