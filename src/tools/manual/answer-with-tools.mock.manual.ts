
import { answerWithTools, type ToolProvider } from "../answer-with-tools.js";
import { createSearchFeedbackTool } from "../implementations/search-feedback-tool.js";
import { createGetFeedbackStatsTool } from "../implementations/get-feedback-stats-tool.js";

import type { EmbeddingProvider } from "../../embeddings/embedding-provider.js";
import type { EmbeddedFeedback } from "../../embeddings/prepare-feedback.js";

/**
 * CHAPTER 6 — MOCK MANUAL AGENT DEMONSTRATION
 *
 * No Gemini API requests.
 * No embedding API requests.
 *
 * Demonstrates an agent using two tools sequentially:
 *
 * 1. getFeedbackStats()
 * 2. searchFeedback()
 * 3. Final answer
 *
 * Gemini's decisions are simulated using a mock provider.
 */

// REUSED FROM CHAPTER 5 — Example feedback and embeddings.
const feedback: EmbeddedFeedback[] = [
  {
    id: "feedback-001",
    text: "My manager is supportive and listens to my concerns.",
    embedding: [1, 0.2, 0],
  },
  {
    id: "feedback-002",
    text: "Senior management rarely recognises extra effort.",
    embedding: [0.9, 0.3, 0],
  },
  {
    id: "feedback-003",
    text: "The office parking facilities are inadequate.",
    embedding: [0, 0, 1],
  },
];

// REUSED FROM CHAPTER 5 — Local mock embeddings.
const embeddingProvider: EmbeddingProvider = {
  async embed(_text: string): Promise<number[]> {
    return [1, 0.2, 0];
  },
};

/**
 * REUSED FROM CHAPTER 5
 *
 * Creates our semantic search tool.
 */
const searchFeedback = createSearchFeedbackTool({
  feedback,
  embeddingProvider,
});

/**
 * CHAPTER 6 — NEW
 *
 * Creates the statistics tool using the same feedback.
 */
const getFeedbackStats = createGetFeedbackStatsTool({
  feedback,
});

const question =
  "How many feedback comments do we have, and what are employees saying about management?";

/**
 * CHAPTER 6 — NEW
 *
 * Tracks which simulated Gemini response comes next.
 *
 * The first request comes from askQuestion().
 * After the statistics are returned, Gemini requests search.
 * After search results are returned, Gemini answers.
 */
let toolResultsReceived = 0;

const provider: ToolProvider = {
  async askQuestion(userQuestion) {
    console.log("\nQuestion:", userQuestion);
    console.log("\n1. Gemini requests getFeedbackStats");

    return {
      type: "tool_call",
      toolCall: {
        name: "getFeedbackStats",
        args: {},
      },
    };
  },

  async submitToolResult({ name, result }) {
    toolResultsReceived++;

    console.log(`\nTool executed: ${name}`);
    console.log("Result returned to Gemini:", result);

    /*
     * CHAPTER 6 — NEW
     *
     * After the first tool result, simulate Gemini
     * requesting another tool.
     */
    if (toolResultsReceived === 1) {
      console.log("\n2. Gemini requests searchFeedback");

      return {
        type: "tool_call",
        toolCall: {
          name: "searchFeedback",
          args: {
            query: "management",
            limit: 2,
          },
        },
      };
    }

    /*
     * After the second tool result, simulate
     * Gemini returning its final answer.
     */
    return {
      type: "answer",
      answer:
        "There are 3 feedback comments. Employees have mixed views about management.",
    };
  },
};

const main = async () => {
  /*
   * CHAPTER 6 — MODIFIED
   *
   * Both tools are supplied to the agent.
   * Allow up to three sequential tool calls.
   */
  const answer = await answerWithTools({
    question,
    provider,
    searchFeedback,
    getFeedbackStats,
    maxToolCalls: 3,
  });

  console.log("\nFinal answer:\n", answer);
};

main().catch(console.error);
