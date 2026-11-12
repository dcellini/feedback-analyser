import { z } from "zod";

import {
  executeToolCall,
  ToolExecutionError,
  type SearchFeedbackTool,
  type ToolCall,
} from "./internal/execute-tool-call.js";

import type { GetFeedbackStatsTool } from "./implementations/get-feedback-stats-tool.js";

import { redactPersonalData } from "../privacy/redact-personal-data.js";

import { validateGroundedAnswer } from "../grounding/validate-grounded-answer.js";

// CHAPTER 8: grounding failures now use a dedicated error class (same message).
import { GroundingVerificationError } from "../grounding/grounding-verification-error.js";

import type { GroundedAnswer } from "../grounding/grounded-answer-schema.js";
import type { FeedbackEvidence } from "../grounding/internal/verify-feedback-quote.js";

/**
 * CHAPTER 7 — VERIFIED TOOL-CALLING AGENT
 *
 * This file contains two agent implementations:
 *
 * 1. answerWithTools
 *    Our original plain-text agent.
 *
 * 2. answerWithVerifiedTools
 *    Our structured, evidence-verified agent.
 *
 * The verified agent:
 *
 * - Executes Gemini-requested tools.
 * - Redacts personal data from feedback.
 * - Collects retrieved feedback evidence.
 * - Retains validated statistics.
 * - Enforces evidence requirements.
 * - Verifies structured answers.
 * - Supports insufficient-evidence responses.
 *
 * SECURITY PRINCIPLE:
 *
 * Gemini output is untrusted.
 *
 * The application is responsible for validating
 * tool results and verifying the final answer.
 */

/**
 * PLAIN-TEXT PROVIDER RESPONSE
 *
 * Used by our original Chapter 5 agent.
 *
 * The provider either requests a tool or
 * returns a plain-text answer.
 */
type TextToolResponse =
  | {
      type: "tool_call";
      toolCall: ToolCall;
    }
  | {
      type: "answer";
      answer: string;
    };

/**
 * STRUCTURED PROVIDER RESPONSE
 *
 * Used by our verified agent.
 *
 * The final answer is typed as unknown because
 * external AI output cannot be trusted until
 * it has passed runtime validation.
 */
type StructuredToolResponse =
  | {
      type: "tool_call";
      toolCall: ToolCall;
    }
  | {
      type: "answer";
      answer: unknown;
    };

/**
 * ORIGINAL TOOL PROVIDER INTERFACE
 *
 * Returns plain-text answers.
 */
export interface ToolProvider {
  askQuestion(question: string): Promise<TextToolResponse>;

  submitToolResult(input: { name: string; result: unknown }): Promise<TextToolResponse>;
}

/**
 * STRUCTURED TOOL PROVIDER INTERFACE
 *
 * Returns untrusted structured answers.
 *
 * These must be validated before the
 * application can use them.
 */
export interface StructuredToolProvider {
  askQuestion(question: string): Promise<StructuredToolResponse>;

  submitToolResult(input: { name: string; result: unknown }): Promise<StructuredToolResponse>;
}

/**
 * EVIDENCE REQUIREMENTS
 *
 * Determines the minimum evidence needed
 * before an "answered" response can be accepted.
 *
 * feedback:
 *   At least one retrieved feedback record.
 *
 * statistics:
 *   Valid statistics from getFeedbackStats.
 *
 * both:
 *   Feedback records and valid statistics.
 *
 * none:
 *   No minimum evidence requirement.
 *
 * These requirements do not establish that
 * the free-text summary is factually correct.
 */
export type EvidenceRequirement = "feedback" | "statistics" | "both" | "none";

/**
 * TRUSTED STATISTICS SCHEMA
 *
 * Validates statistics returned by the
 * application's getFeedbackStats tool.
 *
 * We currently verify only totalFeedback.
 *
 * passthrough() permits additional statistics
 * without automatically treating them as
 * supported numerical metrics.
 */
const trustedStatsSchema = z
  .object({
    totalFeedback: z.number().int().nonnegative(),
  })
  .passthrough();

