
import "dotenv/config";

import { answerWithVerifiedTools } from "../answer-with-tools.js";
import { createGeminiToolProvider } from "../providers/gemini-tool-provider.js";
import { createSearchFeedbackTool } from "../implementations/search-feedback-tool.js";
import { createGetFeedbackStatsTool } from "../implementations/get-feedback-stats-tool.js";

import type { EmbeddingProvider } from "../../embeddings/embedding-provider.js";
import type { EmbeddedFeedback } from "../../embeddings/prepare-feedback.js";
import type { StructuredToolProvider } from "../answer-with-tools.js";

/**
 * CHAPTER 7 — REAL GEMINI VERIFIED AGENT
 *
 * Demonstrates the complete verified tool-calling workflow
 * using real Gemini responses.
 *
 * Unlike Chapter 6, the final answer must pass:
 *
 * - Zod structured-output validation
 * - Feedback source verification
 * - Exact quotation verification
 * - Trusted numerical verification
 * - Evidence requirement checks
 *
 * REAL GEMINI REQUESTS:
 * Only made when explicitly enabled.
 *
 * EMBEDDINGS:
 * Local mock embeddings, so no embedding API calls.
 */

/**
 * EXPLICIT API OPT-IN
 *
 * Prevents accidental Gemini requests.
 *
 * Running this script without the environment
 * variable will stop before calling Gemini.
 */
if (process.env.RUN_GEMINI_TOOL_TEST !== "true") {
  throw new Error(
    "Real Gemini calls are disabled. " +
      "Set RUN_GEMINI_TOOL_TEST=true to run this script.",
  );
}

/**
 * REUSED FEEDBACK DATA
 *
 * Two management comments and one parking comment.
 */
const feedback: EmbeddedFeedback[] = [
  {
    id: "feedback-001",
    text: "My manager is supportive and always listens to my concerns.",
    embedding: [1, 0.2, 0],
  },
  {
    id: "feedback-002",
    text: "Senior management rarely recognises the extra effort our team puts in.",
    embedding: [0.9, 0.3, 0],
  },
  {
    id: "feedback-003",
    text: "The office parking facilities are inadequate.",
    embedding: [0, 0, 1],
  },
];

/**
 * LOCAL MOCK EMBEDDING PROVIDER
 *
 * Returns a fixed vector for every query.
 * This keeps the demonstration focused on
 * Gemini tool calling and grounding.
 */
const embeddingProvider: EmbeddingProvider = {
  async embed(_text: string): Promise<number[]> {
    return [1, 0.2, 0];
  },
};

/**
 * CREATE APPLICATION TOOLS
 *
 * These are real application tools operating
 * on our local demonstration feedback.
 */
const searchFeedback = createSearchFeedbackTool({
  feedback,
  embeddingProvider,
});

const getFeedbackStats = createGetFeedbackStatsTool({
  feedback,
});

/**
 * QUESTION
 *
 * Requires both tools:
 *
 * - getFeedbackStats for the count
 * - searchFeedback for management feedback
 *
 * Gemini must choose and request the tools.
 */
const question =
  "How many feedback comments are there, and what do employees " +
  "say about management? Use the available tools to retrieve " +
  "the statistics and relevant feedback. Include exact quotations " +
  "with source IDs. If evidence is insufficient, say so.";

/**
 * STRUCTURED GEMINI PROVIDER
 *
 * Unlike Chapter 6, structured mode requires
 * Gemini to return a GroundedAnswer.
 *
 * Creating the provider does not make an API request.
 */
const gemini = createGeminiToolProvider({
  mode: "structured",
});

/**
 * LOGGING WRAPPER
 *
 * Allows us to inspect Gemini's decisions:
 *
 * - Which tool it requests
 * - What arguments it supplies
 * - What tool results are returned
 * - What structured answer it produces
 *
 * The verified agent still controls execution
 * and validates the final response.
 */
const provider: StructuredToolProvider = {
  async askQuestion(userQuestion) {
    const response = await gemini.askQuestion(userQuestion);

    console.log("\nInitial Gemini response:");
    console.log(JSON.stringify(response, null, 2));

    return response;
  },

  async submitToolResult(args) {
    console.log(`\nTool result from ${args.name}:`);
    console.log(JSON.stringify(args.result, null, 2));

    const response = await gemini.submitToolResult(args);

    console.log("\nNext Gemini response:");
    console.log(JSON.stringify(response, null, 2));

    return response;
  },
};

/**
 * RUN VERIFIED AGENT
 *
 * evidenceRequirement: "both"
 *
 * A successful "answered" response requires
 * both retrieved feedback and trusted statistics.
 *
 * "insufficient_evidence" is allowed when
 * the agent cannot answer reliably.
 */
const main = async () => {
  console.log("\nCHAPTER 7 — VERIFIED GEMINI AGENT");
  console.log("\nQuestion:", question);

  const answer = await answerWithVerifiedTools({
    question,
    provider,
    searchFeedback,
    getFeedbackStats,
    maxToolCalls: 3,
    evidenceRequirement: "both",
  });

  console.log("\nFinal verified answer:");
  console.log(JSON.stringify(answer, null, 2));

  if (answer.status === "insufficient_evidence") {
    console.log(
      "\nGemini could not produce a sufficiently supported answer.",
    );
  } else {
    console.log(
      "\nAnswer accepted by the grounding validator.",
    );
  }
};

main().catch((error: unknown) => {
  console.error("\nVerified Gemini demonstration failed:", error);
  process.exitCode = 1;
});
