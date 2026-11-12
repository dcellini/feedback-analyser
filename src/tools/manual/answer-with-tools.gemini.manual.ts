
import "dotenv/config";

import { answerWithTools } from "../answer-with-tools.js";
import { createGeminiToolProvider } from "../providers/gemini-tool-provider.js";
import { createSearchFeedbackTool } from "../implementations/search-feedback-tool.js";
import { createGetFeedbackStatsTool } from "../implementations/get-feedback-stats-tool.js";

import type { EmbeddingProvider } from "../../embeddings/embedding-provider.js";
import type { EmbeddedFeedback } from "../../embeddings/prepare-feedback.js";

/**
 * CHAPTER 6 — REAL GEMINI AGENT DEMONSTRATION
 *
 * Makes real Gemini API requests only when explicitly enabled.
 *
 * Demonstrates:
 * - Gemini selecting tools.
 * - Our application executing approved tools.
 * - Returning tool results to Gemini.
 * - Gemini deciding whether to call another tool.
 * - Generating a final answer.
 *
 * Uses LOCAL MOCK EMBEDDINGS.
 *
 * No real embedding API requests are made.
 */

// Explicit opt-in prevents accidental API usage.
if (process.env.RUN_GEMINI_TOOL_TEST !== "true") {
  throw new Error(
    "Real Gemini calls are disabled. " +
      "Set RUN_GEMINI_TOOL_TEST=true to run this script.",
  );
}

/**
 * CHAPTER 5 — REUSED
 *
 * Precomputed demonstration feedback.
 *
 * Two records concern management.
 * One concerns parking.
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
 * CHAPTER 5 — REUSED
 *
 * Mock embedding provider.
 *
 * Returns a fixed query vector so semantic search
 * can run without calling an embedding API.
 *
 * This tests tool calling, not embedding quality.
 */
const embeddingProvider: EmbeddingProvider = {
  async embed(_text: string): Promise<number[]> {
    return [1, 0.2, 0];
  },
};

const main = async () => {
  /**
   * CHAPTER 6 — MODIFIED
   *
   * Ask a question that requires retrieving
   * the actual feedback content.
   *
   * Gemini should ideally request searchFeedback.
   *
   * Tool selection is still Gemini's decision.
   */
  const question =
    "What are employees saying about management? " +
    "Use the available feedback search tool to find relevant comments. " +
    "Only quote feedback returned by the tool and include its source ID.";

  /**
   * CHAPTER 5 — REUSED
   *
   * Create the semantic search tool.
   */
  const searchFeedback = createSearchFeedbackTool({
    feedback,
    embeddingProvider,
  });

  /**
   * CHAPTER 6 — REUSED
   *
   * Create our statistics tool using the same dataset.
   */
  const getFeedbackStats = createGetFeedbackStatsTool({
    feedback,
  });

  /**
   * CHAPTER 6 — REUSED
   *
   * Creating the Gemini provider does not
   * make an API request.
   */
  const gemini = createGeminiToolProvider();

  console.log("Question:", question);
  console.log("Calling Gemini...");

  /**
   * CHAPTER 6 — MODIFIED
   *
   * Wrap the Gemini provider to log every
   * model response and tool result.
   *
   * This makes the agent's decision-making
   * visible during the demonstration.
   */
  const provider = {
    async askQuestion(userQuestion: string) {
      const response = await gemini.askQuestion(userQuestion);

      console.log("\nInitial Gemini response:", response);

      return response;
    },

    async submitToolResult(
      args: Parameters<typeof gemini.submitToolResult>[0],
    ) {
      console.log(
        `\nResult from ${args.name} sent to Gemini:`,
        args.result,
      );

      const response = await gemini.submitToolResult(args);

      /*
       * CHAPTER 6 — NEW
       *
       * Show whether Gemini wants another tool
       * or has produced its final answer.
       */
      console.log("\nNext Gemini response:", response);

      return response;
    },
  };

  /**
   * CHAPTER 6 — REUSED
   *
   * Execute our agent.
   *
   * Gemini can request up to three tool calls.
   */
  const answer = await answerWithTools({
    question,
    provider,
    searchFeedback,
    getFeedbackStats,
    maxToolCalls: 3,
  });

  /*
   * CHAPTER 6 — MODIFIED
   *
   * Print the final answer once.
   */
  console.log("\nFinal Gemini answer:\n");
  console.log(answer);
};

main().catch((error: unknown) => {
  console.error("Gemini demonstration failed:", error);
  process.exitCode = 1;
});


