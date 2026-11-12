
import { describe, expect, it, vi } from "vitest";

import {
  answerWithVerifiedTools,
  type StructuredToolProvider,
} from "./answer-with-tools.js";

import type {
  SearchFeedbackTool,
} from "./internal/execute-tool-call.js";

import type {
  GetFeedbackStatsTool,
} from "./implementations/get-feedback-stats-tool.js";

/**
 * CHAPTER 7 — VERIFIED AGENT TESTS
 *
 * Tests the reliability and security of our
 * structured, tool-calling AI agent.
 *
 * The agent is responsible for:
 *
 * 1. Executing tools requested by the provider.
 * 2. Collecting evidence from tool results.
 * 3. Redacting personal information.
 * 4. Validating structured answers with Zod.
 * 5. Verifying quotations and source references.
 * 6. Enforcing tool-call limits.
 * 7. Sanitising tool execution errors.
 * 8. Supporting insufficient-evidence responses.
 *
 * HOW THESE TESTS WORK:
 *
 * Gemini is replaced with a mock provider.
 *
 * The typical workflow is:
 *
 * Provider requests tool
 *   -> Application executes tool
 *   -> Application returns result
 *   -> Provider produces structured answer
 *   -> Application verifies the answer
 *
 * All tests are deterministic.
 * No Gemini API calls are made.
 */

/**
 * SHARED FEEDBACK FIXTURE
 *
 * Simulates results from searchFeedback.
 *
 * similarity is a search relevance score,
 * not a measure of factual correctness.
 */
const feedbackResults = [
  {
    id: "feedback-001",
    text: "My manager is supportive.",
    similarity: 0.95,
  },
  {
    id: "feedback-002",
    text: "Senior management rarely listens.",
    similarity: 0.87,
  },
];

/**
 * MOCK SEARCH TOOL
 *
 * vi.fn() creates a mock whose calls can
 * be inspected by Vitest.
 *
 * No real search is performed.
 */
const createSearchTool = () =>
  vi.fn<SearchFeedbackTool>(async () => feedbackResults);

/**
 * MOCK STATISTICS TOOL
 *
 * Returns a count calculated by our
 * simulated application tool.
 *
 * The AI does not generate this value.
 */
const createStatsTool = () =>
  vi.fn<GetFeedbackStatsTool>(() => ({
    totalFeedback: 2,
  }));

/**
 * MOCK PROVIDER FACTORY
 *
 * Simulates:
 *
 * 1. A request to searchFeedback.
 * 2. A final structured answer.
 *
 * answer is unknown deliberately so that
 * malformed responses can be tested.
 */
const createSearchProvider = (
  answer: unknown,
): StructuredToolProvider => ({
  async askQuestion() {
    return {
      type: "tool_call",
      toolCall: {
        name: "searchFeedback",
        args: {
          query: "management",
          topK: 5,
        },
      },
    };
  },

  async submitToolResult() {
    return {
      type: "answer",
      answer,
    };
  },
});

