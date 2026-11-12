import type { FeedbackAnalysis } from "../../analysis/internal/feedback-schema.js";

/**
 * Contract for anything that can act as an LLM judge.
 *
 * Bigger picture:
 *
 *     evaluateWithJudge()
 *             ↓
 *          LLMJudge
 *          ↙      ↘
 *    Mock judge   Gemini judge
 *
 * The rest of the application doesn't need to know which LLM or provider
 * is being used. It only needs something that satisfies this interface.
 *
 * This is the same dependency-injection pattern we use with AIProvider.
 */
export interface LLMJudge {
  /**
   * Evaluates an AI-generated feedback analysis against the original
   * employee feedback.
   *
   * The method is asynchronous because a real implementation will need
   * to make a request to an external LLM.
   */
  evaluate(feedback: string, analysis: FeedbackAnalysis): Promise<JudgeResult>;
}

/**
 * The standard result returned by an LLM judge.
 *
 * `passed` gives us a simple overall decision.
 *
 * `score` gives us more information than a simple pass/fail. A score such
 * as 0.91 and one such as 0.52 can both potentially pass depending on
 * whatever threshold we eventually choose.
 *
 * `reasoning` gives us an explanation that can help us understand why
 * the judge reached its conclusion.
 */
export type JudgeResult = {
  passed: boolean;
  score: number;
  reasoning: string;
};