/*
 * CHAPTER 5 — SUCCESSFUL GEMINI TOOL-CALLING EXECUTION
 *
 * Question:
 * What are employees saying about management?
 *
 * GEMINI TOOL REQUEST
 *
 * Gemini decided to request our searchFeedback tool:
 *
 * {
 *   name: "searchFeedback",
 *   args: {
 *     query: "management"
 *   }
 * }
 *
 * OBSERVATION:
 * Gemini shortened the original question to "management".
 * This was the model's decision, based on the tool description.
 *
 * Our Zod schema supplied the default limit of 5.
 *
 * TOOL EXECUTION
 *
 * Our TypeScript application:
 *
 * 1. Received Gemini's function-call request.
 * 2. Validated the tool name and arguments.
 * 3. Executed searchFeedback() using semanticSearch().
 * 4. Returned the search results to Gemini.
 *
 * Retrieved feedback:
 *
 * feedback-001
 * Similarity: 1.0
 * My manager is supportive and always listens to my concerns.
 *
 * feedback-002
 * Similarity: 0.9923
 * Senior management rarely recognises the extra effort
 * our team puts in.
 *
 * feedback-003
 * Similarity: 0.0
 * The office parking facilities are inadequate.
 *
 * IMPORTANT:
 * These similarity scores came from predefined mock
 * embeddings, NOT real Gemini embeddings.
 *
 * GEMINI'S FINAL ANSWER
 *
 * Employees have mixed views about management:
 *
 * - Direct/Line Managers:
 *   Generally viewed positively; employees appreciate
 *   managers who are supportive and listen to their
 *   concerns (Source: feedback-001).
 *
 * - Senior Management:
 *   Some employees feel that senior leadership fails
 *   to adequately recognise the extra effort their
 *   teams put in (Source: feedback-002).
 *
 * OBSERVATIONS
 *
 * 1. Gemini correctly identified that it needed to
 *    search employee feedback before answering.
 *
 * 2. Gemini generated the tool arguments itself.
 *    Our application did not hardcode the search query.
 *
 * 3. executeToolCall() validated the arguments and
 *    executed only our approved searchFeedback function.
 *
 * 4. The search results were returned to Gemini using
 *    a functionResponse message.
 *
 * 5. Gemini generated a grounded answer using the
 *    relevant feedback and cited the correct source IDs.
 *
 * 6. Gemini correctly ignored the unrelated parking
 *    feedback, despite receiving it in the search results.
 *
 * 7. The workflow successfully completed using two
 *    Gemini requests:
 *    - Initial question and tool request.
 *    - Tool results and final answer.
 *
 * 8. No real embedding API requests were made because
 *    the demonstration used local mock embeddings.
 *
 * KEY LEARNINGS
 *
 * TOOL CALLING VS RAG
 *
 * Chapter 4 (RAG):
 * Our TypeScript application decides to search first,
 * then sends the retrieved information to Gemini.
 *
 * Chapter 5 (Tool Calling):
 * Gemini decides whether to request a search.
 * Our application validates and executes that request,
 * then returns the results for Gemini to use.
 *
 * CONTROL AND SAFETY
 *
 * Gemini does not directly execute TypeScript functions.
 * It requests a tool by name and supplies arguments.
 *
 * Our application remains responsible for:
 * - Allowing only approved tools.
 * - Validating arguments using Zod.
 * - Executing the actual functions.
 * - Limiting repeated tool calls.
 * - Returning results to the model.
 *
 * ARCHITECTURE
 *
 * gemini-tool-provider.ts
 *   -> askQuestion()
 *   -> Gemini requests searchFeedback
 *
 * answer-with-tools.ts
 *   -> answerWithTools()
 *
 * execute-tool-call.ts
 *   -> executeToolCall()
 *   -> searchFeedbackSchema.parse()
 *
 * search-feedback-tool.ts
 *   -> searchFeedback()
 *
 * semantic-search.ts
 *   -> semanticSearch()
 *   -> cosineSimilarity()
 *
 * gemini-tool-provider.ts
 *   -> submitToolResult()
 *   -> Gemini generates final answer
 *
 * CONCLUSION
 *
 * Successfully implemented and tested an end-to-end
 * Gemini tool-calling workflow.
 *
 * This demonstrates how an LLM can select and request
 * application functionality while TypeScript retains
 * control over validation and execution.
 *
 * The workflow is functional but remains a learning
 * implementation rather than a production-ready system.
 */

/*
 * CHAPTER 5 — ACTUAL GEMINI TOOL-CALLING OUTPUT
 *
 * Question:
 * What are employees saying about management?
 *
 * --------------------------------------------------
 * 1. INITIAL GEMINI RESPONSE
 * --------------------------------------------------
 *
 * {
 *   type: 'tool_call',
 *   toolCall: {
 *     name: 'searchFeedback',
 *     args: {
 *       query: 'management'
 *     }
 *   }
 * }
 *
 * Gemini requested our searchFeedback tool rather
 * than immediately generating an answer.
 *
 * Notice that Gemini chose "management" as the query,
 * rather than using the user's full question.
 *
 * --------------------------------------------------
 * 2. SEARCH RESULTS SENT BACK TO GEMINI
 * --------------------------------------------------
 *
 * [
 *   {
 *     id: 'feedback-001',
 *     text: 'My manager is supportive and always listens to my concerns.',
 *     similarity: 1
 *   },
 *   {
 *     id: 'feedback-002',
 *     text: 'Senior management rarely recognises the extra effort our team puts in.',
 *     similarity: 0.9922778767136676
 *   },
 *   {
 *     id: 'feedback-003',
 *     text: 'The office parking facilities are inadequate.',
 *     similarity: 0
 *   }
 * ]
 *
 * These similarities were calculated using our
 * predefined mock embeddings, not Gemini embeddings.
 *
 * --------------------------------------------------
 * 3. FINAL GEMINI ANSWER
 * --------------------------------------------------
 *
 * Employees have mixed views about management:
 *
 * - Direct/Line Managers:
 *   Generally viewed positively; employees appreciate
 *   managers who are supportive and listen to their
 *   concerns (Source: feedback-001).
 *
 * - Senior Management:
 *   Some employees feel that senior leadership fails
 *   to adequately recognize the extra effort their
 *   teams put in (Source: feedback-002).
 *
 * --------------------------------------------------
 * 4. KEY OBSERVATIONS
 * --------------------------------------------------
 *
 * - Gemini independently requested searchFeedback.
 * - Our application validated and executed the tool.
 * - The results were returned using functionResponse.
 * - Gemini generated its final answer from the results.
 * - Gemini cited the relevant feedback source IDs.
 * - Gemini ignored the unrelated parking feedback.
 * - Two Gemini API requests were made.
 * - No embedding API requests were made.
 *
 * This demonstrates a successful end-to-end
 * tool-calling workflow using real Gemini.
 */
