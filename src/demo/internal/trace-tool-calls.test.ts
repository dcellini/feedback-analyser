import { describe, expect, it } from "vitest";

import type { StructuredToolProvider } from "../../tools/answer-with-tools.js";
import { traceToolCalls } from "./trace-tool-calls.js";

/**
 * CHAPTER 8 — TOOL-CALL TRACING TESTS
 *
 * A decorator must not change behaviour: responses pass through
 * untouched. It only notes down the tool calls.
 */
describe("traceToolCalls", () => {
  const answer = {
    type: "answer" as const,
    answer: { status: "insufficient_evidence" },
  };

  const inner: StructuredToolProvider = {
    askQuestion: async () => ({
      type: "tool_call",
      toolCall: { name: "searchFeedback", args: { query: "pay" } },
    }),
    submitToolResult: async () => answer,
  };

  it("records each tool call the inner provider requests", async () => {
    const { provider, toolCalls } = traceToolCalls(inner);

    await provider.askQuestion("What about pay?");
    await provider.submitToolResult({ name: "searchFeedback", result: [] });

    expect(toolCalls).toEqual([{ name: "searchFeedback", args: { query: "pay" } }]);
  });

  it("returns the inner provider's responses unchanged", async () => {
    const { provider } = traceToolCalls(inner);

    await provider.askQuestion("What about pay?");

    await expect(provider.submitToolResult({ name: "searchFeedback", result: [] })).resolves.toBe(
      answer,
    );
  });

  it("gives each traced provider its own list", async () => {
    const first = traceToolCalls(inner);
    const second = traceToolCalls(inner);

    await first.provider.askQuestion("What about pay?");

    expect(first.toolCalls).toHaveLength(1);
    expect(second.toolCalls).toHaveLength(0);
  });
});
