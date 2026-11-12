import { describe, expect, it } from "vitest";

import { feedbackAnalyser } from "../../analysis/feedback-analyser.js";
import { createRecordedAIProvider } from "./recorded-ai-provider.js";

/**
 * CHAPTER 8 — RECORDED AI PROVIDER TESTS
 */
describe("createRecordedAIProvider", () => {
  const analysis = {
    sentiment: "positive",
    themes: ["teamwork"],
    priority: "low",
    summary: "The employee enjoys their team.",
  };

  const provider = createRecordedAIProvider(new Map([["Great team!", JSON.stringify(analysis)]]));

  it("returns the recorded raw response for known feedback", async () => {
    await expect(provider.analyzeFeedback("Great team!")).resolves.toBe(JSON.stringify(analysis));
  });

  it("throws for feedback with no recording", async () => {
    await expect(provider.analyzeFeedback("Something else")).rejects.toThrow(
      "No recorded analysis exists",
    );
  });

  it("works with the Chapter 1 pipeline, including Zod validation", async () => {
    await expect(
      feedbackAnalyser({ feedback: "Great team!", aiProvider: provider }),
    ).resolves.toEqual(analysis);
  });

  it("still rejects an invalid recording, just like an invalid live response", async () => {
    // A recording that is valid JSON but has the wrong structure.
    const broken = createRecordedAIProvider(new Map([["Hi", JSON.stringify({ sentiment: "great" })]]));

    await expect(feedbackAnalyser({ feedback: "Hi", aiProvider: broken })).rejects.toThrow();
  });
});
