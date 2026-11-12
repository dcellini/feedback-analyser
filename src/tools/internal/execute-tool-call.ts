
import { z } from "zod";
import type { GetFeedbackStatsTool } from "../implementations/get-feedback-stats-tool.js";
import type { SearchFeedbackArgs } from "../implementations/search-feedback-tool.js";
import { searchFeedbackSchema } from "../definitions/search-feedback-schema.js";

/**
 * CHAPTER 5 — REUSED
 *
 * The shape of a tool request received from Gemini.
 *
 * We use unknown for args because model-generated
 * arguments must be validated at runtime.
 */
export interface ToolCall {
  name: string;
  args: unknown;
}

/**
 * CHAPTER 5 — REUSED
 *
 * The search function supplied by our application.
 *
 * This matches the function returned by
 * createSearchFeedbackTool().
 *
 * We don't need to know whether it uses real Gemini
 * embeddings or mock embeddings.
 */
export type SearchFeedbackTool = (
  args: SearchFeedbackArgs,
) => Promise<
  {
    id: string;
    text: string;
    similarity: number;
  }[]
>;

/**
 * CHAPTER 6 — REUSED
 *
 * getFeedbackStats() doesn't accept arguments.
 * We still validate the arguments supplied by Gemini.
 */
const getFeedbackStatsSchema = z.strictObject({});

/**
 * CHAPTER 6 — NEW
 *
 * A custom error representing a failure INSIDE
 * an approved tool.
 *
 * This lets our agent distinguish between:
 *
 * 1. Invalid or unauthorised tool requests.
 * 2. A valid tool failing during execution.
 *
 * The original error is retained as the cause
 * for debugging, but should not be sent directly
 * to Gemini because it could contain sensitive data.
 */
export class ToolExecutionError extends Error {
  constructor(
    public readonly toolName: string,
    cause: unknown,
  ) {
    super(`Tool execution failed: ${toolName}`, { cause });

    this.name = "ToolExecutionError";
  }
}

/**
 * CHAPTER 6 — MODIFIED FROM CHAPTER 5
 *
 * Chapter 5:
 * The executor only needed searchFeedback.
 *
 * Chapter 6:
 * We inject both available tools.
 *
 * WHY?
 * The agent must be able to execute different
 * actions depending on Gemini's decision.
 */
interface ExecuteToolCallOptions {
  toolCall: ToolCall;
  searchFeedback: SearchFeedbackTool;
  getFeedbackStats: GetFeedbackStatsTool;
}

/**
 * CHAPTER 6 — MODIFIED FROM CHAPTER 5
 *
 * Executes an approved tool request from Gemini.
 *
 * Processing order:
 *
 * 1. Identify the requested tool.
 * 2. Validate its arguments using Zod.
 * 3. Execute the approved TypeScript function.
 * 4. Wrap execution failures in ToolExecutionError.
 *
 * IMPORTANT:
 *
 * Gemini requests a tool, but our application
 * decides which functions can actually run.
 *
 * Validation errors and unknown tool requests
 * are deliberately NOT wrapped.
 *
 * This allows the agent to distinguish invalid
 * requests from genuine execution failures.
 */
export const executeToolCall = async ({
  toolCall,
  searchFeedback,
  getFeedbackStats,
}: ExecuteToolCallOptions) => {
  switch (toolCall.name) {
    /*
     * CHAPTER 5 — MODIFIED
     *
     * Validate arguments BEFORE the try/catch.
     *
     * This ensures invalid arguments produce
     * a Zod error rather than ToolExecutionError.
     */
    case "searchFeedback": {
      const args = searchFeedbackSchema.parse(toolCall.args);

      try {
        return await searchFeedback(args);
      } catch (error) {
        /*
         * CHAPTER 6 — NEW
         *
         * Wrap failures occurring inside the tool.
         *
         * The original error is preserved as the cause
         * for application logging and debugging.
         */
        throw new ToolExecutionError("searchFeedback", error);
      }
    }

    /*
     * CHAPTER 6 — MODIFIED
     *
     * Validate the statistics tool's arguments
     * before executing it.
     *
     * This tool accepts no arguments.
     */
    case "getFeedbackStats": {
      getFeedbackStatsSchema.parse(toolCall.args);

      try {
        return await getFeedbackStats();
      } catch (error) {
        /*
         * CHAPTER 6 — NEW
         *
         * Apply the same error-handling approach
         * to our second tool.
         */
        throw new ToolExecutionError("getFeedbackStats", error);
      }
    }

    /*
     * CHAPTER 5 — REUSED
     *
     * Unknown tools are never executed.
     *
     * We deliberately throw a normal error here
     * rather than ToolExecutionError.
     */
    default:
      throw new Error(`Unknown tool: ${toolCall.name}`);
  }
};
