import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { answerWithVerifiedTools } from "../answer-with-tools.js";

import type { GetFeedbackStatsTool } from "../implementations/get-feedback-stats-tool.js";
import type { SearchFeedbackTool } from "../internal/execute-tool-call.js";
import { createGeminiToolProvider } from "../providers/gemini-tool-provider.js";

/**
 * CHAPTER 7 — GEMINI GROUNDED AGENT INTEGRATION
 *
 * Tests how the real Gemini provider implementation
 * works with our verified tool-calling agent.
 *
 * Unlike tests using a fake StructuredToolProvider,
 * these tests exercise the actual provider code
 * responsible for interpreting Gemini API responses.
 *
 * We mock global fetch(), so no HTTP requests
 * are sent to Gemini and no API credits are used.
 *
 * WORKFLOW:
 *
 * 1. The application sends a question to Gemini.
 * 2. Gemini requests a tool using functionCall.
 * 3. The application executes the requested tool.
 * 4. The tool result is returned to Gemini.
 * 5. Gemini responds with a structured JSON answer.
 * 6. The application validates and verifies the answer.
 *
 * ANSWER STATUS:
 *
 * "answered"
 *   A structured answer that must pass grounding.
 *
 * "insufficient_evidence"
 *   A valid non-answer containing no structured claims.
 *
 * CONCEPTS COVERED:
 *
 * - HTTP mocking with Vitest
 * - Gemini function calling
 * - Structured output validation
 * - Evidence-based grounding
 * - Personal data redaction
 * - Insufficient-evidence handling
 */

/**
 * MOCK GEMINI HTTP RESPONSE
 *
 * Creates a Response object matching the relevant
 * structure of Gemini's generateContent response.
 *
 * Gemini wraps model output inside:
 *
 * candidates -> content -> parts
 *
 * A part can contain:
 * - functionCall: a request to execute a tool.
 * - text: a textual response, including JSON.
 *
 * Using a real Response object helps us test
 * the provider's HTTP response parsing.
 */
const geminiResponse = (parts: Array<Record<string, unknown>>): Response => {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            role: "model",
            parts,
          },
        },
      ],
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
};

/**
 * MOCK FEEDBACK SEARCH TOOL
 *
 * Returns one predictable feedback record.
 *
 * The agent uses this record to verify quotations
 * and check source references.
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
 * Provides a feedback count if Gemini requests it.
 *
 * The tool is available in these tests, but the
 * current scenarios focus on feedback quotations.
 */
const getFeedbackStats: GetFeedbackStatsTool = () => ({
  totalFeedback: 1,
});

