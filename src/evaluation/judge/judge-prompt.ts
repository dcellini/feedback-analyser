import type { FeedbackAnalysis } from "../../analysis/internal/feedback-schema.js";

/**
 * Builds the prompt used by the LLM judge to evaluate an AI-generated
 * feedback analysis.
 *
 * Bigger picture:
 *
 *     Original feedback ─────┐
 *                            ↓
 *                       buildJudgePrompt()
 *                            ↓
 *                     Judge instructions
 *                            ↓
 *                       Gemini LLM
 *                            ↓
 *                      JudgeResult
 *
 * Keeping prompt construction in its own function means the Gemini
 * integration doesn't need to contain the actual evaluation instructions.
 *
 * This also makes the prompt easier to change and test independently
 * from the API communication.
 */
export const buildJudgePrompt = (feedback: string, analysis: FeedbackAnalysis): string => `
Evaluate the quality of the following employee feedback analysis.

Original employee feedback:
${feedback}

AI analysis:
${JSON.stringify(analysis, null, 2)}

Evaluate the analysis against these criteria:

1. Sentiment accurately reflects the employee's overall feeling.
2. Themes identify the important issues present in the feedback.
3. Priority is appropriate given the seriousness of the feedback.
4. The summary accurately represents the feedback.
5. The analysis does not introduce information that is not supported by the feedback.

Return:
- passed: whether the analysis is acceptable overall
- score: a number between 0 and 1
- reasoning: a concise explanation of your judgement
`;
