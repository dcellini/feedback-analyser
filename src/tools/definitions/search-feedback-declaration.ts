
/**
 * SEARCH FEEDBACK — GEMINI TOOL DECLARATION
 *
 * This object describes our searchFeedback tool to Gemini.
 *
 * IMPORTANT:
 * This does NOT execute the function.
 *
 * It tells Gemini:
 * - The tool's name.
 * - What the tool does.
 * - Which arguments it accepts.
 *
 * Gemini uses this information to decide whether
 * to request the tool when answering a question.
 */
export const searchFeedbackDeclaration = {
  /*
   * The name Gemini uses when requesting this tool.
   *
   * Our TypeScript application will use this name
   * to identify which function to execute.
   */
  name: "searchFeedback",

  /*
   * The description helps Gemini decide when
   * this tool would be useful.
   *
   * Clear descriptions improve tool selection.
   */
  description:
    "Search employee feedback by semantic meaning. " +
    "Use this tool when answering questions about employee " +
    "experiences, concerns, opinions or workplace topics. " +
    "Returns relevant feedback records with source IDs.",

  /*
   * JSON Schema describes the arguments Gemini
   * should generate when requesting the tool.
   *
   * This is different from our Zod schema:
   *
   * JSON Schema -> tells Gemini what to generate.
   * Zod -> validates what Gemini actually generates.
   */
  parametersJsonSchema: {
    type: "object",

    properties: {
      query: {
        type: "string",
        description:
          "The topic or question to search for in employee feedback.",
      },

      limit: {
        type: "integer",
        description:
          "Maximum number of feedback records to return, between 1 and 10.",
        minimum: 1,
        maximum: 10,
      },
    },

    /*
     * A query is required.
     *
     * The limit is optional because our Zod schema
     * provides a default value of 5.
     */
    required: ["query"],

    /*
     * Prevent the model from supplying unexpected
     * argument names in the declared schema.
     *
     * Our runtime Zod validation is still necessary.
     */
    additionalProperties: false,
  },
} as const;
