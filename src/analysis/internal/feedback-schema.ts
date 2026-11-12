import { z } from "zod";

/**
 * Runtime schema for the structured analysis produced by the AI.
 *
 * This defines exactly what a valid FeedbackAnalysis must look like:
 *
 * - sentiment must be positive, negative or neutral
 * - themes must be an array of strings
 * - priority must be low, medium or high
 * - summary must be a string
 *
 * This schema is particularly important because AI output is external
 * data and therefore cannot be trusted simply because we asked the model
 * to follow this structure.
 *
 * The schema is used at runtime by Zod to validate the actual response.
 *
 * It is also converted to JSON Schema when making the Gemini request,
 * allowing us to communicate the expected output structure to the model.
 */
export const feedbackAnalysisSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  themes: z.array(z.string()),
  priority: z.enum(["low", "medium", "high"]),
  summary: z.string(),
});

/**
 * TypeScript type derived directly from the Zod schema.
 *
 * `z.infer` means we don't have to define the same structure twice:
 *
 *     Zod schema → FeedbackAnalysis type
 *
 * This gives us a single source of truth for the shape of a
 * FeedbackAnalysis.
 *
 * Important distinction:
 *
 * - `FeedbackAnalysis` protects our code at compile time.
 * - `feedbackAnalysisSchema` validates actual data at runtime.
 *
 * TypeScript types disappear when the application runs, whereas the
 * Zod schema remains available to perform real validation.
 */
export type FeedbackAnalysis = z.infer<typeof feedbackAnalysisSchema>;
