import type { AIProvider } from "../../providers/ai-provider.js";

/**
 * CHAPTER 8 — RECORDED AI PROVIDER (for feedback analysis)
 *
 * WHAT IS THIS?
 *
 * An AIProvider (Chapter 1) that looks up a previously recorded response
 * instead of calling Gemini.
 *
 * It's the analysis equivalent of the replay tool provider, but simpler:
 * analysis is a single request and response, so there's no conversation
 * to step through. It's just a lookup.
 *
 * HOW IS IT DIFFERENT FROM createMockAIProvider?
 *
 * The existing mock returns the SAME configured analysis for any input,
 * which is perfect for unit tests. The demo needs a DIFFERENT response
 * per comment, so this provider looks the response up by the feedback
 * text it receives.
 *
 * Example:
 *
 *   const provider = createRecordedAIProvider(
 *     new Map([["Great team!", '{"sentiment":"positive",...}']]),
 *   );
 *
 *   await provider.analyzeFeedback("Great team!");  // → '{"sentiment":...}'
 *   await provider.analyzeFeedback("Unknown text"); // → throws
 */
export const createRecordedAIProvider = (
  responsesByFeedbackText: ReadonlyMap<string, string>,
): AIProvider => ({
  async analyzeFeedback(feedback: string): Promise<string> {
    const response = responsesByFeedbackText.get(feedback);

    /*
     * Fail clearly instead of returning undefined.
     *
     * The demo service only asks for analyses of feedback that is in the
     * dataset, so reaching this means a recording is missing (a bug), not
     * that a visitor did something wrong.
     */
    if (response === undefined) {
      throw new Error("No recorded analysis exists for this feedback.");
    }

    /*
     * Return the raw string. feedbackAnalyser() will JSON.parse and
     * Zod-validate it, exactly as it would for a live Gemini response.
     */
    return response;
  },
});
