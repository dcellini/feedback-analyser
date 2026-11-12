/**
 * CHAPTER 9 — THE API CONTRACT, AS SEEN BY THE FRONTEND
 *
 * WHERE DO THESE TYPES COME FROM?
 *
 * `import type` pulls TYPES ONLY from the backend code in ../src. Types
 * are erased when the app is built, so none of the backend's code ends up
 * in the browser bundle. We get one source of truth for the shapes,
 * without duplicating them:
 *
 *   backend changes QuestionResult  →  frontend type errors appear here
 *
 * The response "envelopes" ({ feedback: [...] }, { analysis: {...} })
 * are defined by the HTTP layer, so they're written out below.
 */
import type { FeedbackAnalysis } from "../../../src/analysis/internal/feedback-schema";
import type { ExampleQuestion, QuestionResult } from "../../../src/demo/demo-service";
import type { ToolCallSummary } from "../../../src/demo/internal/trace-tool-calls";
import type { SearchableFeedback } from "../../../src/embeddings/semantic-search";
import type { GroundedAnswer } from "../../../src/grounding/grounded-answer-schema";

export type {
  ExampleQuestion,
  FeedbackAnalysis,
  GroundedAnswer,
  QuestionResult,
  SearchableFeedback,
  ToolCallSummary,
};

/** GET /api/feedback */
export interface FeedbackListResponse {
  feedback: SearchableFeedback[];
}

/** GET /api/feedback/:id/analysis */
export interface FeedbackAnalysisResponse {
  analysis: FeedbackAnalysis;
}

/** GET /api/questions/examples */
export interface ExampleQuestionsResponse {
  examples: ExampleQuestion[];
}

/** Every error response from the API has this shape. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