describe("answerWithVerifiedTools", () => {
  /**
   * TEST 1 — VALID GROUNDED ANSWER
   *
   * The provider retrieves feedback and
   * returns an exact quotation.
   *
   * EXPECTED:
   * The quotation is verified and accepted.
   */
  it("accepts an answer with a verified quotation", async () => {
    const answer = {
      status: "answered",
      summary: "Some employees appreciate their managers.",
      claims: [],
      quotations: [
        {
          sourceId: "feedback-001",
          quote: "My manager is supportive.",
        },
      ],
      numericalClaims: [],
    };

    const result = await answerWithVerifiedTools({
      question: "What do employees say about management?",
      provider: createSearchProvider(answer),
      searchFeedback: createSearchTool(),
      getFeedbackStats: createStatsTool(),
    });

    expect(result).toEqual(answer);
  });

  /**
   * TEST 2 — FABRICATED QUOTATION
   *
   * The provider invents wording that does
   * not exist in the retrieved feedback.
   *
   * EXPECTED:
   * Reject the quotation during grounding.
   */
  it("rejects an invented quotation", async () => {
    const answer = {
      status: "answered",
      summary: "Everyone loves management.",
      claims: [],
      quotations: [
        {
          sourceId: "feedback-001",
          quote: "Everyone loves their manager.",
        },
      ],
      numericalClaims: [],
    };

    await expect(
      answerWithVerifiedTools({
        question: "What do employees say?",
        provider: createSearchProvider(answer),
        searchFeedback: createSearchTool(),
        getFeedbackStats: createStatsTool(),
      }),
    ).rejects.toThrow("Grounding verification failed");
  });

  /**
   * TEST 3 — INCORRECT SOURCE ATTRIBUTION
   *
   * The quotation exists, but belongs to
   * feedback-001 rather than feedback-002.
   *
   * EXPECTED:
   * Reject the incorrect source attribution.
   */
  it("rejects a quotation attributed to the wrong source", async () => {
    const answer = {
      status: "answered",
      summary: "Positive feedback.",
      claims: [],
      quotations: [
        {
          sourceId: "feedback-002",
          quote: "My manager is supportive.",
        },
      ],
      numericalClaims: [],
    };

    await expect(
      answerWithVerifiedTools({
        question: "What do employees say?",
        provider: createSearchProvider(answer),
        searchFeedback: createSearchTool(),
        getFeedbackStats: createStatsTool(),
      }),
    ).rejects.toThrow("Grounding verification failed");
  });

  /**
   * TEST 4 — PERSONAL DATA REDACTION
   *
   * Retrieved feedback contains an email.
   *
   * The application must redact the email
   * before sending feedback to the provider.
   *
   * The verifier must then accept a quotation
   * matching the redacted evidence.
   *
   * EXPECTED:
   * No original email reaches the provider.
   */
  it("redacts personal information before sending feedback", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>(
      async () => [
        {
          id: "feedback-001",
          text: "Contact jane@example.com for help.",
          similarity: 0.95,
        },
      ],
    );

    const submitToolResult = vi.fn(
      async (_args: { name: string; result: unknown }) => ({
        type: "answer" as const,
        answer: {
          status: "answered",
          summary: "A contact was provided.",
          claims: [],
          quotations: [
            {
              sourceId: "feedback-001",
              quote: "Contact [EMAIL REDACTED] for help.",
            },
          ],
          numericalClaims: [],
        },
      }),
    );

    const provider: StructuredToolProvider = {
      async askQuestion() {
        return {
          type: "tool_call",
          toolCall: {
            name: "searchFeedback",
            args: {
              query: "contact",
              topK: 5,
            },
          },
        };
      },

      submitToolResult,
    };

    const result = await answerWithVerifiedTools({
      question: "What contact information was mentioned?",
      provider,
      searchFeedback,
      getFeedbackStats: createStatsTool(),
    });

    const submitted = submitToolResult.mock.calls[0]?.[0];

    expect(JSON.stringify(submitted)).not.toContain(
      "jane@example.com",
    );

    expect(JSON.stringify(submitted)).toContain(
      "[EMAIL REDACTED]",
    );

    expect(result.status).toBe("answered");

    expect(result.quotations[0]?.quote).toBe(
      "Contact [EMAIL REDACTED] for help.",
    );
  });

  /**
   * TEST 5 — MULTIPLE TOOL CALLS
   *
   * The provider requests:
   *
   * 1. getFeedbackStats
   * 2. searchFeedback
   *
   * The agent must retain the evidence
   * collected across both calls.
   *
   * EXPECTED:
   * Two tool submissions and a valid quotation.
   *
   * LIMITATION:
   * The numerical statement in the summary
   * is not independently verified here.
   */
  it("collects evidence across multiple tool calls", async () => {
    let step = 0;

    const provider: StructuredToolProvider = {
      async askQuestion() {
        return {
          type: "tool_call",
          toolCall: {
            name: "getFeedbackStats",
            args: {},
          },
        };
      },

      async submitToolResult() {
        step++;

        if (step === 1) {
          return {
            type: "tool_call",
            toolCall: {
              name: "searchFeedback",
              args: {
                query: "management",
                topK: 5,
              },
            },
          };
        }

        return {
          type: "answer",
          answer: {
            status: "answered",
            summary: "There are 2 comments.",
            claims: [],
            quotations: [
              {
                sourceId: "feedback-001",
                quote: "My manager is supportive.",
              },
            ],
            numericalClaims: [],
          },
        };
      },
    };

    const result = await answerWithVerifiedTools({
      question: "How many comments mention management?",
      provider,
      searchFeedback: createSearchTool(),
      getFeedbackStats: createStatsTool(),
    });

    expect(result.status).toBe("answered");
    expect(result.quotations).toHaveLength(1);
    expect(step).toBe(2);
  });

  /**
   * TEST 6 — INVALID STRUCTURED ANSWER
   *
   * quotations must be an array.
   *
   * We supply the other required fields
   * correctly to isolate this failure.
   *
   * EXPECTED:
   * Zod rejects the malformed response.
   */
  it("rejects an invalid structured answer", async () => {
    const answer = {
      status: "answered",
      summary: "Positive feedback.",
      claims: [],
      quotations: "My manager is supportive.",
      numericalClaims: [],
    };

    await expect(
      answerWithVerifiedTools({
        question: "What do employees say?",
        provider: createSearchProvider(answer),
        searchFeedback: createSearchTool(),
        getFeedbackStats: createStatsTool(),
      }),
    ).rejects.toThrow();
  });

  /**
   * TEST 7 — TOOL CALL LIMIT
   *
   * The provider repeatedly requests tools.
   *
   * maxToolCalls prevents an unbounded loop
   * and limits execution costs.
   *
   * EXPECTED:
   * Reject when the configured limit is reached.
   */
  it("enforces the maximum tool-call limit", async () => {
    const provider: StructuredToolProvider = {
      async askQuestion() {
        return {
          type: "tool_call",
          toolCall: {
            name: "getFeedbackStats",
            args: {},
          },
        };
      },

      async submitToolResult() {
        return {
          type: "tool_call",
          toolCall: {
            name: "getFeedbackStats",
            args: {},
          },
        };
      },
    };

    await expect(
      answerWithVerifiedTools({
        question: "How many comments?",
        provider,
        searchFeedback: createSearchTool(),
        getFeedbackStats: createStatsTool(),
        maxToolCalls: 2,
      }),
    ).rejects.toThrow("Maximum tool calls exceeded (2).");
  });

  /**
   * TEST 8 — SAFE TOOL ERROR HANDLING
   *
   * The search tool throws an internal error
   * containing sensitive information.
   *
   * The application must replace it with a
   * safe, generic error before informing Gemini.
   *
   * The provider then returns a valid
   * insufficient-evidence response.
   *
   * EXPECTED:
   * The provider receives the safe error,
   * and the agent accepts the non-answer.
   */
  it("returns a safe error when a tool fails", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>(
      async () => {
        throw new Error("Internal database password leaked");
      },
    );

    const submitToolResult = vi.fn(
      async (_args: { name: string; result: unknown }) => ({
        type: "answer" as const,
        answer: {
          status: "insufficient_evidence",
          summary: "Feedback search was unavailable.",
          claims: [],
          quotations: [],
          numericalClaims: [],
        },
      }),
    );

    const provider: StructuredToolProvider = {
      async askQuestion() {
        return {
          type: "tool_call",
          toolCall: {
            name: "searchFeedback",
            args: {
              query: "management",
              topK: 5,
            },
          },
        };
      },

      submitToolResult,
    };

    const result = await answerWithVerifiedTools({
      question: "What do employees say?",
      provider,
      searchFeedback,
      getFeedbackStats: createStatsTool(),
      evidenceRequirement: "feedback",
    });

    const submitted = JSON.stringify(
      submitToolResult.mock.calls[0]?.[0],
    );

    expect(submitted).toContain("TOOL_EXECUTION_FAILED");

    expect(submitted).not.toContain(
      "Internal database password leaked",
    );

    expect(result.status).toBe("insufficient_evidence");
  });

  /**
   * TEST 9 — UNSUPPORTED SUMMARY LIMITATION
   *
   * The provider returns an unsupported
   * conclusion without requesting any tools.
   *
   * With evidenceRequirement set to "none",
   * the agent currently accepts this response.
   *
   * EXPECTED:
   * The answer is accepted.
   *
   * This is a deliberate test documenting
   * a remaining reliability limitation.
   *
   * A valid schema does not prove the
   * summary's factual correctness.
   */
  it("currently allows summaries without quotations", async () => {
    const answer = {
      status: "answered",
      summary: "All employees love their managers.",
      claims: [],
      quotations: [],
      numericalClaims: [],
    };

    const provider: StructuredToolProvider = {
      async askQuestion() {
        return {
          type: "answer",
          answer,
        };
      },

      async submitToolResult() {
        throw new Error("No tool call expected");
      },
    };

    const result = await answerWithVerifiedTools({
      question: "What do employees say about management?",
      provider,
      searchFeedback: createSearchTool(),
      getFeedbackStats: createStatsTool(),
      evidenceRequirement: "none",
    });

    expect(result).toEqual(answer);
  });
});
