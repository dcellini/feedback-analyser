
import { describe, expect, it, vi } from "vitest";

import {
  answerWithTools,
  type ToolProvider,
} from "./answer-with-tools.js";

import type { SearchFeedbackTool } from "./internal/execute-tool-call.js";
import type { GetFeedbackStatsTool } from "./implementations/get-feedback-stats-tool.js";

describe("answerWithTools", () => {
  /*
   * CHAPTER 5 — REUSED
   * CHAPTER 6 — MODIFIED
   *
   * Gemini requests searchFeedback and then answers.
   */
  it("executes a tool and returns the final answer", async () => {
    const searchResults = [
      {
        id: "feedback-001",
        text: "My manager is supportive.",
        similarity: 0.9,
      },
    ];

    const searchFeedback = vi.fn<SearchFeedbackTool>()
      .mockResolvedValue(searchResults);

    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>();

    const provider: ToolProvider = {
      askQuestion: vi.fn().mockResolvedValue({
        type: "tool_call",
        toolCall: {
          name: "searchFeedback",
          args: { query: "management" },
        },
      }),
      submitToolResult: vi.fn().mockResolvedValue({
        type: "answer",
        answer: "Employees appreciate their managers.",
      }),
    };

    const answer = await answerWithTools({
      question: "What do employees think about management?",
      provider,
      searchFeedback,
      getFeedbackStats,
    });

    expect(answer).toBe("Employees appreciate their managers.");

    expect(searchFeedback).toHaveBeenCalledWith({
      query: "management",
      limit: 5,
    });

    expect(provider.submitToolResult).toHaveBeenCalledWith({
      name: "searchFeedback",
      result: searchResults,
    });
  });

  /*
   * CHAPTER 5 — REUSED
   *
   * Gemini can answer without calling a tool.
   */
  it("returns a direct answer without executing tools", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>();
    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>();

    const provider: ToolProvider = {
      askQuestion: vi.fn().mockResolvedValue({
        type: "answer",
        answer: "Hello!",
      }),
      submitToolResult: vi.fn(),
    };

    const answer = await answerWithTools({
      question: "Say hello",
      provider,
      searchFeedback,
      getFeedbackStats,
    });

    expect(answer).toBe("Hello!");
    expect(searchFeedback).not.toHaveBeenCalled();
    expect(getFeedbackStats).not.toHaveBeenCalled();
    expect(provider.submitToolResult).not.toHaveBeenCalled();
  });

  /*
   * CHAPTER 5 — REUSED
   *
   * The agent must stop when its tool-call limit
   * has been reached.
   */
  it("stops when the maximum tool-call limit is exceeded", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>()
      .mockResolvedValue([]);

    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>();

    const toolRequest = {
      type: "tool_call" as const,
      toolCall: {
        name: "searchFeedback",
        args: { query: "management" },
      },
    };

    const provider: ToolProvider = {
      askQuestion: vi.fn().mockResolvedValue(toolRequest),
      submitToolResult: vi.fn().mockResolvedValue(toolRequest),
    };

    await expect(
      answerWithTools({
        question: "Search repeatedly",
        provider,
        searchFeedback,
        getFeedbackStats,
        maxToolCalls: 2,
      }),
    ).rejects.toThrow("Maximum tool calls exceeded (2).");

    expect(searchFeedback).toHaveBeenCalledTimes(2);
    expect(provider.submitToolResult).toHaveBeenCalledTimes(2);
  });

  /*
   * CHAPTER 5 — REUSED
   *
   * Invalid arguments must stop the agent.
   */
  it("rejects invalid tool arguments", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>();
    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>();

    const provider: ToolProvider = {
      askQuestion: vi.fn().mockResolvedValue({
        type: "tool_call",
        toolCall: {
          name: "searchFeedback",
          args: { query: "", limit: 100 },
        },
      }),
      submitToolResult: vi.fn(),
    };

    await expect(
      answerWithTools({
        question: "Search feedback",
        provider,
        searchFeedback,
        getFeedbackStats,
      }),
    ).rejects.toThrow();

    expect(searchFeedback).not.toHaveBeenCalled();
    expect(provider.submitToolResult).not.toHaveBeenCalled();
  });

  /*
   * CHAPTER 6 — REUSED
   *
   * Gemini requests two different tools in sequence.
   */
  it("executes multiple tools sequentially", async () => {
    const searchResults = [
      {
        id: "feedback-001",
        text: "Good communication.",
        similarity: 0.95,
      },
    ];

    const searchFeedback = vi.fn<SearchFeedbackTool>()
      .mockResolvedValue(searchResults);

    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>(
      () => ({ totalFeedback: 3 }),
    );

    const provider: ToolProvider = {
      askQuestion: vi.fn().mockResolvedValue({
        type: "tool_call",
        toolCall: {
          name: "getFeedbackStats",
          args: {},
        },
      }),

      submitToolResult: vi.fn()
        .mockResolvedValueOnce({
          type: "tool_call",
          toolCall: {
            name: "searchFeedback",
            args: { query: "communication" },
          },
        })
        .mockResolvedValueOnce({
          type: "answer",
          answer: "There are 3 feedback entries, including communication concerns.",
        }),
    };

    const answer = await answerWithTools({
      question: "How much feedback is there about communication?",
      provider,
      searchFeedback,
      getFeedbackStats,
    });

    expect(answer).toContain("3 feedback entries");

    expect(getFeedbackStats).toHaveBeenCalledOnce();
    expect(searchFeedback).toHaveBeenCalledOnce();

    expect(provider.submitToolResult).toHaveBeenNthCalledWith(1, {
      name: "getFeedbackStats",
      result: { totalFeedback: 3 },
    });

    expect(provider.submitToolResult).toHaveBeenNthCalledWith(2, {
      name: "searchFeedback",
      result: searchResults,
    });
  });

  /*
   * CHAPTER 6 — NEW
   *
   * An approved tool fails.
   *
   * The agent should:
   * 1. Catch ToolExecutionError.
   * 2. Send a safe error result to Gemini.
   * 3. Allow Gemini to request another tool.
   * 4. Return the final answer.
   */
  it("recovers from a failed tool by executing another tool", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>()
      .mockRejectedValue(
        new Error("Private embedding service credentials"),
      );

    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>(
      () => ({ totalFeedback: 3 }),
    );

    const provider: ToolProvider = {
      askQuestion: vi.fn().mockResolvedValue({
        type: "tool_call",
        toolCall: {
          name: "searchFeedback",
          args: { query: "management" },
        },
      }),

      submitToolResult: vi.fn()
        .mockResolvedValueOnce({
          type: "tool_call",
          toolCall: {
            name: "getFeedbackStats",
            args: {},
          },
        })
        .mockResolvedValueOnce({
          type: "answer",
          answer: "Search is unavailable, but there are 3 feedback entries.",
        }),
    };

    const answer = await answerWithTools({
      question: "What feedback do we have?",
      provider,
      searchFeedback,
      getFeedbackStats,
    });

    expect(answer).toBe(
      "Search is unavailable, but there are 3 feedback entries.",
    );

    /*
     * The original error message must not be
     * included in the result sent to Gemini.
     */
    expect(provider.submitToolResult).toHaveBeenNthCalledWith(1, {
      name: "searchFeedback",
      result: {
        error: {
          code: "TOOL_EXECUTION_FAILED",
          message: "The searchFeedback tool failed.",
        },
      },
    });

    expect(provider.submitToolResult).toHaveBeenNthCalledWith(2, {
      name: "getFeedbackStats",
      result: { totalFeedback: 3 },
    });

    expect(searchFeedback).toHaveBeenCalledOnce();
    expect(getFeedbackStats).toHaveBeenCalledOnce();
  });

  /*
   * CHAPTER 6 — NEW
   *
   * Failed tool executions must count towards
   * the maximum tool-call limit.
   *
   * Otherwise Gemini could repeatedly retry
   * a failing tool without stopping.
   */
  it("counts failed tool executions towards the limit", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>()
      .mockRejectedValue(new Error("Service unavailable"));

    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>();

    const toolRequest = {
      type: "tool_call" as const,
      toolCall: {
        name: "searchFeedback",
        args: { query: "management" },
      },
    };

    const provider: ToolProvider = {
      askQuestion: vi.fn().mockResolvedValue(toolRequest),
      submitToolResult: vi.fn().mockResolvedValue(toolRequest),
    };

    await expect(
      answerWithTools({
        question: "Keep searching",
        provider,
        searchFeedback,
        getFeedbackStats,
        maxToolCalls: 2,
      }),
    ).rejects.toThrow("Maximum tool calls exceeded (2).");

    expect(searchFeedback).toHaveBeenCalledTimes(2);
    expect(provider.submitToolResult).toHaveBeenCalledTimes(2);
    expect(getFeedbackStats).not.toHaveBeenCalled();
  });
});
