
/**
 * CHAPTER 6 — NEW: Feedback Statistics Tool Declaration
 *
 * WHY ARE WE ADDING THIS?
 *
 * In Chapter 5, we created searchFeedbackDeclaration
 * to tell Gemini about our semantic search tool.
 *
 * In Chapter 6, we're introducing a second tool:
 * getFeedbackStats().
 *
 * Gemini will eventually receive BOTH declarations,
 * allowing it to choose which tool to request.
 *
 * IMPORTANT:
 * This file only DESCRIBES the tool to Gemini.
 * It does not execute getFeedbackStats().
 *
 * REUSED CONCEPT FROM CHAPTER 5:
 * Function declarations and JSON Schema.
 */

export const getFeedbackStatsDeclaration = {
  // The name Gemini must use when requesting this tool.
  name: "getFeedbackStats",

  // Gemini uses this description to decide
  // when the tool would be useful.
  description:
    "Get the total number of employee feedback records " +
    "available in the current feedback collection.",

  // This tool requires no arguments.
  //
  // Unlike searchFeedback(), Gemini doesn't need
  // to supply a query or limit.
  parametersJsonSchema: {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
};
