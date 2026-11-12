import type { StructuredToolProvider } from "../../tools/answer-with-tools.js";

/**
 * CHAPTER 8 — TOOL-CALL TRACING (the decorator pattern)
 *
 * WHAT IS THIS?
 *
 * The UI should show visitors what the agent DID, not only what it said:
 *
 *   1. getFeedbackStats()
 *   2. searchFeedback({ query: "workload", limit: 4 })
 *
 * answerWithVerifiedTools() doesn't return that information, and we don't
 * want to change a working, well-tested function just for display.
 *
 * WHAT IS A DECORATOR?
 *
 * A decorator wraps an object, keeps the SAME interface, and adds a bit of
 * behaviour around each call:
 *
 *   agent ──► traced provider ──► real provider (replay or Gemini)
 *                 │
 *                 └── notes down every tool call that passes through
 *
 * The agent can't tell the difference: it still receives a
 * StructuredToolProvider. The real provider can't tell either. That's the
 * point: we add a feature without modifying either of them.
 *
 * You've used this idea before: createCachedEmbeddingProvider (Chapter 3)
 * wraps an EmbeddingProvider and adds caching in the same way.
 */

/** One tool call requested by the AI, as shown to visitors. */
export interface ToolCallSummary {
  name: string;
  args: unknown;
}

/**
 * Wraps a provider and records every tool call it requests.
 *
 * Returns both the wrapped provider (give this to the agent) and the
 * array the calls are recorded into (read this afterwards).
 *
 * Example:
 *
 *   const { provider, toolCalls } = traceToolCalls(replayProvider);
 *   await answerWithVerifiedTools({ provider, ... });
 *   toolCalls; // → [{ name: "getFeedbackStats", args: {} }, ...]
 *
 * Like the replay provider, create one per request: `toolCalls` belongs
 * to a single conversation.
 */
export const traceToolCalls = (
  inner: StructuredToolProvider,
): { provider: StructuredToolProvider; toolCalls: ToolCallSummary[] } => {
  const toolCalls: ToolCallSummary[] = [];

  /*
   * Inspect a response on its way back to the agent. Tool calls are
   * noted down; every response is returned unchanged.
   */
  const record = <T extends Awaited<ReturnType<StructuredToolProvider["askQuestion"]>>>(
    response: T,
  ): T => {
    if (response.type === "tool_call") {
      toolCalls.push({ name: response.toolCall.name, args: response.toolCall.args });
    }

    return response;
  };

  const provider: StructuredToolProvider = {
    // Same method names and signatures as the inner provider:
    // call through to it, then record what came back.
    askQuestion: async (question) => record(await inner.askQuestion(question)),
    submitToolResult: async (input) => record(await inner.submitToolResult(input)),
  };

  return { provider, toolCalls };
};
