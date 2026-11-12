
import { describe, expect, it, vi } from "vitest";

import {
  answerWithVerifiedTools,
  type StructuredToolProvider,
} from "../answer-with-tools.js";

/**
 * CHAPTER 7 — AGENT NUMERICAL VERIFICATION
 *
 * Tests numerical verification across the
 * complete structured tool-calling workflow.
 *
 * Unlike the numerical verifier unit tests,
 * these tests exercise how the agent obtains
 * trusted statistics before accepting a claim.
 *
 * WORKFLOW:
 *
 * 1. Gemini requests getFeedbackStats.
 * 2. The application executes the tool.
 * 3. The tool returns statistics.
 * 4. Gemini produces a structured answer.
 * 5. Zod validates the response.
 * 6. Numerical claims are checked against
 *    trusted application statistics.
 * 7. The agent enforces evidence requirements.
 *
 * ANSWER STATUS:
 *
 * "answered"
 *   Numerical claims must be verifiable.
 *
 * "insufficient_evidence"
 *   The model cannot answer reliably.
 *   Numerical claims must be empty.
 *
 * SECURITY PRINCIPLE:
 *
 * Statistics must come from application-executed
 * tools, not from the AI provider.
 *
 * All providers and tools are mocked.
 * No Gemini API calls are made.
 */

/**
 * NUMERICAL ANSWER FACTORY
 *
 * Creates a structured "answered" response
 * containing one numerical claim.
 *
 * The value parameter represents the number
 * reported by the AI provider.
 *
 * metric: "totalFeedback"
 *   Identifies the statistic being verified.
 *
 * operator: "eq"
 *   Requires the reported value to equal
 *   the trusted statistic.
 *
 * The factory keeps our tests focused on
 * the numerical value being tested.
 */
const makeAnswer = (value: number) => ({
  status: "answered" as const,

  summary: "Feedback analysis completed.",

  claims: [],

  quotations: [],

  numericalClaims: [
    {
      metric: "totalFeedback",
      operator: "eq",
      value,
    },
  ],
});

/**
 * INSUFFICIENT-EVIDENCE FIXTURE
 *
 * Used when the model cannot obtain
 * trustworthy statistics.
 *
 * A non-answer cannot contain numerical
 * claims or other factual claims.
 */
const insufficientEvidenceAnswer = {
  status: "insufficient_evidence" as const,

  summary: "The feedback count is unavailable.",

  claims: [],

  quotations: [],

  numericalClaims: [],
};

