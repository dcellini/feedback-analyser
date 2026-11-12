import { z } from "zod";

/**
 * SEARCH FEEDBACK TOOL — ARGUMENT VALIDATION
 *
 * Defines which arguments our searchFeedback tool accepts.
 *
 * Gemini will eventually generate these arguments.
 * Because they come from an external source, we cannot
 * assume they are valid.
 *
 * Zod validates the arguments at runtime before
 * we pass them into our TypeScript function.
 */
export const searchFeedbackSchema = z.object({
  /*
   * The search query must:
   *
   * - Be a string.
   * - Have surrounding whitespace removed.
   * - Contain at least one character after trimming.
   */
  query: z.string().trim().min(1),

  /*
   * The result limit must:
   *
   * - Be an integer.
   * - Be between 1 and 10.
   * - Default to 5 if Gemini omits it.
   */
  limit: z.number().int().min(1).max(10).default(5),
});

/**
 * Infer the validated argument type from the schema.
 *
 * z.output gives us the type AFTER Zod has applied
 * transformations and defaults.
 *
 * For example, limit is guaranteed to be a number
 * after successful validation, even if it was omitted
 * from the original input.
 */
export type ValidatedSearchFeedbackArgs = z.output<typeof searchFeedbackSchema>;
