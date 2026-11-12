import type { LLMJudge, JudgeResult } from "./llm-judge.js";

/**
 * Creates a fake LLM judge for use in tests.
 *
 * Bigger picture:
 *
 *     evaluateAnalysis()
 *            ↓
 *         LLMJudge
 *        ↙       ↘
 *   Mock judge   Gemini judge
 *      ↓             ↓
 *    tests        real API
 *
 * We don't want our automated tests making real Gemini API calls.
 * The mock lets us control exactly what the judge returns.
 *
 * This makes tests:
 * - fast
 * - predictable
 * - independent of API availability/quota
 * - free from variations in LLM responses
 */
export const createMockLLMJudge = (result: JudgeResult): LLMJudge => ({
  /*
   * The mock still implements the same `evaluate()` method as a real judge.
   *
   * The `_` prefix on the parameters tells us intentionally that these
   * inputs aren't used by this mock.
   *
   * That's because this mock isn't trying to reproduce the behaviour of
   * an LLM. Its job is simply to provide a controlled JudgeResult so that
   * we can test the code around the judge.
   */
  async evaluate(_feedback: string, _analysis): Promise<JudgeResult> {
    /*
     * Return exactly the result supplied when the mock was created.
     *
     * For example, a test can create:
     *
     * createMockLLMJudge({
     *   passed: true,
     *   score: 0.9,
     *   reasoning: "The analysis is accurate."
     * });
     *
     * The test therefore knows exactly what the judge will return.
     */
    return result;
  },
});
