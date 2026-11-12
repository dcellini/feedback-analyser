import { ZodError } from "zod";

import { feedbackAnalyser } from "../analysis/feedback-analyser.js";
import type { FeedbackAnalysis } from "../analysis/internal/feedback-schema.js";
import { prepareFeedback } from "../embeddings/prepare-feedback.js";
import { createMockEmbeddingProvider } from "../embeddings/providers/mock-embedding-provider.js";
import type { SearchableFeedback } from "../embeddings/semantic-search.js";
import type { GroundedAnswer } from "../grounding/grounded-answer-schema.js";
import { GroundingVerificationError } from "../grounding/grounding-verification-error.js";
import { redactPersonalData } from "../privacy/redact-personal-data.js";
import { answerWithVerifiedTools } from "../tools/answer-with-tools.js";
import { createGetFeedbackStatsTool } from "../tools/implementations/get-feedback-stats-tool.js";
import { createSearchFeedbackTool } from "../tools/implementations/search-feedback-tool.js";

import { demoAnalyses } from "./data/demo-analyses.js";
import { demoFeedbackEmbeddings, demoQueryEmbeddings } from "./data/demo-embeddings.js";
import { demoFeedback } from "./data/demo-feedback.js";
import { demoRecordings } from "./data/demo-recordings.js";
import { traceToolCalls, type ToolCallSummary } from "./internal/trace-tool-calls.js";
import { createRecordedAIProvider } from "./providers/recorded-ai-provider.js";
import {
  createReplayToolProvider,
  normaliseQuestion,
  type AgentRecording,
} from "./providers/replay-tool-provider.js";

/**
 * CHAPTER 8 — DEMO SERVICE
 *
 * WHAT IS THIS?
 *
 * The single object the rest of the application uses to run the demo.
 * It offers four operations:
 *
 *   listFeedback()            → the synthetic comments (redacted)
 *   getFeedbackAnalysis(id)   → sentiment, themes, priority, summary
 *   listExampleQuestions()    → the questions visitors can ask
 *   askQuestion(question)     → a verified answer, or a rejection
 *
 * WHY A "SERVICE" LAYER?
 *
 * In Milestone 2 an HTTP API will sit on top of this. Keeping the
 * business logic HERE, rather than inside the HTTP handlers, means:
 *
 *   - It can be tested without starting a server.
 *   - The HTTP layer stays thin: read the request, call the service,
 *     turn the result into a response.
 *   - We could put a different front end on it (a CLI, a Lambda handler)
 *     without rewriting anything.
 *
 *   HTTP request
 *       ↓
 *   Route handler        ← Milestone 2: HTTP concerns only
 *       ↓
 *   Demo service         ← this file: what the app actually does
 *       ↓
 *   Chapters 1–7 code    ← analysis, search, agent, grounding
 *
 * SHARED vs PER-REQUEST STATE
 *
 * The service is created ONCE when the server starts, then used by every
 * request. So we have to be careful about what lives where:
 *
 *   Created once, shared (safe because it's never modified):
 *     - the prepared feedback and its embeddings
 *     - the searchFeedback and getFeedbackStats tools
 *     - the recorded analysis provider
 *
 *   Created fresh for every question (because it changes as it runs):
 *     - the replay provider (tracks its position in the recording)
 *     - the tool-call trace (collects this conversation's calls)
 *
 * Rule of thumb: shared READ-ONLY data is fine; shared MUTABLE data
 * mixes up different users' requests.
 */

/**
 * Upper limit on tool calls per question.
 *
 * Every recording uses at most two. In a future live mode, each tool call
 * is a Gemini request that costs money, so a low limit is also a cost
 * control.
 */
const MAX_TOOL_CALLS = 4;

/**
 * Everything the replay demo needs.
 *
 * The defaults come from src/demo/data. Tests can pass their own data to
 * check edge cases without editing the real dataset (dependency injection
 * again, as in Chapters 1–7).
 */
export interface DemoData {
  feedback: readonly SearchableFeedback[];
  /** Embedding per feedback ID. */
  feedbackEmbeddings: Readonly<Record<string, number[]>>;
  /** Embedding per search query used in the recordings. */
  queryEmbeddings: Readonly<Record<string, number[]>>;
  /** Recorded raw analysis JSON per feedback ID. */
  analyses: Readonly<Record<string, string>>;
  recordings: readonly AgentRecording[];
}