/**
 * ORIGINAL PLAIN-TEXT AGENT
 *
 * Preserved from Chapter 5.
 *
 * This agent executes requested tools and
 * returns the provider's plain-text answer.
 *
 * It does not perform the structured grounding
 * verification used by answerWithVerifiedTools.
 */
export const answerWithTools = async ({
  question,
  provider,
  searchFeedback,
  getFeedbackStats,
  maxToolCalls = 5,
}: {
  question: string;
  provider: ToolProvider;
  searchFeedback: SearchFeedbackTool;
  getFeedbackStats: GetFeedbackStatsTool;
  maxToolCalls?: number;
}): Promise<string> => {
  let response = await provider.askQuestion(question);

  let toolCallCount = 0;

  while (response.type === "tool_call") {
    if (toolCallCount >= maxToolCalls) {
      throw new Error(`Maximum tool calls exceeded (${maxToolCalls}).`);
    }

    toolCallCount += 1;

    let toolResult: unknown;

    try {
      toolResult = await executeToolCall({
        toolCall: response.toolCall,
        searchFeedback,
        getFeedbackStats,
      });
    } catch (error) {
      if (!(error instanceof ToolExecutionError)) {
        throw error;
      }

      toolResult = {
        error: {
          code: "TOOL_EXECUTION_FAILED",
          message: `The ${error.toolName} tool failed.`,
        },
      };
    }

    response = await provider.submitToolResult({
      name: response.toolCall.name,
      result: toolResult,
    });
  }

  return response.answer;
};

/**
 * VERIFIED STRUCTURED AGENT
 *
 * Executes the tool-calling workflow while
 * collecting evidence for final verification.
 *
 * WORKFLOW:
 *
 * 1. Ask the provider a question.
 * 2. Execute requested tools.
 * 3. Redact and collect feedback evidence.
 * 4. Validate and retain trusted statistics.
 * 5. Parse the final structured answer.
 * 6. Handle insufficient-evidence responses.
 * 7. Enforce evidence requirements for answers.
 * 8. Verify quotations, sources and numbers.
 *
 * A valid insufficient-evidence response is
 * returned as a non-answer rather than throwing.
 */
