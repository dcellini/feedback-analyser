import type { AIProvider } from "../providers/ai-provider.js";
import { feedbackAnalysisSchema, type FeedbackAnalysis } from "./internal/feedback-schema.js";

/**
 * Analyses employee feedback using an injected AI provider and validates
 * the result before returning it to the rest of the application.
 *
 * This is the main application-level pipeline for turning an external
 * AI response into trusted application data.
 *
 * Bigger picture:
 *
 *     Employee feedback
 *            ↓
 *     AIProvider
 *            ↓
 *       JSON string
 *            ↓
 *        JSON.parse()
 *            ↓
 *         unknown
 *            ↓
 *      Zod validation
 *            ↓
 *    FeedbackAnalysis
 *
 * Notice that this function doesn't know whether the AI provider is
 * Gemini, a mock, or something else. It only depends on the AIProvider
 * interface.
 *
 * This separation is important because the application logic should not
 * need to know how or where the AI response was generated.
 */
export const feedbackAnalyser = async ({
  feedback,
  aiProvider,
}: {
  feedback: string;
  aiProvider: AIProvider;
}): Promise<FeedbackAnalysis> => {
  /*
   * Ask the injected AI provider to analyse the feedback.
   *
   * The provider returns a JSON string rather than a FeedbackAnalysis.
   *
   * That's deliberate: the provider is dealing with an external AI system,
   * so we don't want to pretend that its response is already valid.
   */
  const result = await aiProvider.analyzeFeedback(feedback);

  /*
   * Convert the JSON string into a JavaScript value.
   *
   * We explicitly treat the result as `unknown` because JSON.parse()
   * produces external data that has not yet been validated.
   *
   * Even though we asked the AI for a particular structure, we cannot
   * assume it actually followed those instructions.
   */
  const parsed: unknown = JSON.parse(result);

  /*
   * Validate the parsed response at runtime using Zod.
   *
   * If the AI returned:
   *
   * {
   *   "sentiment": "negative",
   *   "themes": ["management"],
   *   "priority": "high",
   *   "summary": "..."
   * }
   *
   * and it satisfies the schema, `parse()` returns it as a
   * FeedbackAnalysis.
   *
   * If the AI returned invalid data, Zod throws instead of allowing
   * malformed data into the rest of our application.
   *
   * This is the point where untrusted external data becomes trusted
   * application data.
   */
  return feedbackAnalysisSchema.parse(parsed);
};
