
import {
  answerWithVerifiedTools,
  type StructuredToolProvider,
} from "../answer-with-tools.js";

import { createSearchFeedbackTool } from "../implementations/search-feedback-tool.js";
import { createGetFeedbackStatsTool } from "../implementations/get-feedback-stats-tool.js";

import type { EmbeddingProvider } from "../../embeddings/embedding-provider.js";
import type { EmbeddedFeedback } from "../../embeddings/prepare-feedback.js";

/**
 * CHAPTER 7 — VERIFIED AGENT MANUAL DEMONSTRATION
 *
 * No Gemini API requests.
 * No embedding API requests.
 *
 * Reuses the Chapter 6 feedback data and tools,
 * but now exercises the verified agent.
 *
 * WORKFLOW:
 *
 * 1. The mock AI requests getFeedbackStats.
 * 2. The application calculates trusted statistics.
 * 3. The mock AI requests searchFeedback.
 * 4. The application retrieves feedback evidence.
 * 5. The mock AI returns a structured answer.
 * 6. The application verifies the answer.
 *
 * Unlike Chapter 6, an unsupported structured
 * claim or quotation will be rejected.
 */

// Reuse the same example feedback from Chapter 6.
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

/**
 * LOCAL MOCK EMBEDDINGS
 *
 * Always returns the same embedding for the question.
 * No external embedding service is called.
 */
const embeddingProvider: EmbeddingProvider = {
  async embed(_text: string): Promise<number[]> {
    return [1, 0.2, 0];
  },
};

const searchFeedback = createSearchFeedbackTool({
  feedback,
  embeddingProvider,
});

const getFeedbackStats = createGetFeedbackStatsTool({
  feedback,
});

const question =
  "How many feedback comments do we have, and what are employees saying about management?";

/**
 * SIMULATED AI PROVIDER
 *
 * This mock controls the AI's decisions.
 *
 * It deliberately makes two tool calls before
 * returning a structured final answer.
 */
let toolResultsReceived = 0;

const provider: StructuredToolProvider = {
  async askQuestion(userQuestion) {
    // Reset state so repeated questions begin fresh.
    toolResultsReceived = 0;

    console.log("\nQuestion:", userQuestion);
    console.log("\n1. AI requests getFeedbackStats");

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
    console.log("Result returned to AI:", result);

    if (toolResultsReceived === 1) {
      console.log("\n2. AI requests searchFeedback");

      return {
        type: "tool_call",
        toolCall: {
          name: "searchFeedback",
          args: {
            query: "management",
            topK: 2,
          },
        },
      };
    }

    /**
     * STRUCTURED FINAL ANSWER
     *
     * The mock uses evidence we expect the
     * application tools to have returned.
     *
     * Numerical claim:
     * totalFeedback equals 3.
     *
     * Quotation:
     * Must match the retrieved feedback exactly.
     */
    return {
      type: "answer",
      answer: {
        status: "answered",
        summary:
          "There are three feedback comments. Employees express mixed views about management.",
        claims: [
          {
            text: "Some employees appreciate supportive managers.",
            sourceIds: ["feedback-001"],
          },
          {
            text: "Some employees feel management does not recognise extra effort.",
            sourceIds: ["feedback-002"],
          },
        ],
        quotations: [
          {
            sourceId: "feedback-001",
            quote:
              "My manager is supportive and listens to my concerns.",
          },
          {
            sourceId: "feedback-002",
            quote:
              "Senior management rarely recognises extra effort.",
          },
        ],
        numericalClaims: [
          {
            metric: "totalFeedback",
            operator: "eq",
            value: 3,
          },
        ],
      },
    };
  },
};

/**
 * RUN THE VERIFIED AGENT
 *
 * evidenceRequirement: "both"
 *
 * Requires the application to have retrieved:
 * - Feedback evidence
 * - Trusted statistics
 *
 * The structured answer is checked against
 * both before being returned.
 */
const main = async () => {
  const answer = await answerWithVerifiedTools({
    question,
    provider,
    searchFeedback,
    getFeedbackStats,
    maxToolCalls: 3,
    evidenceRequirement: "both",
  });

  console.log("\nVerified answer:");
  console.log(JSON.stringify(answer, null, 2));
};

main().catch((error: unknown) => {
  console.error("\nVerified agent failed:", error);
  process.exitCode = 1;
});
