import { describe, expect, it } from "vitest";
import { createMockAIProvider } from "./mock-ai-provider.js";

/*
 * Test the mock AI provider.
 *
 * The mock implements the same AIProvider interface as our real Gemini
 * provider, but returns a completely controlled result without making
 * an external API request.
 */
describe("mockAIProvider", () => {
  /*
   * Verify that the mock provider returns the configured analysis in the
   * same JSON-string format as the real AI provider.
   */
  it("returns a mock analysis", async () => {
    /*
     * Configure the mock with the exact analysis we want it to return.
     *
     * `createMockAIProvider()` is synchronous because creating the mock
     * doesn't involve any asynchronous work.
     *
     * The `analyzeFeedback()` method inside the mock is async because it
     * needs to behave like the real provider.
     */
    const provider = createMockAIProvider({
      sentiment: "negative",
      themes: ["performance reviews"],
      priority: "medium",
      summary: "Mock analysis",
    });

    /*
     * Call the provider through the AIProvider interface.
     *
     * The feedback itself doesn't affect the result because this mock is
     * deliberately configured to return a known response.
     */
    const analysis = await provider.analyzeFeedback("Some feedback");

    /*
     * The real AI provider returns JSON text rather than a
     * FeedbackAnalysis object.
     *
     * The mock therefore follows the same contract.
     *
     * This allows tests of the feedback analyser to use the mock
     * while still exercising the same JSON.parse() → Zod validation
     * boundary used with the real provider.
     */
    expect(analysis).toBe(
      JSON.stringify({
        sentiment: "negative",
        themes: ["performance reviews"],
        priority: "medium",
        summary: "Mock analysis",
      }),
    );
  });
});
