import { describe, expect, it } from "vitest";
import { createMockLLMJudge } from "./mock-llm-judge.js";

/*
 * Test the mock LLM judge.
 *
 * The mock implements the same LLMJudge interface as the real Gemini
 * judge, but returns a completely controlled result instead of calling
 * an external AI service.
 */
describe("LLM judge", () => {
  /*
   * Verify that the mock judge returns exactly the result it was
   * configured with.
   *
   * This gives us a predictable dependency that can be injected into
   * other tests without making real LLM requests.
   */
  it("returns the configured evaluation", async () => {
    /*
     * Configure the mock with the result we want it to return.
     *
     * This is the important characteristic of a mock: the test controls
     * the dependency's behaviour.
     */
    const judge = createMockLLMJudge({
      passed: true,
      score: 0.9,
      reasoning: "The analysis accurately reflects the feedback.",
    });

    /*
     * Call the mock using the same interface that the real Gemini judge
     * uses.
     *
     * The actual feedback and analysis don't affect this mock's result.
     * The mock is deliberately not trying to simulate an intelligent
     * judge; it's providing a predictable dependency for our tests.
     */
    const result = await judge.evaluate("Communication from management is poor.", {
      sentiment: "negative",
      themes: ["communication", "management"],
      priority: "medium",
      summary: "Employees are unhappy with management communication.",
    });

    /*
     * The result should exactly match the configuration supplied when
     * the mock was created.
     */
    expect(result).toEqual({
      passed: true,
      score: 0.9,
      reasoning: "The analysis accurately reflects the feedback.",
    });
  });
});
