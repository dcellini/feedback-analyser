import { describe, expect, it, vi } from "vitest";

import { createMockEmbeddingProvider } from "../embeddings/providers/mock-embedding-provider.js";
import type { EmbeddedFeedback } from "../embeddings/prepare-feedback.js";
import type { RagAnswerProvider } from "./rag-answer-provider.js";
import { answerFeedbackQuestion } from "./answer-feedback-question.js";

describe("answerFeedbackQuestion", () => {
  /*
   * These are precomputed feedback embeddings.
   *
   * In a real application, prepareFeedback() would
   * generate them using our embedding provider.
   *
   * We use simple vectors here to make the expected
   * similarities predictable.
   */
  const feedback: EmbeddedFeedback[] = [
    {
      id: "feedback-001",
      text: "My manager listens to my concerns.",
      embedding: [1, 0],
    },
    {
      id: "feedback-002",
      text: "The office parking needs improving.",
      embedding: [0, 1],
    },
  ];

  it("retrieves relevant feedback and generates an answer using its context", async () => {
    /*
     * STEP 1 — MOCK THE EMBEDDING PROVIDER
     *
     * Our question is semantically aligned with
     * the management feedback.
     */
    const embeddingProvider = createMockEmbeddingProvider({
      "What are employees saying about management?": [1, 0],
    });

    /*
     * STEP 2 — MOCK THE ANSWER PROVIDER
     *
     * vi.fn() allows us to inspect the prompt passed
     * into generateAnswer().
     */
    const generateAnswer = vi.fn(async (_prompt: string) => {
      return "Employees appreciate managers who listen [feedback-001].";
    });

    const answerProvider: RagAnswerProvider = {
      generateAnswer,
    };

    /*
     * STEP 3 — RUN THE RAG WORKFLOW
     */
    const result = await answerFeedbackQuestion({
      question: "What are employees saying about management?",
      feedback,
      embeddingProvider,
      answerProvider,
    });

    /*
     * STEP 4 — VERIFY THE RETURNED ANSWER
     */
    expect(result.answer).toBe("Employees appreciate managers who listen [feedback-001].");

    /*
     * Only the management feedback should pass
     * our similarity threshold of 0.7.
     */
    expect(result.sources).toEqual([
      {
        id: "feedback-001",
        text: "My manager listens to my concerns.",
        similarity: 1,
      },
    ]);

    /*
     * Verify the answer provider was called once.
     */
    expect(generateAnswer).toHaveBeenCalledOnce();

    /*
     * Inspect the prompt sent to the provider.
     *
     * It should include the relevant feedback,
     * but exclude unrelated parking feedback.
     */
    const prompt = generateAnswer.mock.calls[0]?.[0];

    expect(prompt).toContain("What are employees saying about management?");
    expect(prompt).toContain("Source: feedback-001");
    expect(prompt).toContain("My manager listens to my concerns.");

    expect(prompt).not.toContain("The office parking needs improving.");
  });

  it("returns a fallback answer without calling the LLM when no feedback is relevant", async () => {
    /*
     * Our question points in a different direction
     * from both stored feedback vectors.
     *
     * Cosine similarity will be approximately 0.707
     * for each record, so we raise the threshold
     * to 0.9 for this test.
     */
    const embeddingProvider = createMockEmbeddingProvider({
      "What are employees saying about salaries?": [1, 1],
    });

    const generateAnswer = vi.fn(async () => "This should never be returned.");

    const answerProvider: RagAnswerProvider = {
      generateAnswer,
    };

    const result = await answerFeedbackQuestion({
      question: "What are employees saying about salaries?",
      feedback,
      embeddingProvider,
      answerProvider,
      minSimilarity: 0.9,
    });

    expect(result).toEqual({
      answer: "I couldn't find relevant employee feedback to answer that question.",
      sources: [],
    });

    /*
     * No relevant feedback means no answer-generation request.
     *
     * The embedding provider was still used to search,
     * but the LLM answer provider was not called.
     */
    expect(generateAnswer).not.toHaveBeenCalled();
  });
});
