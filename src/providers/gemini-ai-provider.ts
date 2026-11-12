import { z } from "zod";
import type { AIProvider } from "./ai-provider.js";
import { feedbackAnalysisSchema } from "../analysis/internal/feedback-schema.js";

/*
 * The Gemini API key comes from the environment rather than being stored
 * in source code.
 *
 * This keeps the secret out of the codebase and allows different
 * environments to provide their own key.
 */
const apiKey = process.env.GEMINI_API_KEY;

/*
 * Convert our Zod schema into JSON Schema.
 *
 * We use the same schema for two related purposes:
 *
 * 1. Tell Gemini what structure we want it to return.
 * 2. Define the structure that our application expects.
 *
 * The actual runtime validation happens later in feedbackAnalyser().
 *
 * This gives us a useful single source of truth for the shape of an
 * AI-generated FeedbackAnalysis.
 */
const responseSchema = z.toJSONSchema(feedbackAnalysisSchema);

/**
 * Creates an AIProvider backed by the Gemini API.
 *
 * Bigger picture:
 *
 *     feedbackAnalyser()
 *            ↓
 *        AIProvider
 *            ↓
 *   createGeminiAIProvider()
 *            ↓
 *        Gemini API
 *            ↓
 *       raw JSON text
 *            ↓
 *      feedbackAnalyser()
 *            ↓
 *       JSON.parse()
 *            ↓
 *         unknown
 *            ↓
 *       Zod validation
 *            ↓
 *     FeedbackAnalysis
 *
 * Notice that this provider does NOT return FeedbackAnalysis.
 *
 * Gemini is an external system and its response cannot be trusted simply
 * because we asked it for a particular structure. The provider therefore
 * returns the raw JSON string and lets the application layer parse and
 * validate it.
 */
export const createGeminiAIProvider = (): AIProvider => ({
  /**
   * Sends employee feedback to Gemini and returns the model's raw
   * structured-output JSON as a string.
   */
  async analyzeFeedback(feedback: string): Promise<string> {
    /*
     * Make the HTTP request to Gemini.
     *
     * `fetch()` gives us a Response object. We still need to inspect
     * the HTTP status and response body before trusting anything returned.
     */
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        // Authenticate the request using the API key from the environment.
        "x-goog-api-key": apiKey ?? "",
      },

      body: JSON.stringify({
        model: "gemini-3.5-flash-lite",

        /*
         * These are the instructions that describe what we want the
         * model to analyse.
         *
         * The schema below handles the exact output structure; these
         * instructions describe the meaning of the task.
         */
        input: `
            Analyse the following employee feedback.

            Identify the overall sentiment, the main themes, the priority,
            and provide a concise summary.

            Employee feedback:
            ${feedback}
          `,

        /*
         * We don't need high reasoning effort for this relatively
         * straightforward classification task.
         */
        generation_config: {
          thinking_level: "low",
        },

        /*
         * Ask Gemini for JSON matching our FeedbackAnalysis schema.
         *
         * This is an instruction to the model/API, not a guarantee that
         * the returned data is valid. We still need runtime validation
         * later in the application.
         */
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: responseSchema,
        },
      }),
    });

    /*
     * Read the response body once.
     *
     * `response.json()` consumes the response body, so we should not try
     * to read it again later.
     */
    const result = await response.json();

    /*
     * A successful HTTP request doesn't necessarily mean the AI request
     * succeeded.
     *
     * For example, Gemini could return a 429 because of quota/rate limits,
     * or another error status because of an invalid request.
     */
    if (!response.ok) {
      throw new Error(
        `Gemini API error: ${result.error?.code ?? response.status} - ${
          result.error?.message ?? "Unknown error"
        }`,
      );
    }

    /*
     * The Interactions API returns model output inside a `steps` array.
     *
     * We look for the step whose type is `model_output` rather than
     * assuming the model output will always be at a particular index.
     */
    const outputStep = result.steps.find((step: { type: string }) => step.type === "model_output");

    /*
     * The model's generated JSON is contained in the text property.
     *
     * At this point it is still just a string. We have NOT yet validated
     * that it actually matches FeedbackAnalysis.
     */
    const output = outputStep?.content?.[0]?.text;

    /*
     * Protect the rest of the application from an unexpected API response.
     *
     * If Gemini returns successfully but doesn't contain model output in
     * the structure we expect, fail explicitly rather than returning
     * undefined or malformed data.
     */
    if (typeof output !== "string") {
      throw new Error("Gemini response did not contain valid model output");
    }

    /*
     * Return the raw JSON string.
     *
     * It is tempting to parse and validate the response here, but keeping
     * that responsibility in feedbackAnalyser() gives us a clear boundary:
     *
     * Provider:
     *   "Here's what the external AI returned."
     *
     * Application:
     *   "I'll decide whether that response is valid for my application."
     */
    return output;
  },
});
