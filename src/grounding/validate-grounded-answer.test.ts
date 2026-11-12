
import { describe, expect, it } from "vitest";

import { validateGroundedAnswer } from "./validate-grounded-answer.js";
import type { FeedbackEvidence } from "./internal/verify-feedback-quote.js";

/**
 * CHAPTER 7 — GROUNDED ANSWER VALIDATION
 *
 * Tests the validation of structured AI answers
 * against feedback retrieved by our application.
 *
 * The validator performs:
 *
 * 1. STRUCTURAL VALIDATION
 *    Zod checks the expected response shape.
 *
 * 2. ANSWER STATUS VALIDATION
 *    The response must be either:
 *    - "answered"
 *    - "insufficient_evidence"
 *
 * 3. QUOTATION VERIFICATION
 *    Quoted text must exist in the referenced
 *    feedback record.
 *
 * 4. CLAIM SOURCE VERIFICATION
 *    Every referenced source ID must exist
 *    in the retrieved evidence.
 *
 * 5. NUMERICAL VERIFICATION
 *    Structured numerical claims are checked
 *    against trusted statistics.
 *
 * IMPORTANT LIMITATIONS:
 *
 * Valid source references do not prove that
 * the referenced feedback supports the claim.
 *
 * The validator does not independently verify
 * factual statements in the free-text summary.
 *
 * Numerical verification is tested in greater
 * detail in separate tests.
 *
 * All tests use local fixtures.
 * No Gemini API calls are made.
 */

/**
 * TRUSTED FEEDBACK EVIDENCE
 *
 * Simulates records returned by searchFeedback.
 *
 * The validator uses these records to check
 * quotations and claim source references.
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

/**
 * VALID ANSWER FIXTURE
 *
 * A complete response with status "answered".
 *
 * Tests can spread this object and override
 * individual properties to isolate failures.
 *
 * numericalClaims is empty because this
 * fixture makes no numerical claims.
 */
const validAnswer = {
  status: "answered" as const,

  summary: "Employees have mixed views of management.",

  claims: [
    {
      text: "An employee described supportive management.",
      sourceIds: ["feedback-001"],
    },
    {
      text: "An employee suggested communication could improve.",
      sourceIds: ["feedback-002"],
    },
  ],

  quotations: [
    {
      sourceId: "feedback-001",
      quote: "My manager is supportive.",
    },
  ],

  numericalClaims: [],
};

/**
 * INSUFFICIENT-EVIDENCE FIXTURE
 *
 * A valid non-answer.
 *
 * The summary explains the limitation,
 * while all claim arrays remain empty.
 */
const insufficientEvidenceAnswer = {
  status: "insufficient_evidence" as const,

  summary: "There is not enough evidence to answer reliably.",

  claims: [],

  quotations: [],

  numericalClaims: [],
};

