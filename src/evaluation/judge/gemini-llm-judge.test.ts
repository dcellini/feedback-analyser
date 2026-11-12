import { afterEach, describe, expect, it, vi } from "vitest";
import { createGeminiLLMJudge } from "./gemini-llm-judge.js";

/*
 * These tests exercise our Gemini LLM judge implementation.
 *
 * We do NOT make real network requests here.
 *
 * Instead, we replace the global `fetch` function with a Vitest mock and
 * control exactly what the simulated Gemini API returns.
 *
 * This makes the tests:
 *
 * - fast
 * - predictable
 * - free
 * - independent of Gemini availability or quota
 */
describe("createGeminiLLMJudge", () => {
  /*
   * Restore the real global functions after every test.
   *
   * Each test replaces `fetch` with its own mock response.
   *
   * `vi.unstubAllGlobals()` removes those replacements so one test cannot
   * accidentally affect another test.
   */
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /*
   * Test the successful path.
   *
   * This verifies that the Gemini provider:
   *
   * 1. calls fetch()
   * 2. handles a successful HTTP response
   * 3. finds the model output
   * 4. parses the returned JSON
   * 5. validates it with Zod
   * 6. returns a valid JudgeResult
   */
  it("returns a validated judge result from Gemini", async () => {
    /*
     * Replace the real global fetch() with a controlled mock.
     *
     * `vi.fn()` creates a mock function whose calls we can inspect.
     *
     * `mockResolvedValue()` makes the async fetch call resolve with the
     * fake HTTP response below.
     */
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          /*
           * This mimics the structure returned by the Gemini
           * Interactions API.
           */
          steps: [
            {
              type: "model_output",
              content: [
                {
                  type: "text",

                  /*
                   * Gemini gives us model output as text.
                   *
                   * We therefore stringify our fake result here so that
                   * the test exercises the same JSON.parse() path as the
                   * real provider.
                   */
                  text: JSON.stringify({
                    passed: true,
                    score: 0.9,
                    reasoning: "The analysis accurately reflects the employee feedback.",
                  }),
                },
              ],
            },
          ],
        }),
      }),
    );

    /*
     * Create the Gemini judge.
     *
     * No network request happens yet. The request occurs when
     * judge.evaluate() is called below.
     */
    const judge = createGeminiLLMJudge();

    /*
     * Ask the judge to evaluate some feedback and its AI-generated
     * analysis.
     */
    const result = await judge.evaluate("Communication from management is poor.", {
      sentiment: "negative",
      themes: ["communication", "management"],
      priority: "medium",
      summary: "Employees are unhappy with management communication.",
    });

    /*
     * Verify the final validated result returned by the provider.
     *
     * At this point the data has gone through:
     *
     * fake Gemini response
     *        ↓
     * JSON text
     *        ↓
     * JSON.parse()
     *        ↓
     * unknown
     *        ↓
     * Zod validation
     *        ↓
     * JudgeResult
     */
    expect(result).toEqual({
      passed: true,
      score: 0.9,
      reasoning: "The analysis accurately reflects the employee feedback.",
    });

    /*
     * Also verify that our provider actually made one fetch request.
     *
     * This checks that the adapter isn't simply returning a hard-coded
     * result.
     */
    expect(fetch).toHaveBeenCalledOnce();
  });

  /*
   * Test an HTTP/API failure.
   *
   * This is different from invalid model output.
   *
   * Here Gemini itself tells us that the request failed, in this case
   * because the API returned HTTP 429 / quota exceeded.
   */
  it("throws when Gemini returns an HTTP error", async () => {
    /*
     * Simulate Gemini returning an unsuccessful HTTP response.
     */
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            code: "too_many_requests",
            message: "Quota exceeded",
          },
        }),
      }),
    );

    const judge = createGeminiLLMJudge();

    /*
     * `rejects.toThrow()` is how we test an async function that should
     * reject/throw.
     *
     * We don't expect a JudgeResult here because the API request itself
     * failed before there was any model output to validate.
     */
    await expect(
      judge.evaluate("Communication from management is poor.", {
        sentiment: "negative",
        themes: ["communication", "management"],
        priority: "medium",
        summary: "Employees are unhappy with management communication.",
      }),
    ).rejects.toThrow("Gemini API error: too_many_requests - Quota exceeded");
  });

  /*
   * Test a different failure boundary:
   *
   * Gemini successfully responds, but the model gives us data that does
   * not match the JudgeResult schema.
   *
   * This is an important distinction from the HTTP error above.
   */
  it("throws when Gemini returns invalid judge output", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          steps: [
            {
              type: "model_output",
              content: [
                {
                  type: "text",

                  /*
                   * `passed` should be a boolean, but the simulated model
                   * has returned the string "yes".
                   *
                   * This should be rejected by our Zod schema.
                   */
                  text: JSON.stringify({
                    passed: "yes",
                    score: 0.9,
                    reasoning: "Looks good.",
                  }),
                },
              ],
            },
          ],
        }),
      }),
    );

    const judge = createGeminiLLMJudge();

    /*
     * The HTTP request succeeds, but the returned model data is invalid.
     *
     * Zod should reject it, preventing invalid data from entering the
     * application.
     */
    await expect(
      judge.evaluate("Communication from management is poor.", {
        sentiment: "negative",
        themes: ["communication", "management"],
        priority: "medium",
        summary: "Employees are unhappy with management communication.",
      }),
    ).rejects.toThrow();
  });
});
