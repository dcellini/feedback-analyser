
import type { RagAnswerProvider } from "./rag-answer-provider.js";

/**
 * Creates a mock RAG answer provider for automated tests.
 *
 * Instead of calling Gemini, it returns a predictable answer.
 *
 * This allows us to test the RAG workflow without:
 *
 * - API requests.
 * - Network access.
 * - Gemini API quota usage.
 * - Unpredictable model responses.
 */
export const createMockRagAnswerProvider = (
  answer: string,
): RagAnswerProvider => {
  return {
    /*
     * The real provider will use the prompt to generate an answer.
     *
     * Our mock deliberately ignores the prompt and returns
     * the supplied answer.
     *
     * We can later use vi.fn() in a test if we want to verify
     * exactly which prompt the workflow passed in.
     */
    async generateAnswer(_prompt: string): Promise<string> {
      return answer;
    },
  };
};
