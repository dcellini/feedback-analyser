
import { describe, expect, it, vi } from "vitest";
import {
  executeToolCall,
  ToolExecutionError,
  type SearchFeedbackTool,
} from "./execute-tool-call.js";
import type { GetFeedbackStatsTool } from "../implementations/get-feedback-stats-tool.js";

describe("executeToolCall", () => {
  /*
   * CHAPTER 5 — EXISTING TEST
   * CHAPTER 6 — MODIFIED
   */
  it("executes an approved tool with validated arguments", async () => {
    const searchFeedback = vi.fn(
      async (_args: { query: string; limit?: number }) => [
        {
          id: "feedback-001",
          text: "My manager is supportive.",
          similarity: 0.9,
        },
      ],
    );

    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>();

    const result = await executeToolCall({
      toolCall: {
        name: "searchFeedback",
        args: { query: "management" },
      },
      searchFeedback,
      getFeedbackStats,
    });

    expect(searchFeedback).toHaveBeenCalledWith({
      query: "management",
      limit: 5,
    });

    expect(result).toEqual([
      {
        id: "feedback-001",
        text: "My manager is supportive.",
        similarity: 0.9,
      },
    ]);

    expect(getFeedbackStats).not.toHaveBeenCalled();
  });

  /*
   * CHAPTER 5 — EXISTING TEST
   */
  it("rejects unknown tools", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>();
    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>();

    await expect(
      executeToolCall({
        toolCall: {
          name: "deleteAllFeedback",
          args: {},
        },
        searchFeedback,
        getFeedbackStats,
      }),
    ).rejects.toThrow("Unknown tool: deleteAllFeedback");

    expect(searchFeedback).not.toHaveBeenCalled();
    expect(getFeedbackStats).not.toHaveBeenCalled();
  });

  /*
   * CHAPTER 5 — EXISTING TEST
   */
  it("rejects invalid arguments before executing the tool", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>();
    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>();

    await expect(
      executeToolCall({
        toolCall: {
          name: "searchFeedback",
          args: {
            query: "",
            limit: 100,
          },
        },
        searchFeedback,
        getFeedbackStats,
      }),
    ).rejects.toThrow();

    expect(searchFeedback).not.toHaveBeenCalled();
    expect(getFeedbackStats).not.toHaveBeenCalled();
  });

  /*
   * CHAPTER 6 — EXISTING TEST
   */
  it("executes getFeedbackStats and returns feedback statistics", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>();

    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>(
      () => ({ totalFeedback: 3 }),
    );

    const result = await executeToolCall({
      toolCall: {
        name: "getFeedbackStats",
        args: {},
      },
      searchFeedback,
      getFeedbackStats,
    });

    expect(result).toEqual({ totalFeedback: 3 });
    expect(getFeedbackStats).toHaveBeenCalledOnce();
    expect(searchFeedback).not.toHaveBeenCalled();
  });

  /*
   * CHAPTER 6 — EXISTING TEST
   */
  it("rejects invalid arguments for getFeedbackStats", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>();
    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>();

    await expect(
      executeToolCall({
        toolCall: {
          name: "getFeedbackStats",
          args: { unexpected: "value" },
        },
        searchFeedback,
        getFeedbackStats,
      }),
    ).rejects.toThrow();

    expect(getFeedbackStats).not.toHaveBeenCalled();
    expect(searchFeedback).not.toHaveBeenCalled();
  });

  /*
   * CHAPTER 6 — NEW TEST
   *
   * An approved asynchronous tool fails.
   *
   * The dispatcher should preserve the original
   * error as the cause of ToolExecutionError.
   */
  it("wraps searchFeedback execution failures", async () => {
    const originalError = new Error("Embedding service unavailable");

    const searchFeedback = vi.fn<SearchFeedbackTool>()
      .mockRejectedValue(originalError);

    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>();

    try {
      await executeToolCall({
        toolCall: {
          name: "searchFeedback",
          args: { query: "management" },
        },
        searchFeedback,
        getFeedbackStats,
      });

      expect.fail("Expected tool execution to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(ToolExecutionError);

      const executionError = error as ToolExecutionError;

      expect(executionError.toolName).toBe("searchFeedback");
      expect(executionError.cause).toBe(originalError);
    }
  });

  /*
   * CHAPTER 6 — NEW TEST
   *
   * The synchronous statistics tool can also fail.
   * Both tools should use the same error type.
   */
  it("wraps getFeedbackStats execution failures", async () => {
    const searchFeedback = vi.fn<SearchFeedbackTool>();

    const getFeedbackStats = vi.fn<GetFeedbackStatsTool>(
      () => {
        throw new Error("Statistics unavailable");
      },
    );

    await expect(
      executeToolCall({
        toolCall: {
          name: "getFeedbackStats",
          args: {},
        },
        searchFeedback,
        getFeedbackStats,
      }),
    ).rejects.toBeInstanceOf(ToolExecutionError);

    expect(getFeedbackStats).toHaveBeenCalledOnce();
    expect(searchFeedback).not.toHaveBeenCalled();
  });
});
