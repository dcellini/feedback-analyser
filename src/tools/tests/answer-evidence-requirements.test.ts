
import { describe, expect, it, vi } from "vitest";

import {
  answerWithVerifiedTools,
  type StructuredToolProvider,
} from "../answer-with-tools.js";

import type {
  SearchFeedbackTool,
} from "../internal/execute-tool-call.js";

import type {
  GetFeedbackStatsTool,
} from "../implementations/get-feedback-stats-tool.js";

/**
 * CHAPTER 7 — AGENT EVIDENCE REQUIREMENTS
 *
 * Tests whether the verified agent has retrieved
 * the evidence required to answer a question.
 *
 * Evidence requirements:
 *
 * "feedback"   - Retrieved feedback records.
 * "statistics" - Trusted feedback statistics.
 * "both"       - Both evidence types.
 * "none"       - No minimum evidence requirement.
 *
 * ANSWER STATUS:
 *
 * "answered"
 *   The agent is attempting to answer.
 *   Required evidence must be present.
 *
 * "insufficient_evidence"
 *   The agent cannot answer reliably.
 *   Missing evidence is an acceptable reason
 *   to return this structured non-answer.
 *
 * WHY THIS MATTERS:
 *
 * A model can produce a valid JSON response
 * without retrieving any actual evidence.
 *
 * Zod validates the response structure,
 * but does not establish factual correctness.
 *
 * Our application must enforce the required
 * evidence before accepting an answer.
 *
 * All tools and providers are mocked.
 * No Gemini API calls are made.
 */

/**
 * MOCK FEEDBACK SEARCH TOOL
 *
 * Returns one feedback record.
 *
 * Supplying this tool to the agent does not
 * count as having retrieved evidence.
 *
 * The provider must actually request it.
 */
const searchFeedback: SearchFeedbackTool = async () => [
  {
    id: "feedback-001",
    text: "My manager is supportive.",
    similarity: 0.95,
  },
];

/**
 * MOCK STATISTICS TOOL
 *
 * Returns a valid trusted statistics object.
 *
 * The agent must execute this tool before
 * its result can satisfy a statistics requirement.
 */
const getFeedbackStats: GetFeedbackStatsTool = () => ({
  totalFeedback: 1,
});

/**
 * ANSWER FIXTURE
 *
 * Represents a structurally valid answer
 * with no claims or quotations.
 *
 * Whether it is acceptable depends on the
 * evidence requirements enforced by the agent.
 */
const answeredResponse = {
  status: "answered" as const,
  summary: "Employees appreciate management.",
  claims: [],
  quotations: [],
  numericalClaims: [],
};

/**
 * INSUFFICIENT-EVIDENCE FIXTURE
 *
 * Represents a valid non-answer.
 *
 * All claim arrays must be empty.
 */
const insufficientEvidenceResponse = {
  status: "insufficient_evidence" as const,
  summary: "There is not enough evidence to answer reliably.",
  claims: [],
  quotations: [],
  numericalClaims: [],
};

/**
 * IMMEDIATE PROVIDER FACTORY
 *
 * Simulates an AI that returns a final response
 * without requesting any tools.
 *
 * This lets us test evidence enforcement
 * independently of tool execution.
 *
 * Both provider methods are implemented
 * to satisfy StructuredToolProvider.
 */
const createImmediateProvider = (
  answer: unknown = answeredResponse,
): StructuredToolProvider => ({
  askQuestion: vi.fn(async () => ({
    type: "answer" as const,
    answer,
  })),

  submitToolResult: vi.fn(async () => ({
    type: "answer" as const,
    answer,
  })),
});