describe("answerWithVerifiedTools numerical verification", () => {
  /**
   * TEST 1 — CORRECT NUMERICAL CLAIM
   *
   * The provider requests getFeedbackStats.
   * The tool returns totalFeedback: 42.
   *
   * The provider then reports 42.
   *
   * EXPECTED:
   * Numerical verification succeeds and
   * the agent accepts the answer.
   */
  it("accepts a numerical claim matching the tool result", async () => {
    const provider: StructuredToolProvider = {
      askQuestion: vi.fn().mockResolvedValue({
        type: "tool_call",
        toolCall: {
          name: "getFeedbackStats",
          args: {},
        },
      }),

      submitToolResult: vi.fn().mockResolvedValue({
        type: "answer",
        answer: makeAnswer(42),
      }),
    };

    const result = await answerWithVerifiedTools({
      question: "How many feedback submissions are there?",
      provider,
      searchFeedback: vi.fn(),
      getFeedbackStats: vi.fn().mockReturnValue({
        totalFeedback: 42,
      }),
      evidenceRequirement: "statistics",
    });

    expect(result.status).toBe("answered");
    expect(result.numericalClaims[0]?.value).toBe(42);
  });

  /**
   * TEST 2 — INCORRECT NUMERICAL CLAIM
   *
   * The trusted statistics report 42,
   * but the provider claims the total is 50.
   *
   * The answer has a valid Zod structure,
   * but the numerical claim is incorrect.
   *
   * EXPECTED:
   * Reject the claim during verification.
   *
   * This demonstrates that structural validity
   * does not guarantee factual correctness.
   */
  it("rejects a numerical claim that contradicts the tool result", async () => {
    const provider: StructuredToolProvider = {
      askQuestion: vi.fn().mockResolvedValue({
        type: "tool_call",
        toolCall: {
          name: "getFeedbackStats",
          args: {},
        },
      }),

      submitToolResult: vi.fn().mockResolvedValue({
        type: "answer",
        answer: makeAnswer(50),
      }),
    };

    await expect(
      answerWithVerifiedTools({
        question: "How many submissions?",
        provider,
        searchFeedback: vi.fn(),
        getFeedbackStats: vi.fn().mockReturnValue({
          totalFeedback: 42,
        }),
        evidenceRequirement: "statistics",
      }),
    ).rejects.toThrow("Numerical claim failed");
  });

  /**
   * TEST 3 — NUMERICAL CLAIM WITHOUT STATISTICS
   *
   * The provider immediately returns an answer
   * without requesting getFeedbackStats.
   *
   * The agent therefore has no trusted
   * statistics to verify the numerical claim.
   *
   * EXPECTED:
   * Numerical verification rejects the claim.
   *
   * NOTE:
   * Our agent now verifies the answer before
   * enforcing evidence requirements.
   *
   * This means the numerical verifier reports
   * the failure before the missing-evidence check.
   */
  it("rejects numerical claims without tool evidence", async () => {
    const provider: StructuredToolProvider = {
      askQuestion: vi.fn().mockResolvedValue({
        type: "answer",
        answer: makeAnswer(42),
      }),

      submitToolResult: vi.fn(),
    };

    await expect(
      answerWithVerifiedTools({
        question: "How many submissions?",
        provider,
        searchFeedback: vi.fn(),
        getFeedbackStats: vi.fn(),
        evidenceRequirement: "statistics",
      }),
    ).rejects.toThrow("Grounding verification failed: Trusted statistics are missing or invalid.");
  });

  /**
   * TEST 4 — MALFORMED STATISTICS TOOL RESULT
   *
   * The provider requests getFeedbackStats,
   * but the tool returns:
   *
   * totalFeedback: "42"
   *
   * This is invalid because the value
   * must be a non-negative integer.
   *
   * The malformed result is not accepted
   * as trusted statistics.
   *
   * EXPECTED:
   * Numerical verification rejects the claim
   * because trusted statistics are unavailable.
   */
  it("rejects malformed tool statistics", async () => {
    const provider: StructuredToolProvider = {
      askQuestion: vi.fn().mockResolvedValue({
        type: "tool_call",
        toolCall: {
          name: "getFeedbackStats",
          args: {},
        },
      }),

      submitToolResult: vi.fn().mockResolvedValue({
        type: "answer",
        answer: makeAnswer(42),
      }),
    };

    await expect(
      answerWithVerifiedTools({
        question: "How many submissions?",
        provider,
        searchFeedback: vi.fn(),
        getFeedbackStats: vi.fn().mockReturnValue({
          totalFeedback: "42",
        }),
        evidenceRequirement: "statistics",
      }),
    ).rejects.toThrow("Grounding verification failed: Trusted statistics are missing or invalid.");
  });

  /**
   * TEST 5 — MISSING STATISTICS, VALID NON-ANSWER
   *
   * The provider cannot obtain statistics
   * and explicitly declines to answer.
   *
   * No tools are executed.
   *
   * EXPECTED:
   * Accept the insufficient-evidence response.
   */
  it("accepts insufficient evidence when statistics are unavailable", async () => {
    const provider: StructuredToolProvider = {
      askQuestion: vi.fn().mockResolvedValue({
        type: "answer",
        answer: insufficientEvidenceAnswer,
      }),

      submitToolResult: vi.fn(),
    };

    const result = await answerWithVerifiedTools({
      question: "How many submissions?",
      provider,
      searchFeedback: vi.fn(),
      getFeedbackStats: vi.fn(),
      evidenceRequirement: "statistics",
    });

    expect(result).toEqual(insufficientEvidenceAnswer);
  });

  /**
   * TEST 6 — NON-ANSWER CONTAINING A NUMBER
   *
   * The provider declares insufficient evidence
   * but also supplies a numerical claim.
   *
   * Our discriminated union requires
   * numericalClaims to be empty for this status.
   *
   * EXPECTED:
   * Zod rejects the invalid response.
   */
  it("rejects insufficient evidence containing numerical claims", async () => {
    const invalidAnswer = {
      ...insufficientEvidenceAnswer,

      numericalClaims: [
        {
          metric: "totalFeedback",
          operator: "eq",
          value: 42,
        },
      ],
    };

    const provider: StructuredToolProvider = {
      askQuestion: vi.fn().mockResolvedValue({
        type: "answer",
        answer: invalidAnswer,
      }),

      submitToolResult: vi.fn(),
    };

    await expect(
      answerWithVerifiedTools({
        question: "How many submissions?",
        provider,
        searchFeedback: vi.fn(),
        getFeedbackStats: vi.fn(),
        evidenceRequirement: "statistics",
      }),
    ).rejects.toThrow();
  });
});
