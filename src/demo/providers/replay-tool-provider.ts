import type { EvidenceRequirement, StructuredToolProvider } from "../../tools/answer-with-tools.js";

/**
 * CHAPTER 8 — REPLAY TOOL PROVIDER
 *
 * WHAT IS THIS?
 *
 * A StructuredToolProvider that, instead of calling Gemini, plays back a
 * conversation that was recorded earlier.
 *
 * Remember how the verified agent (Chapter 7) talks to its provider:
 *
 *   agent → provider.askQuestion("How many comments...?")
 *   provider → { type: "tool_call", getFeedbackStats }
 *
 *   agent runs the tool, then:
 *   agent → provider.submitToolResult({ name: "getFeedbackStats", result })
 *   provider → { type: "tool_call", searchFeedback("workload") }
 *
 *   agent runs the tool, then:
 *   agent → provider.submitToolResult({ name: "searchFeedback", result })
 *   provider → { type: "answer", answer: {...} }
 *
 * The provider's side of that conversation is just a list of responses.
 * A recording stores that list; this provider hands them out in order.
 *
 * WHY IS THIS USEFUL?
 *
 * Only Gemini's replies are recorded. EVERYTHING ELSE RUNS FOR REAL:
 *
 *   - the tools execute against the demo dataset
 *   - personal data is redacted
 *   - Zod validates the final answer
 *   - quotations, sources and numbers are verified
 *
 * So the public demo exercises the genuine Chapter 7 pipeline with no
 * Gemini calls — no cost, no API key on the server, no abuse risk.
 *
 * This is the "record/replay" testing pattern. Libraries such as
 * Ruby's VCR or Node's Polly.js do the same thing for HTTP traffic.
 */

/**
 * One response from the provider's side of the conversation.
 *
 * We derive the type from the existing interface rather than exporting a
 * new one from answer-with-tools.ts:
 *
 *   StructuredToolProvider["askQuestion"]   → the method's type
 *   ReturnType<...>                         → Promise<StructuredToolResponse>
 *   Awaited<...>                            → StructuredToolResponse
 *
 * If the agent's response type ever changes, this type changes with it.
 */
export type RecordedProviderResponse = Awaited<ReturnType<StructuredToolProvider["askQuestion"]>>;

/**
 * A recorded conversation for one example question.
 */
export interface AgentRecording {
  /** Stable identifier, e.g. "workload-and-count". Useful for URLs and tests. */
  id: string;

  /** The question exactly as it was asked when recorded. */
  question: string;

  /**
   * The evidence the agent must retrieve before an "answered" response
   * is accepted (see answerWithVerifiedTools in Chapter 7).
   */
  evidenceRequirement: EvidenceRequirement;

  /**
   * Explains to visitors why this example exists.
   *
   * Two of the recordings are DELIBERATELY FAULTY: they replay the kind
   * of mistake real models make (an invented quote, a wrong count) so the
   * demo can show the validator rejecting them. The UI must label those
   * clearly, so the demo doesn't misrepresent what Gemini actually did.
   */
  kind: "genuine" | "deliberately-faulty";
  note: string;

  /** The provider's responses, in the order they were given. */
  responses: RecordedProviderResponse[];
}

/**
 * Thrown when the agent and the recording disagree — e.g. the agent sends
 * a result for a tool the recording never asked for.
 *
 * This always means a bug or an out-of-date recording, never something a
 * visitor did, so callers should treat it as an internal error.
 */
export class ReplayMismatchError extends Error {
  constructor(recordingId: string, detail: string) {
    super(`Replay of recording "${recordingId}" failed: ${detail}`);
    this.name = "ReplayMismatchError";
  }
}

/**
 * Normalises a question for comparison: trims, collapses whitespace and
 * ignores case, so "  How many  comments? " matches "How many comments?".
 */
export const normaliseQuestion = (question: string): string =>
  question.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Creates a provider that replays one recording.
 *
 * IMPORTANT — CREATE ONE PER REQUEST.
 *
 * The provider remembers how far through the recording it is (`position`).
 * That's per-conversation state, exactly like the `conversation` array in
 * createGeminiToolProvider. If two visitors shared one provider, their
 * requests would interleave and each would get the wrong responses.
 *
 * Because this is a factory function, each call returns a new provider
 * with its own `position` variable captured in a closure.
 */
export const createReplayToolProvider = (recording: AgentRecording): StructuredToolProvider => {
  /*
   * Index of the next response to hand out.
   *
   * `let` inside the factory = private to this provider instance.
   * Nothing outside can read or change it.
   */
  let position = 0;

  /*
   * Hands out the next recorded response.
   *
   * structuredClone() returns a deep copy. The recordings are shared,
   * module-level data used by every request; giving each request its own
   * copy guarantees one request can never modify what another sees.
   */
  const nextResponse = (): RecordedProviderResponse => {
    const response = recording.responses[position];

    if (!response) {
      throw new ReplayMismatchError(recording.id, "the recording has no more responses.");
    }

    position += 1;

    return structuredClone(response);
  };

  return {
    async askQuestion(question) {
      /*
       * The conversation must start at the beginning, and only once.
       */
      if (position !== 0) {
        throw new ReplayMismatchError(recording.id, "askQuestion was called more than once.");
      }

      /*
       * Replaying an answer to a DIFFERENT question would be dishonest,
       * so refuse rather than return something misleading.
       */
      if (normaliseQuestion(question) !== normaliseQuestion(recording.question)) {
        throw new ReplayMismatchError(recording.id, "the question does not match the recording.");
      }

      return nextResponse();
    },

    async submitToolResult({ name }) {
      /*
       * The agent should only ever submit a result for the tool the
       * previous response asked for. If not, the agent's behaviour has
       * changed since the recording was made.
       */
      const previous = recording.responses[position - 1];

      if (previous?.type !== "tool_call" || previous.toolCall.name !== name) {
        throw new ReplayMismatchError(
          recording.id,
          `received a result for "${name}", which the recording did not request.`,
        );
      }

      /*
       * Notice we ignore the tool RESULT itself. Gemini would read it and
       * decide what to do next; the recording already contains what it
       * decided. The real tool still ran, and its results are what the
       * grounding validator checks the final answer against.
       */
      return nextResponse();
    },
  };
};
