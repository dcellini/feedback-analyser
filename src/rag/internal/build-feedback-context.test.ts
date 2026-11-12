import { describe, expect, it } from "vitest";

import { buildFeedbackContext } from "./build-feedback-context.js";

describe("buildFeedbackContext", () => {
  it("formats search results with source IDs and feedback text", () => {
    /*
     * Arrange: simulate results from semanticSearch().
     *
     * These are ordinary objects, so we don't need
     * an embedding provider or Gemini.
     */
    const results = [
      {
        id: "feedback-001",
        text: "My manager is supportive.",
        similarity: 0.94,
      },
      {
        id: "feedback-002",
        text: "My contributions aren't recognised.",
        similarity: 0.89,
      },
    ];

    /*
     * Act: convert the results into LLM context.
     */
    const context = buildFeedbackContext(results);

    /*
     * Assert: check the exact expected format.
     *
     * We also verify that similarity scores aren't included.
     */
    expect(context).toBe(
      [
        "Source: feedback-001\nFeedback: My manager is supportive.",
        "Source: feedback-002\nFeedback: My contributions aren't recognised.",
      ].join("\n\n"),
    );

    expect(context).not.toContain("0.94");
    expect(context).not.toContain("0.89");
  });

  it("returns an empty string when there are no results", () => {
    /*
     * An empty dataset should not cause an error.
     *
     * The RAG workflow will later decide how to handle
     * this case before calling Gemini.
     */
    expect(buildFeedbackContext([])).toBe("");
  });
});
