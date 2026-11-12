/**
 * Defines the contract for an AI provider that generates
 * answers to questions about employee feedback.
 *
 * The RAG workflow is responsible for:
 *
 * - Retrieving relevant feedback.
 * - Building context.
 * - Constructing the prompt.
 *
 * The provider is responsible only for generating an answer
 * from that prompt.
 *
 * This separation allows us to use:
 *
 * - A mock provider in automated tests.
 * - Gemini in real executions.
 * - A different model provider in the future.
 */
export interface RagAnswerProvider {
  /**
   * Generate an answer from a fully constructed RAG prompt.
   *
   * The provider doesn't need to know how the feedback
   * was retrieved or how the prompt was constructed.
   *
   * Example:
   *
   * const answer = await provider.generateAnswer(prompt);
   */
  generateAnswer(prompt: string): Promise<string>;
}