describe("Verified agent evidence requirements", () => {
  /**
   * TEST 1 — MISSING FEEDBACK
   *
   * The provider answers without requesting
   * searchFeedback.
   *
   * EXPECTED:
   * Reject because feedback evidence is required.
   */
  it("rejects answers without required feedback evidence", async () => {
    await expect(
      answerWithVerifiedTools({
        question: "What do employees say?",
        provider: createImmediateProvider(),
        searchFeedback,
        getFeedbackStats,
        evidenceRequirement: "feedback",
      }),
    ).rejects.toThrow(
      "required feedback evidence is missing",
    );
  });

  /**
   * TEST 2 — MISSING STATISTICS
   *
   * The provider answers without requesting
   * getFeedbackStats.
   *
   * EXPECTED:
   * Reject because trusted statistics are required.
   */
  it("rejects answers without required statistics evidence", async () => {
    await expect(
      answerWithVerifiedTools({
        question: "How many feedback records exist?",
        provider: createImmediateProvider(),
        searchFeedback,
        getFeedbackStats,
        evidenceRequirement: "statistics",
      }),
    ).rejects.toThrow(
      "required statistics evidence is missing",
    );
  });

  /**
   * TEST 3 — BOTH EVIDENCE TYPES MISSING
   *
   * The provider answers without requesting
   * either tool.
   *
   * EXPECTED:
   * Reject due to missing feedback evidence.
   *
   * The agent checks feedback requirements
   * before statistics requirements.
   */
  it("rejects answers missing both required evidence types", async () => {
    await expect(
      answerWithVerifiedTools({
        question: "Summarise feedback and give the total.",
        provider: createImmediateProvider(),
        searchFeedback,
        getFeedbackStats,
        evidenceRequirement: "both",
      }),
    ).rejects.toThrow(
      "required feedback evidence is missing",
    );
  });

  /**
   * TEST 4 — NO EVIDENCE REQUIRED
   *
   * The provider answers immediately.
   *
   * evidenceRequirement is "none".
   *
   * EXPECTED:
   * Accept the structurally valid answer.
   *
   * This does not independently verify
   * the summary's factual correctness.
   */
  it("allows answers when no evidence is required", async () => {
    const result = await answerWithVerifiedTools({
      question: "What does this application do?",
      provider: createImmediateProvider(),
      searchFeedback,
      getFeedbackStats,
      evidenceRequirement: "none",
    });

    expect(result.status).toBe("answered");
    expect(result.quotations).toEqual([]);
  });

  /**
   * TEST 5 — FEEDBACK SUCCESSFULLY RETRIEVED
   *
   * The provider requests searchFeedback.
   *
   * The tool returns a real feedback record
   * from our local fixture.
   *
   * The provider then supplies a quotation
   * that matches the retrieved evidence.
   *
   * EXPECTED:
   * The answer passes verification.
   */
  it("accepts answers when required feedback exists", async () => {
    const provider: StructuredToolProvider = {
      askQuestion: vi.fn(async () => ({
        type: "tool_call" as const,
        toolCall: {
          name: "searchFeedback",
          args: {
            query: "management",
            topK: 5,
          },
        },
      })),

      submitToolResult: vi.fn(async () => ({
        type: "answer" as const,
        answer: {
          status: "answered",
          summary: "Some employees appreciate management.",
          claims: [],
          quotations: [
            {
              sourceId: "feedback-001",
              quote: "My manager is supportive.",
            },
          ],
          numericalClaims: [],
        },
      })),
    };

    const result = await answerWithVerifiedTools({
      question: "What do employees say?",
      provider,
      searchFeedback,
      getFeedbackStats,
      evidenceRequirement: "feedback",
    });

    expect(result.status).toBe("answered");
    expect(result.quotations).toHaveLength(1);
  });

  /**
   * TEST 6 — INSUFFICIENT FEEDBACK
   *
   * The provider explicitly declines to answer
   * because it lacks feedback evidence.
   *
   * No tools are executed.
   *
   * EXPECTED:
   * Accept the valid non-answer.
   */
  it("accepts insufficient evidence when feedback is required", async () => {
    const result = await answerWithVerifiedTools({
      question: "What do employees say?",
      provider: createImmediateProvider(
        insufficientEvidenceResponse,
      ),
      searchFeedback,
      getFeedbackStats,
      evidenceRequirement: "feedback",
    });

    expect(result.status).toBe("insufficient_evidence");
    expect(result.claims).toEqual([]);
  });

  /**
   * TEST 7 — INSUFFICIENT STATISTICS
   *
   * The provider cannot answer a question
   * requiring trusted statistics.
   *
   * EXPECTED:
   * Return a valid non-answer instead of
   * throwing a missing-statistics error.
   */
  it("accepts insufficient evidence when statistics are required", async () => {
    const result = await answerWithVerifiedTools({
      question: "How many feedback records exist?",
      provider: createImmediateProvider(
        insufficientEvidenceResponse,
      ),
      searchFeedback,
      getFeedbackStats,
      evidenceRequirement: "statistics",
    });

    expect(result.status).toBe("insufficient_evidence");
    expect(result.numericalClaims).toEqual([]);
  });

  /**
   * TEST 8 — BOTH EVIDENCE TYPES UNAVAILABLE
   *
   * Neither feedback nor statistics were retrieved.
   *
   * The provider explicitly returns a non-answer.
   *
   * EXPECTED:
   * Accept the insufficient-evidence response.
   */
  it("accepts insufficient evidence when both evidence types are required", async () => {
    const result = await answerWithVerifiedTools({
      question: "Summarise feedback and give the total.",
      provider: createImmediateProvider(
        insufficientEvidenceResponse,
      ),
      searchFeedback,
      getFeedbackStats,
      evidenceRequirement: "both",
    });

    expect(result.status).toBe("insufficient_evidence");
    expect(result.quotations).toEqual([]);
  });

  /**
   * TEST 9 — INVALID NON-ANSWER
   *
   * The provider declares insufficient evidence
   * but also supplies a factual claim.
   *
   * Our discriminated union requires all claim
   * arrays to be empty for this status.
   *
   * EXPECTED:
   * Zod rejects the malformed non-answer.
   */
  it("rejects insufficient evidence containing factual claims", async () => {
    const invalidAnswer = {
      ...insufficientEvidenceResponse,
      claims: [
        {
          text: "Everyone is happy.",
          sourceIds: ["feedback-001"],
        },
      ],
    };

    await expect(
      answerWithVerifiedTools({
        question: "What do employees say?",
        provider: createImmediateProvider(invalidAnswer),
        searchFeedback,
        getFeedbackStats,
        evidenceRequirement: "feedback",
      }),
    ).rejects.toThrow();
  });

  /**
   * TEST 10 — PARTIAL EVIDENCE
   *
   * The question requires both feedback
   * and statistics.
   *
   * The provider retrieves feedback but never
   * requests getFeedbackStats.
   *
   * EXPECTED:
   * Reject an "answered" response because
   * the required statistics are missing.
   */
  it("rejects answered responses with feedback but missing statistics", async () => {
    const provider: StructuredToolProvider = {
      askQuestion: vi.fn(async () => ({
        type: "tool_call" as const,
        toolCall: {
          name: "searchFeedback",
          args: {
            query: "management",
            topK: 5,
          },
        },
      })),

      submitToolResult: vi.fn(async () => ({
        type: "answer" as const,
        answer: answeredResponse,
      })),
    };

    await expect(
      answerWithVerifiedTools({
        question: "Summarise feedback and give the total.",
        provider,
        searchFeedback,
        getFeedbackStats,
        evidenceRequirement: "both",
      }),
    ).rejects.toThrow(
      "required statistics evidence is missing",
    );
  });
});
