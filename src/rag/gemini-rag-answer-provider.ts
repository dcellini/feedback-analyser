import type { RagAnswerProvider } from "./rag-answer-provider.js";

/**
 * Creates a real Gemini implementation of RagAnswerProvider.
 *
 * Unlike our mock provider, generateAnswer() makes a
 * real external API request when called.
 *
 * Creating the provider itself does not make a request.
 */
export const createGeminiRagAnswerProvider = (): RagAnswerProvider => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  /*
   * Use the same Gemini model as our existing AI provider
   * if you have configured a particular model elsewhere.
   *
   * This example uses gemini-2.5-flash.
   */
  const model = "gemini-3.5-flash-lite";

  return {
    async generateAnswer(prompt: string): Promise<string> {
      /*
       * Send the fully constructed RAG prompt to Gemini.
       *
       * The prompt already contains:
       *
       * - Instructions for answering.
       * - Retrieved feedback as supporting evidence.
       * - The user's question.
       */
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
          }),
        },
      );

      /*
       * Check HTTP errors before attempting to read
       * the generated answer.
       */
      if (!response.ok) {
        const errorBody = await response.text();

        throw new Error(
          `Gemini RAG request failed: ${response.status} ${response.statusText}\n${errorBody}`,
        );
      }

      /*
       * Gemini returns a structured JSON response.
       *
       * We only need the generated text.
       *
       * Define the small part of the response shape
       * that this provider actually uses.
       */
      const data = (await response.json()) as {
        candidates?: {
          content?: {
            parts?: {
              text?: string;
            }[];
          };
        }[];
      };

      /*
       * Extract the answer from the first candidate.
       *
       * If Gemini returns no text, fail explicitly rather
       * than silently returning an empty answer.
       */
      const answer = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!answer) {
        throw new Error("Gemini returned an empty RAG answer.");
      }

      return answer;
    },
  };
};

/*
 * EXAMPLE: SUCCESSFUL GEMINI RAG EXECUTION
 *
 * Command:
 * npx tsx src/rag/answer-feedback-question.manual.ts
 *
 * Question:
 * What are employees saying about management?
 *
 * Generated Answer:
 * Based on the provided employee feedback, employees are saying
 * the following about management:
 *
 * - Senior management rarely recognises the extra effort put in
 *   by their team [feedback-002].
 * - One employee's manager is supportive and always listens
 *   to their concerns [feedback-001].
 *
 * Retrieved Sources:
 *
 * feedback-002
 * Similarity: 0.788
 * Feedback: Senior management rarely recognises the extra effort
 * our team puts in.
 *
 * feedback-001
 * Similarity: 0.784
 * Feedback: My manager is supportive and always listens to
 * my concerns.
 *
 * feedback-003
 * Similarity: 0.752
 * Feedback: The office parking facilities are inadequate.
 *
 * RAG Summary:
 * - Feedback records available: 3
 * - Sources retrieved: 3
 * - Minimum similarity threshold: 0.7
 *
 * OBSERVATIONS
 *
 * 1. The complete RAG pipeline executed successfully using Gemini.
 *
 * 2. Semantic search correctly ranked the two management-related
 *    comments above the unrelated parking feedback.
 *
 * 3. Gemini generated an answer grounded in the relevant feedback
 *    and cited the correct source IDs.
 *
 * 4. The parking feedback was also retrieved because its similarity
 *    score (0.752) exceeded our threshold of 0.7.
 *
 * 5. Gemini correctly excluded the unrelated parking feedback
 *    from its generated answer.
 *
 * KEY LEARNING
 *
 * Embedding similarity measures how closely vectors align,
 * but a high similarity score does not guarantee relevance.
 *
 * A similarity threshold of 0.7 was too permissive for this example.
 * Increasing it to 0.77 would exclude the parking feedback while
 * retaining both management comments.
 *
 * However, thresholds should be evaluated across multiple questions
 * and datasets rather than tuned to a single example.
 *
 * Production RAG systems should evaluate both:
 * - Retrieval quality: Did we find the right evidence?
 * - Answer quality: Did the LLM use that evidence accurately?
 *
 * This example demonstrates a working RAG implementation,
 * but not yet a fully evaluated or production-ready system.
 */
