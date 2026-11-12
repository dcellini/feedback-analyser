import { describe, expect, it, vi } from "vitest";
import { feedbackAnalyser } from "./feedback-analyser.js";

/*
 * These tests cover the main application-level AI pipeline:
 *
 *     feedback
 *        ↓
 *   AI provider
 *        ↓
 *    JSON string
 *        ↓
 *    JSON.parse()
 *        ↓
 *      unknown
 *        ↓
 *   Zod validation
 *        ↓
 *  FeedbackAnalysis
 *
 * The AI provider is mocked so these tests don't make real API calls.
 */
describe("feedbackAnalyser", () => {
  /*
   * Test the successful path.
   *
   * This verifies two things:
   *
   * 1. The feedback is passed to the AI provider.
   * 2. A valid provider response is parsed and returned as a
   *    validated FeedbackAnalysis.
   */
  it("calls the AI provider with the feedback and returns the analysis", async () => {
    /*
     * Create a mock provider.
     *
     * `vi.fn()` creates a mock function that we can inspect later.
     *
     * `mockResolvedValue()` makes the function behave like our real
     * asynchronous AI provider.
     *
     * The provider returns a JSON string because that is the boundary
     * defined by AIProvider.
     */
    const mockAIProvider = {
      analyzeFeedback: vi.fn().mockResolvedValue(
        JSON.stringify({
          sentiment: "negative",
          themes: ["performance reviews"],
          priority: "medium",
          summary: "Mock analysis",
        }),
      ),
    };

    const feedback = "Some feedback";

    /*
     * Run the application service using our controlled provider.
     *
     * This is dependency injection: feedbackAnalyser() doesn't create
     * an AI provider itself; we supply one from the test.
     */
    const analysis = await feedbackAnalyser({
      feedback,
      aiProvider: mockAIProvider,
    });

    /*
     * Verify that the provider received exactly the feedback we supplied.
     *
     * This checks the interaction between our application code and the
     * provider.
     */
    expect(mockAIProvider.analyzeFeedback).toHaveBeenCalledWith(feedback);

    /*
     * Verify the final result.
     *
     * By the time we receive this value, the response has gone through
     * JSON.parse() and Zod validation.
     */
    expect(analysis).toEqual({
      sentiment: "negative",
      themes: ["performance reviews"],
      priority: "medium",
      summary: "Mock analysis",
    });
  });

  /*
   * Test the runtime validation boundary.
   *
   * The provider returns valid JSON, but the contents don't match our
   * FeedbackAnalysis schema.
   *
   * This is different from invalid JSON: JSON.parse() succeeds, but
   * Zod should reject the resulting data.
   */
  it("throws with invalid AI provider response", async () => {
    const badProvider = {
      analyzeFeedback: vi.fn().mockResolvedValue(
        JSON.stringify({
          sentiment: "banana",
          themes: "not an array",
          priority: 42,
          summary: null,
        }),
      ),
    };

    const feedback = "Some feedback";

    /*
     * feedbackAnalyser() should reject because the parsed response
     * doesn't satisfy the Zod schema.
     */
    const result = feedbackAnalyser({
      feedback,
      aiProvider: badProvider,
    });

    await expect(result).rejects.toThrow();
  });

  /*
   * Test the JSON parsing boundary separately.
   *
   * Here the provider returns something that isn't valid JSON at all.
   *
   * JSON.parse() should throw before Zod even gets a chance to validate
   * the data.
   */
  it("throws with invalid JSON", async () => {
    const badProvider = {
      analyzeFeedback: vi.fn().mockResolvedValue('{"sentiment":"negative","themes":'),
    };

    const feedback = "Some feedback";

    /*
     * JSON.parse() will reject this malformed response.
     */
    const result = feedbackAnalyser({
      feedback,
      aiProvider: badProvider,
    });

    await expect(result).rejects.toThrow();
  });
});