export const defaultDemoData: DemoData = {
  feedback: demoFeedback,
  feedbackEmbeddings: demoFeedbackEmbeddings,
  queryEmbeddings: demoQueryEmbeddings,
  analyses: demoAnalyses,
  recordings: demoRecordings,
};

/**
 * Errors the service EXPECTS to happen because of what a caller asked for.
 *
 * Each has a stable `code`. The HTTP layer (Milestone 2) will map codes to
 * status codes, for example:
 *
 *   FEEDBACK_NOT_FOUND     → 404 Not Found
 *   QUESTION_NOT_AVAILABLE → 422 Unprocessable Content
 *
 * Notice the service itself knows nothing about HTTP. It describes WHAT
 * went wrong; the HTTP layer decides how to report it.
 *
 * Anything that isn't a DemoServiceError is unexpected (a bug or an
 * outage) and should become a generic 500 error that reveals no details.
 */
export type DemoServiceErrorCode = "FEEDBACK_NOT_FOUND" | "QUESTION_NOT_AVAILABLE";

export class DemoServiceError extends Error {
  constructor(
    public readonly code: DemoServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DemoServiceError";
  }
}

/** An example question, as listed for visitors. */
export interface ExampleQuestion {
  id: string;
  question: string;
  kind: AgentRecording["kind"];
  note: string;
}

/**
 * The result of asking a question.
 *
 * This is a DISCRIMINATED UNION: the `outcome` field tells you which
 * shape you have, and TypeScript narrows the type when you check it.
 *
 *   if (result.outcome === "verified") {
 *     result.answer;   // ✅ available
 *   } else {
 *     result.reason;   // ✅ available
 *   }
 *
 * "verified" includes BOTH answered and insufficient-evidence responses.
 * Check `answer.status` to tell them apart.
 *
 * "rejected" means the AI produced an answer, but it failed validation or
 * grounding. That's a normal, expected outcome rather than a server error,
 * and showing it to visitors is a feature of the demo.
 */
export type QuestionResult =
  | {
      outcome: "verified";
      answer: GroundedAnswer;
      toolCalls: ToolCallSummary[];
      example: ExampleQuestion;
    }
  | {
      outcome: "rejected";
      reason: string;
      toolCalls: ToolCallSummary[];
      example: ExampleQuestion;
    };

/**
 * The operations the demo offers. The HTTP layer depends on this
 * interface, not on how it's implemented.
 */
export interface DemoService {
  listFeedback(): SearchableFeedback[];
  getFeedbackAnalysis(id: string): Promise<FeedbackAnalysis>;
  listExampleQuestions(): ExampleQuestion[];
  askQuestion(question: string): Promise<QuestionResult>;
}

/** Converts a recording into the public description of its question. */
const toExampleQuestion = (recording: AgentRecording): ExampleQuestion => ({
  id: recording.id,
  question: recording.question,
  kind: recording.kind,
  note: recording.note,
});

/**
 * Creates the replay-mode demo service.
 *
 * It's async because preparing the feedback for search (Chapter 3's
 * prepareFeedback) is async: with a real embedding provider it would make
 * network calls. We do it once, at startup, instead of on every search.
 */