export const answerWithVerifiedTools = async ({
  question,
  provider,
  searchFeedback,
  getFeedbackStats,
  maxToolCalls = 5,
  evidenceRequirement = "none",
}: {
  question: string;
  provider: StructuredToolProvider;
  searchFeedback: SearchFeedbackTool;
  getFeedbackStats: GetFeedbackStatsTool;
  maxToolCalls?: number;
  evidenceRequirement?: EvidenceRequirement;
}): Promise<GroundedAnswer> => {
  /**
   * FEEDBACK EVIDENCE
   *
   * Collect retrieved feedback records.
   *
   * These are redacted before being stored
   * as evidence and returned to Gemini.
   */
  const evidence: FeedbackEvidence[] = [];

  /**
   * TRUSTED STATISTICS
   *
   * Store the latest valid statistics returned
   * by the application's statistics tool.
   *
   * undefined means no valid statistics
   * have been retrieved.
   */
  let trustedStats: z.infer<typeof trustedStatsSchema> | undefined;

  let response = await provider.askQuestion(question);

  let toolCallCount = 0;

  /**
   * TOOL EXECUTION LOOP
   *
   * Continue executing tools until the provider
   * returns a final answer or reaches the limit.
   */
  while (response.type === "tool_call") {
    if (toolCallCount >= maxToolCalls) {
      throw new Error(`Maximum tool calls exceeded (${maxToolCalls}).`);
    }

    toolCallCount += 1;

    let toolResult: unknown;

    try {
      toolResult = await executeToolCall({
        toolCall: response.toolCall,
        searchFeedback,
        getFeedbackStats,
      });
    } catch (error) {
      if (!(error instanceof ToolExecutionError)) {
        throw error;
      }

      /**
       * TOOL ERROR RECOVERY
       *
       * Return a safe error to the provider
       * without exposing internal exception details.
       *
       * Failed tools do not contribute evidence.
       */
      toolResult = {
        error: {
          code: "TOOL_EXECUTION_FAILED",
          message: `The ${error.toolName} tool failed.`,
        },
      };
    }

    /**
     * COLLECT FEEDBACK EVIDENCE
     *
     * Successful searchFeedback calls return
     * an array of feedback records.
     *
     * Redact personal information before:
     *
     * - Returning feedback to Gemini.
     * - Storing feedback for quotation verification.
     *
     * This ensures quotations are verified
     * against the same redacted text Gemini sees.
     *
     * executeToolCall is responsible for
     * validating the tool result structure.
     */
    if (response.toolCall.name === "searchFeedback" && Array.isArray(toolResult)) {
      const redactedResult = toolResult.map((item) => ({
        ...item,
        text: redactPersonalData(item.text),
      }));

      evidence.push(
        ...redactedResult.map((item) => ({
          id: item.id,
          text: item.text,
        })),
      );

      toolResult = redactedResult;
    }

    /**
     * COLLECT TRUSTED STATISTICS
     *
     * Statistics must come from the application's
     * getFeedbackStats tool, not from Gemini.
     *
     * Validate the result before storing it.
     *
     * Invalid or failed tool results do not
     * become trusted statistics.
     */
    if (response.toolCall.name === "getFeedbackStats") {
      const parsedStats = trustedStatsSchema.safeParse(toolResult);

      if (parsedStats.success) {
        trustedStats = parsedStats.data;
      }
    }

    /**
     * RETURN TOOL RESULT TO PROVIDER
     *
     * The provider can now continue reasoning
     * using the returned tool result.
     */
    response = await provider.submitToolResult({
      name: response.toolCall.name,
      result: toolResult,
    });
  }

  /**
   * STEP 1 — VALIDATE THE FINAL RESPONSE
   *
   * The response is unknown until validated.
   *
   * validateGroundedAnswer:
   *
   * - Parses the discriminated union with Zod.
   * - Handles insufficient-evidence responses.
   * - Verifies quotations and source references.
   * - Verifies structured numerical claims.
   *
   * A malformed response must still fail,
   * regardless of its claimed status.
   */
  const validatedAnswer = validateGroundedAnswer(response.answer, evidence, trustedStats);

  /**
   * STEP 2 — HANDLE INSUFFICIENT EVIDENCE
   *
   * The model has explicitly declined to answer.
   *
   * Zod has already checked that its claims,
   * quotations and numericalClaims are empty.
   *
   * This is a valid non-answer, even when the
   * requested evidence was unavailable.
   *
   * We therefore return it without enforcing
   * the evidence requirements for an answer.
   *
   * IMPORTANT:
   * This does not prove that evidence was
   * genuinely insufficient.
   */
  if (validatedAnswer.status === "insufficient_evidence") {
    return validatedAnswer;
  }

  /**
   * STEP 3 — ENFORCE FEEDBACK REQUIREMENTS
   *
   * An "answered" response must satisfy
   * the caller's feedback evidence requirement.
   *
   * Simply having access to the search tool
   * is not enough: it must have returned records.
   */
  const hasFeedbackEvidence = evidence.length > 0;

  const hasStatisticsEvidence = trustedStats !== undefined;

  if (
    (evidenceRequirement === "feedback" || evidenceRequirement === "both") &&
    !hasFeedbackEvidence
  ) {
    throw new GroundingVerificationError("required feedback evidence is missing.");
  }

  /**
   * STEP 4 — ENFORCE STATISTICS REQUIREMENTS
   *
   * An "answered" response requiring statistics
   * must have valid statistics from the tool.
   *
   * An unsupported model-generated number
   * cannot satisfy this requirement.
   */
  if (
    (evidenceRequirement === "statistics" || evidenceRequirement === "both") &&
    !hasStatisticsEvidence
  ) {
    throw new GroundingVerificationError("required statistics evidence is missing.");
  }

  /**
   * STEP 5 — RETURN VERIFIED ANSWER
   *
   * The response passed structured verification
   * and the required evidence was retrieved.
   *
   * The caller can inspect the status to
   * distinguish answers from non-answers.
   */
  return validatedAnswer;
};
