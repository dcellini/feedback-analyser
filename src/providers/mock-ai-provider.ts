import type { FeedbackAnalysis } from "../analysis/internal/feedback-schema.js";
import type { AIProvider } from "./ai-provider.js";

/**
 * Creates a mock AI provider for use in tests.
 *
 * Bigger picture:
 *
 *     feedbackAnalyser()
 *            ↓
 *        AIProvider
 *        ↙       ↘
 *   Mock provider  Gemini provider
 *       ↓               ↓
 *  controlled       real AI
 *    result           result
 *
 * The mock lets us test the application without making real AI requests.
 *
 * We pass the desired analysis into the factory, which means each test
 * can decide exactly what the simulated AI should return.
 */
export const createMockAIProvider = (config: FeedbackAnalysis): AIProvider => ({
  /**
   * Simulates the AI provider's analyse operation.
   *
   * The feedback parameter is intentionally unused because this mock is
   * not trying to simulate the intelligence of the AI.
   *
   * Its purpose is to give the application a predictable response that
   * we control completely.
   */
  async analyzeFeedback(_feedback: string): Promise<string> {
    /*
     * The real AI provider returns JSON text, not a FeedbackAnalysis
     * object directly.
     *
     * JSON.stringify() makes the mock behave like the real external
     * provider so that the same JSON.parse() → Zod validation pipeline
     * is exercised in tests.
     */
    return JSON.stringify(config);
  },
});
