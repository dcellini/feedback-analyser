import { describe, expect, it } from "vitest";

import {
  createReplayToolProvider,
  normaliseQuestion,
  ReplayMismatchError,
  type AgentRecording,
} from "./replay-tool-provider.js";

/**
 * CHAPTER 8 — REPLAY TOOL PROVIDER TESTS
 *
 * The replay provider must behave like a strict tape player:
 *
 * - Hand out recorded responses in order.
 * - Refuse to replay an answer to a different question.
 * - Refuse to continue if the agent goes "off script".
 * - Never let one request modify the data another request sees.
 */

/**
 * A minimal recording: one tool call, then an answer.
 */
const recording: AgentRecording = {
  id: "test-recording",
  question: "How many comments are there?",
  evidenceRequirement: "statistics",
  kind: "genuine",
  note: "Test recording.",
  responses: [
    { type: "tool_call", toolCall: { name: "getFeedbackStats", args: {} } },
    {
      type: "answer",
      answer: {
        status: "answered",
        summary: "There are 3 comments.",
        claims: [],
        quotations: [],
        numericalClaims: [{ metric: "totalFeedback", operator: "eq", value: 3 }],
      },
    },
  ],
};

describe("createReplayToolProvider", () => {
  it("hands out recorded responses in order", async () => {
    const provider = createReplayToolProvider(recording);

    const first = await provider.askQuestion(recording.question);
    expect(first).toEqual(recording.responses[0]);

    const second = await provider.submitToolResult({
      name: "getFeedbackStats",
      result: { totalFeedback: 3 },
    });
    expect(second).toEqual(recording.responses[1]);
  });

  it("matches questions regardless of case and extra whitespace", async () => {
    const provider = createReplayToolProvider(recording);

    await expect(provider.askQuestion("  how many   COMMENTS are there?  ")).resolves.toEqual(
      recording.responses[0],
    );
  });

  it("refuses to replay a recording for a different question", async () => {
    const provider = createReplayToolProvider(recording);

    await expect(provider.askQuestion("What about pay?")).rejects.toThrow(ReplayMismatchError);
  });

  it("refuses a second askQuestion on the same provider", async () => {
    const provider = createReplayToolProvider(recording);
    await provider.askQuestion(recording.question);

    await expect(provider.askQuestion(recording.question)).rejects.toThrow(
      "askQuestion was called more than once",
    );
  });

  it("refuses a result for a tool the recording did not request", async () => {
    const provider = createReplayToolProvider(recording);
    await provider.askQuestion(recording.question);

    await expect(
      provider.submitToolResult({ name: "searchFeedback", result: [] }),
    ).rejects.toThrow('received a result for "searchFeedback"');
  });

  it("fails clearly when the recording runs out of responses", async () => {
    // A broken recording: it requests a tool but never answers.
    const truncated: AgentRecording = {
      ...recording,
      responses: [recording.responses[0]!],
    };

    const provider = createReplayToolProvider(truncated);
    await provider.askQuestion(truncated.question);

    await expect(
      provider.submitToolResult({ name: "getFeedbackStats", result: {} }),
    ).rejects.toThrow("no more responses");
  });

  it("gives each request its own copy of the recorded data", async () => {
    /*
     * The recordings are shared by every request. If a caller modified a
     * response it received, the next visitor would see the modified
     * version. structuredClone() inside the provider prevents that.
     */
    const firstVisitor = createReplayToolProvider(recording);
    const response = await firstVisitor.askQuestion(recording.question);

    if (response.type === "tool_call") {
      response.toolCall.name = "tampered";
    }

    const secondVisitor = createReplayToolProvider(recording);
    const fresh = await secondVisitor.askQuestion(recording.question);

    expect(fresh).toEqual({ type: "tool_call", toolCall: { name: "getFeedbackStats", args: {} } });
  });

  it("keeps separate positions for separate providers", async () => {
    /*
     * Two visitors asking at the same time each get their own provider,
     * so neither affects the other's position in the recording.
     */
    const visitorA = createReplayToolProvider(recording);
    const visitorB = createReplayToolProvider(recording);

    await visitorA.askQuestion(recording.question);
    await visitorB.askQuestion(recording.question);

    const answerA = await visitorA.submitToolResult({ name: "getFeedbackStats", result: {} });
    const answerB = await visitorB.submitToolResult({ name: "getFeedbackStats", result: {} });

    expect(answerA.type).toBe("answer");
    expect(answerB.type).toBe("answer");
  });
});

describe("normaliseQuestion", () => {
  it("trims, collapses whitespace and lowercases", () => {
    expect(normaliseQuestion("  What   do\nPeople  SAY? ")).toBe("what do people say?");
  });
});