describe("validateGroundedAnswer", () => {
  /**
   * TEST 1 — VALID GROUNDED ANSWER
   *
   * The answer has:
   * - A valid status.
   * - A valid structure.
   * - An exact quotation.
   * - Known source references.
   *
   * EXPECTED: Validation succeeds.
   */
  it("accepts a valid grounded answer", () => {
    expect(
      validateGroundedAnswer(validAnswer, evidence),
    ).toEqual(validAnswer);
  });

  /**
   * TEST 2 — FABRICATED QUOTATION
   *
   * The quotation does not exist in the
   * referenced feedback record.
   *
   * EXPECTED: Grounding verification fails.
   */
  it("rejects fabricated quotations", () => {
    const answer = {
      ...validAnswer,
      quotations: [
        {
          sourceId: "feedback-001",
          quote: "Everyone loves management.",
        },
      ],
    };

    expect(() =>
      validateGroundedAnswer(answer, evidence),
    ).toThrow("Grounding verification failed");
  });

  /**
   * TEST 3 — UNKNOWN SOURCE ID
   *
   * feedback-999 was not retrieved.
   *
   * EXPECTED: The unknown source is rejected.
   */
  it("rejects claims with unknown source IDs", () => {
    const answer = {
      ...validAnswer,
      claims: [
        {
          text: "Employees received pay rises.",
          sourceIds: ["feedback-999"],
        },
      ],
    };

    expect(() =>
      validateGroundedAnswer(answer, evidence),
    ).toThrow("Unknown source ID: feedback-999");
  });

  /**
   * TEST 4 — MISSING CLAIM SOURCES
   *
   * Every factual claim requires at least
   * one source ID.
   *
   * EXPECTED: Zod rejects the empty array.
   */
  it("rejects claims without source references", () => {
    const answer = {
      ...validAnswer,
      claims: [
        {
          text: "Everyone is happy.",
          sourceIds: [],
        },
      ],
    };

    expect(() =>
      validateGroundedAnswer(answer, evidence),
    ).toThrow();
  });

  /**
   * TEST 5 — INVALID STRUCTURE
   *
   * quotations must be an array.
   *
   * EXPECTED: Zod rejects the string.
   */
  it("rejects structurally invalid answers", () => {
    const answer = {
      ...validAnswer,
      quotations: "not an array",
    };

    expect(() =>
      validateGroundedAnswer(answer, evidence),
    ).toThrow();
  });

  /**
   * TEST 6 — MISSING CLAIMS FIELD
   *
   * claims is required even when empty.
   *
   * EXPECTED: Zod rejects the missing field.
   */
  it("rejects answers missing claims", () => {
    const answer = {
      status: "answered",
      summary: "Employees appreciate management.",
      quotations: [],
      numericalClaims: [],
    };

    expect(() =>
      validateGroundedAnswer(answer, evidence),
    ).toThrow();
  });

  /**
   * TEST 7 — MULTIPLE SOURCE REFERENCES
   *
   * A claim can reference more than one
   * retrieved feedback record.
   *
   * EXPECTED: Validation succeeds.
   */
  it("accepts claims referencing multiple sources", () => {
    const answer = {
      ...validAnswer,
      claims: [
        {
          text: "Employees have mixed views.",
          sourceIds: [
            "feedback-001",
            "feedback-002",
          ],
        },
      ],
    };

    expect(
      validateGroundedAnswer(answer, evidence),
    ).toEqual(answer);
  });

  /**
   * TEST 8 — SEMANTIC VERIFICATION LIMITATION
   *
   * The claim discusses pay rises, but the
   * referenced feedback only mentions management.
   *
   * The source ID exists, so the validator
   * currently accepts this claim.
   *
   * EXPECTED: Validation succeeds.
   *
   * This test documents a known limitation.
   */
  it("does not yet verify semantic support", () => {
    const answer = {
      ...validAnswer,
      claims: [
        {
          text: "All employees received pay rises.",
          sourceIds: ["feedback-001"],
        },
      ],
    };

    expect(
      validateGroundedAnswer(answer, evidence),
    ).toEqual(answer);
  });

  /**
   * TEST 9 — VALID INSUFFICIENT EVIDENCE
   *
   * The model explicitly declines to answer.
   *
   * All claim arrays are empty.
   *
   * EXPECTED: Return the valid non-answer,
   * even when no evidence was retrieved.
   */
  it("accepts a valid insufficient-evidence response", () => {
    expect(
      validateGroundedAnswer(
        insufficientEvidenceAnswer,
        [],
      ),
    ).toEqual(insufficientEvidenceAnswer);
  });

  /**
   * TEST 10 — INSUFFICIENT EVIDENCE WITH CLAIMS
   *
   * A non-answer must not contain factual claims.
   *
   * EXPECTED: Zod rejects the response.
   */
  it("rejects insufficient evidence containing claims", () => {
    const answer = {
      ...insufficientEvidenceAnswer,
      claims: [
        {
          text: "Employees are satisfied.",
          sourceIds: ["feedback-001"],
        },
      ],
    };

    expect(() =>
      validateGroundedAnswer(answer, evidence),
    ).toThrow();
  });

  /**
   * TEST 11 — INSUFFICIENT EVIDENCE WITH QUOTATIONS
   *
   * A non-answer must not contain quotations.
   *
   * EXPECTED: Zod rejects the response.
   */
  it("rejects insufficient evidence containing quotations", () => {
    const answer = {
      ...insufficientEvidenceAnswer,
      quotations: [
        {
          sourceId: "feedback-001",
          quote: "My manager is supportive.",
        },
      ],
    };

    expect(() =>
      validateGroundedAnswer(answer, evidence),
    ).toThrow();
  });

  /**
   * TEST 12 — INSUFFICIENT EVIDENCE WITH NUMBERS
   *
   * A non-answer must not contain numerical claims.
   *
   * EXPECTED: Zod rejects the response.
   *
   * We use an arbitrary array entry because
   * the schema requires the array to be empty.
   */
  it("rejects insufficient evidence containing numerical claims", () => {
    const answer = {
      ...insufficientEvidenceAnswer,
      numericalClaims: [
        {
          metric: "totalFeedback",
          operator: "eq",
          value: 3,
        },
      ],
    };

    expect(() =>
      validateGroundedAnswer(answer, evidence),
    ).toThrow();
  });

  /**
   * TEST 13 — UNKNOWN ANSWER STATUS
   *
   * The discriminated union accepts only
   * the two explicitly defined statuses.
   *
   * EXPECTED: Zod rejects an unknown status.
   */
  it("rejects unknown answer statuses", () => {
    const answer = {
      ...validAnswer,
      status: "maybe",
    };

    expect(() =>
      validateGroundedAnswer(answer, evidence),
    ).toThrow();
  });

  /**
   * TEST 14 — MISSING ANSWER STATUS
   *
   * status is mandatory for all responses.
   *
   * EXPECTED: Zod rejects the missing status.
   */
  it("rejects answers without a status", () => {
    const { status: _status, ...answer } = validAnswer;

    expect(() =>
      validateGroundedAnswer(answer, evidence),
    ).toThrow();
  });
});