export const createReplayDemoService = async (
  data: DemoData = defaultDemoData,
): Promise<DemoService> => {
  /*
   * STEP 1 — FAIL FAST ON MISSING RECORDINGS
   *
   * Check now, at startup, that every comment has a recorded analysis.
   * A server that refuses to start with a clear message is much easier
   * to debug than one that starts and fails on a visitor's first click.
   */
  for (const item of data.feedback) {
    if (data.analyses[item.id] === undefined) {
      throw new Error(`Demo data is incomplete: no recorded analysis for ${item.id}.`);
    }
  }

  /*
   * STEP 2 — THE RECORDED EMBEDDING PROVIDER
   *
   * EmbeddingProvider.embed() receives TEXT, so we build one lookup table
   * from text to vector containing both the feedback and the queries.
   *
   * We reuse the existing mock provider: it already does exactly this
   * (look up text, throw if missing). In replay mode, a "mock" and a
   * "recording" are the same idea.
   */
  const embeddingsByText: Record<string, number[]> = { ...data.queryEmbeddings };

  for (const item of data.feedback) {
    const embedding = data.feedbackEmbeddings[item.id];

    if (!embedding) {
      throw new Error(`Demo data is incomplete: no embedding for ${item.id}.`);
    }

    embeddingsByText[item.text] = embedding;
  }

  const embeddingProvider = createMockEmbeddingProvider(embeddingsByText);

  /*
   * STEP 3 — PREPARE FEEDBACK FOR SEARCH (Chapter 3), ONCE
   */
  const preparedFeedback = await prepareFeedback({
    feedback: data.feedback,
    embeddingProvider,
  });

  /*
   * STEP 4 — CREATE THE TOOLS (Chapters 5–6), ONCE
   *
   * Both are closures over read-only data, so sharing them between
   * requests is safe.
   */
  const searchFeedback = createSearchFeedbackTool({
    feedback: preparedFeedback,
    embeddingProvider,
  });

  const getFeedbackStats = createGetFeedbackStatsTool({ feedback: data.feedback });

  /*
   * STEP 5 — THE RECORDED ANALYSIS PROVIDER
   *
   * Feedback is redacted BEFORE analysis (the AI should never see
   * personal data), so the recordings are keyed by the redacted text.
   */
  const analysisProvider = createRecordedAIProvider(
    new Map(
      data.feedback.map((item) => [redactPersonalData(item.text), data.analyses[item.id] ?? ""]),
    ),
  );

  return {
    listFeedback() {
      /*
       * Return redacted text. Visitors see what the AI sees, which also
       * shows the redaction feature working (fb-020).
       */
      return data.feedback.map((item) => ({
        id: item.id,
        text: redactPersonalData(item.text),
      }));
    },

    async getFeedbackAnalysis(id) {
      const item = data.feedback.find((candidate) => candidate.id === id);

      if (!item) {
        throw new DemoServiceError("FEEDBACK_NOT_FOUND", `No feedback exists with ID "${id}".`);
      }

      /*
       * Chapter 1's pipeline, unchanged:
       * provider → raw JSON string → JSON.parse → Zod → FeedbackAnalysis
       */
      return feedbackAnalyser({
        feedback: redactPersonalData(item.text),
        aiProvider: analysisProvider,
      });
    },

    listExampleQuestions() {
      return data.recordings.map(toExampleQuestion);
    },

    async askQuestion(question) {
      /*
       * STEP 1 — FIND THE RECORDING
       *
       * Replay mode can only answer questions that were recorded. Making
       * up an answer to any other question would be dishonest, so we
       * report it as an expected, caller-facing error.
       */
      const recording = data.recordings.find(
        (candidate) => normaliseQuestion(candidate.question) === normaliseQuestion(question),
      );

      if (!recording) {
        throw new DemoServiceError(
          "QUESTION_NOT_AVAILABLE",
          "This demo can only answer its example questions.",
        );
      }

      const example = toExampleQuestion(recording);

      /*
       * STEP 2 — PER-REQUEST OBJECTS
       *
       * A fresh replay provider (its own position in the recording),
       * wrapped in a fresh trace (its own list of tool calls).
       */
      const { provider, toolCalls } = traceToolCalls(createReplayToolProvider(recording));

      try {
        /*
         * STEP 3 — RUN THE REAL CHAPTER 7 AGENT
         *
         * Tools execute, results are redacted, and the final answer is
         * validated and grounded, exactly as with live Gemini.
         */
        const answer = await answerWithVerifiedTools({
          question,
          provider,
          searchFeedback,
          getFeedbackStats,
          maxToolCalls: MAX_TOOL_CALLS,
          evidenceRequirement: recording.evidenceRequirement,
        });

        return { outcome: "verified", answer, toolCalls, example };
      } catch (error) {
        /*
         * STEP 4 — SORT EXPECTED FAILURES FROM UNEXPECTED ONES
         *
         * Grounding failure: the answer cited something unsupported.
         * Its reason is safe and useful to show, e.g.
         * "Quotation does not match source: fb-017".
         */
        if (error instanceof GroundingVerificationError) {
          return { outcome: "rejected", reason: error.reason, toolCalls, example };
        }

        /*
         * Zod failure: the AI's answer (or tool arguments) had the wrong
         * structure. Zod's own messages describe our schema in detail, so
         * we return a plain summary instead.
         */
        if (error instanceof ZodError) {
          return {
            outcome: "rejected",
            reason: "The AI's response did not match the required answer structure.",
            toolCalls,
            example,
          };
        }

        /*
         * Anything else (a replay mismatch, the tool-call limit, a bug) is
         * unexpected. Re-throw it so the HTTP layer returns a generic 500
         * error and logs the details privately.
         */
        throw error;
      }
    },
  };
};
