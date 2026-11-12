import { z } from "zod";
import type { LLMJudge, JudgeResult } from "./llm-judge.js";
import { buildJudgePrompt } from "./judge-prompt.js";

/*
 * This is the runtime schema for the result we expect from the LLM judge.
 *
 * We use Zod here for the same reason we used it for FeedbackAnalysis:
 * the LLM's response is external/untrusted data, so TypeScript alone cannot
 * guarantee that it has the shape we expect.
 *
 * Expected response:
 *
 * {
 *   passed: true,
 *   score: 0.9,
 *   reasoning: "The analysis accurately reflects the feedback..."
 * }
 *
 * The score is constrained to 0–1 so invalid values such as 1.5 are
 * rejected at runtime.
 */
const judgeResultSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(1),
  reasoning: z.string(),
});

/*
 * Read the API key from the environment rather than putting the secret
 * directly in source code.
 *
 * The actual key lives in .env, which is excluded from Git via .gitignore.
 */
const apiKey = process.env.GEMINI_API_KEY;

/**
 * Creates an LLM judge backed by Gemini.
 *
 * Bigger picture:
 *
 *     evaluateWithJudge()
 *            ↓
 *        LLMJudge interface
 *            ↓
 *     createGeminiLLMJudge()
 *            ↓
 *        Gemini API
 *            ↓
 *      raw model response
 *            ↓
 *       JSON.parse()
 *            ↓
 *          unknown
 *            ↓
 *       Zod validation
 *            ↓
 *       JudgeResult
 *
 * Notice that this function returns `LLMJudge`, rather than exposing
 * Gemini-specific details to the rest of the application.
 *
 * This means the rest of the application depends on the interface,
 * while this file contains the Gemini-specific implementation.
 */
export const createGeminiLLMJudge = (): LLMJudge => ({
  /**
   * Sends the original feedback and AI analysis to Gemini and asks the
   * model to judge the quality of that analysis.
   */
  async evaluate(feedback: string, analysis): Promise<JudgeResult> {
    /*
     * Make the HTTP request to Gemini.
     *
     * `fetch()` returns a Response object. At this point we have not yet
     * inspected the response body.
     */
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        // The API key is sent as a request header.
        "x-goog-api-key": apiKey ?? "",
      },

      body: JSON.stringify({
        model: "gemini-3.7-flash",

        /*
         * Keep the actual judge instructions in a separate function.
         *
         * This keeps API communication separate from prompt construction,
         * making both easier to understand and test independently.
         */
        input: buildJudgePrompt(feedback, analysis),

        /*
         * We don't need a high level of model reasoning for this small
         * evaluation task, so we request a low thinking level.
         */
        generation_config: {
          thinking_level: "low",
        },

        /*
         * Ask Gemini to return structured JSON rather than free-form text.
         *
         * The schema is generated from our Zod schema so that the
         * structure expected by the model is derived from the same
         * definition we use to validate its response afterwards.
         */
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: z.toJSONSchema(judgeResultSchema),
        },
      }),
    });

    /*
     * Read the response body once.
     *
     * `response.json()` consumes the response body, so we can't safely call
     * it again later for another interpretation of the same response.
     *
     * The resulting value is external data, so we don't treat it as trusted
     * application data yet.
     */
    const result = await response.json();

    /*
     * HTTP success and successful AI output are two different things.
     *
     * A request can reach Gemini successfully but still return an error
     * status such as 429 (quota/rate limit) or 400 (bad request).
     */
    if (!response.ok) {
      throw new Error(
        `Gemini API error: ${result.error?.code ?? response.status} - ${
          result.error?.message ?? "Unknown error"
        }`,
      );
    }

    /*
     * The Interactions API returns model output inside the `steps` array.
     *
     * We find the step representing the model's generated output rather
     * than assuming it will always be at a particular array position.
     */
    const outputStep = result.steps?.find((step: { type: string }) => step.type === "model_output");

    /*
     * The actual generated JSON is stored as text inside the model output.
     *
     * At this stage it is still just a string. It has not yet become a
     * trusted JudgeResult.
     */
    const output = outputStep?.content?.[0]?.text;

    /*
     * Don't allow an unexpected API response to continue through the
     * application as though it were valid model output.
     */
    if (typeof output !== "string") {
      throw new Error("Gemini response did not contain valid model output");
    }

    /*
     * JSON.parse() converts the JSON string into a JavaScript value.
     *
     * We deliberately type the result as `unknown`.
     *
     * Why?
     *
     * JSON.parse() gives us external data. We have no runtime guarantee
     * that the model actually followed the schema we requested.
     *
     * `unknown` forces us to validate the value before treating it as a
     * JudgeResult.
     *
     * So the trust boundary is:
     *
     *     Gemini → JSON string → unknown → Zod → JudgeResult
     */
    const parsed: unknown = JSON.parse(output);

    /*
     * Finally validate the model's response at runtime.
     *
     * If the response is valid, `.parse()` returns a correctly typed
     * JudgeResult.
     *
     * If the model returned something invalid, Zod throws a validation
     * error instead of allowing bad data further into our application.
     */
    return judgeResultSchema.parse(parsed);
  },
});