describe("Grounded Gemini agent integration", () => {
  /**
   * TEST SETUP — DUMMY API KEY
   *
   * The Gemini provider requires an API key.
   *
   * We supply a dummy key so the provider can
   * be constructed without real credentials.
   *
   * Individual tests replace global fetch()
   * before executing the agent.
   */
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-api-key");
  });

  /**
   * TEST CLEANUP — RESTORE GLOBAL STATE
   *
   * Restore fetch and environment variables
   * after each test.
   *
   * This prevents mocks and dummy credentials
   * from leaking into other test cases.
   */
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  /**
   * TEST 1 — SUCCESSFUL GROUNDED ANSWER
   *
   * The first mocked Gemini response requests
   * the searchFeedback tool.
   *
   * The second response contains a valid structured
   * answer with a genuine feedback quotation.
   *
   * EXPECTED:
   * The agent accepts the answer after verification.
   *
   * Two HTTP requests should occur.
   */
  it("accepts a verified quotation from Gemini", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        geminiResponse([
          {
            functionCall: {
              name: "searchFeedback",
              args: {
                query: "management",
                topK: 5,
              },
            },
          },
        ]),
      )
      .mockResolvedValueOnce(
        geminiResponse([
          {
            text: JSON.stringify({
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
            }),
          },
        ]),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await answerWithVerifiedTools({
      question: "What do employees say about management?",
      provider: createGeminiToolProvider({
        mode: "structured",
      }),
      searchFeedback,
      getFeedbackStats,
    });

    expect(result.status).toBe("answered");

    expect(result.quotations).toEqual([
      {
        sourceId: "feedback-001",
        quote: "My manager is supportive.",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /**
   * TEST 2 — FABRICATED GEMINI QUOTATION
   *
   * Gemini retrieves feedback successfully,
   * but invents wording in the final answer.
   *
   * The JSON is structurally valid, but the
   * quotation is unsupported.
   *
   * EXPECTED:
   * Grounding verification rejects the quotation.
   */
  it("rejects an invented Gemini quotation", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        geminiResponse([
          {
            functionCall: {
              name: "searchFeedback",
              args: {
                query: "management",
                topK: 5,
              },
            },
          },
        ]),
      )
      .mockResolvedValueOnce(
        geminiResponse([
          {
            text: JSON.stringify({
              status: "answered",
              summary: "Everyone loves management.",
              claims: [],
              quotations: [
                {
                  sourceId: "feedback-001",
                  quote: "Everyone loves management.",
                },
              ],
              numericalClaims: [],
            }),
          },
        ]),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      answerWithVerifiedTools({
        question: "What do employees say?",
        provider: createGeminiToolProvider({
          mode: "structured",
        }),
        searchFeedback,
        getFeedbackStats,
      }),
    ).rejects.toThrow("Grounding verification failed");
  });

  /**
   * TEST 3 — PRIVACY AND GROUNDING INTEGRATION
   *
   * The search tool returns feedback containing
   * a personal email address.
   *
   * The agent must redact that email before
   * sending the tool result to Gemini.
   *
   * It must also verify quotations against
   * the redacted version of the evidence.
   *
   * EXPECTED:
   * The original email is absent from the
   * outgoing HTTP request.
   */
  it("verifies quotations against redacted evidence", async () => {
    const privateSearch: SearchFeedbackTool = async () => [
      {
        id: "feedback-001",
        text: "Contact jane@example.com for help.",
        similarity: 0.95,
      },
    ];

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        geminiResponse([
          {
            functionCall: {
              name: "searchFeedback",
              args: {
                query: "contact",
                topK: 5,
              },
            },
          },
        ]),
      )
      .mockResolvedValueOnce(
        geminiResponse([
          {
            text: JSON.stringify({
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
            }),
          },
        ]),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await answerWithVerifiedTools({
      question: "What contact was mentioned?",
      provider: createGeminiToolProvider({
        mode: "structured",
      }),
      searchFeedback: privateSearch,
      getFeedbackStats,
    });

    const secondCall = fetchMock.mock.calls[1];
    const requestOptions = secondCall?.[1] as RequestInit;

    const requestBody = JSON.stringify(JSON.parse(requestOptions.body as string));

    expect(requestBody).not.toContain("jane@example.com");

    expect(requestBody).toContain("[EMAIL REDACTED]");

    expect(result.status).toBe("answered");

    expect(result.quotations[0]?.quote).toBe("Contact [EMAIL REDACTED] for help.");
  });

  /**
   * TEST 4 — MALFORMED JSON RESPONSE
   *
   * Gemini returns ordinary text rather than JSON.
   *
   * JSON parsing fails before Zod validation.
   *
   * EXPECTED:
   * Reject the response with a parsing error.
   */
  it("rejects malformed structured JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      geminiResponse([
        {
          text: "Employees are happy with management.",
        },
      ]),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      answerWithVerifiedTools({
        question: "What do employees say?",
        provider: createGeminiToolProvider({
          mode: "structured",
        }),
        searchFeedback,
        getFeedbackStats,
      }),
    ).rejects.toThrow("Gemini returned invalid structured JSON.");
  });

  /**
   * TEST 5 — INVALID STRUCTURED ANSWER
   *
   * Gemini returns syntactically valid JSON,
   * but quotations is a string instead of an array.
   *
   * All other required fields are valid.
   *
   * EXPECTED:
   * Zod rejects the incorrect field type.
   */
  it("rejects structurally invalid JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      geminiResponse([
        {
          text: JSON.stringify({
            status: "answered",
            summary: "Positive feedback.",
            claims: [],
            quotations: "Not an array",
            numericalClaims: [],
          }),
        },
      ]),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      answerWithVerifiedTools({
        question: "What do employees say?",
        provider: createGeminiToolProvider({
          mode: "structured",
        }),
        searchFeedback,
        getFeedbackStats,
      }),
    ).rejects.toThrow();
  });

  /**
   * TEST 6 — VALID INSUFFICIENT EVIDENCE
   *
   * Gemini returns a structured non-answer
   * without requesting any tools.
   *
   * The question requires feedback evidence,
   * but the response does not claim to answer.
   *
   * EXPECTED:
   * Accept the insufficient-evidence response.
   */
  it("accepts insufficient evidence from Gemini", async () => {
    const answer = {
      status: "insufficient_evidence",
      summary: "There is not enough feedback evidence to answer.",
      claims: [],
      quotations: [],
      numericalClaims: [],
    };

    const fetchMock = vi.fn().mockResolvedValue(
      geminiResponse([
        {
          text: JSON.stringify(answer),
        },
      ]),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await answerWithVerifiedTools({
      question: "What do employees say about management?",
      provider: createGeminiToolProvider({
        mode: "structured",
      }),
      searchFeedback,
      getFeedbackStats,
      evidenceRequirement: "feedback",
    });

    expect(result).toEqual(answer);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * TEST 7 — INVALID INSUFFICIENT EVIDENCE
   *
   * Gemini declares insufficient evidence
   * but also returns a factual claim.
   *
   * This violates our Zod discriminated union.
   *
   * EXPECTED:
   * Reject the malformed response.
   */
  it("rejects insufficient evidence containing claims", async () => {
    const answer = {
      status: "insufficient_evidence",
      summary: "There is not enough evidence.",
      claims: [
        {
          text: "Employees are satisfied.",
          sourceIds: ["feedback-001"],
        },
      ],
      quotations: [],
      numericalClaims: [],
    };

    const fetchMock = vi.fn().mockResolvedValue(
      geminiResponse([
        {
          text: JSON.stringify(answer),
        },
      ]),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      answerWithVerifiedTools({
        question: "What do employees say?",
        provider: createGeminiToolProvider({
          mode: "structured",
        }),
        searchFeedback,
        getFeedbackStats,
        evidenceRequirement: "feedback",
      }),
    ).rejects.toThrow();
  });
});
