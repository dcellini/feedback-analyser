import { beforeAll, describe, expect, it } from "vitest";

import { createReplayDemoService, type DemoService } from "../demo-service.js";
import { demoRecordings } from "./demo-recordings.js";

/**
 * CHAPTER 8 — RECORDINGS STAY VALID
 *
 * WHY THIS TEST MATTERS
 *
 * A recorded answer quotes specific comments. Those quotes only verify if
 * the live searchFeedback tool actually retrieves those comments, which
 * depends on the dataset AND the embeddings.
 *
 * So if someone edits a comment, changes an embedding or re-records with
 * real Gemini vectors (Milestone 3), a recording could silently stop
 * working. This test replays every recording through the real pipeline
 * and checks it still produces the outcome it was designed for:
 *
 *   genuine             → "verified" (answered or insufficient evidence)
 *   deliberately-faulty → "rejected" by the validator
 *
 * `it.each` runs the same test once per recording, so a failure names
 * exactly which recording broke.
 */
describe("demo recordings", () => {
  let service: DemoService;

  beforeAll(async () => {
    service = await createReplayDemoService();
  });

  it.each(demoRecordings.filter((recording) => recording.kind === "genuine"))(
    "genuine recording '$id' passes verification",
    async (recording) => {
      const result = await service.askQuestion(recording.question);

      expect(result.outcome).toBe("verified");
    },
  );

  it.each(demoRecordings.filter((recording) => recording.kind === "deliberately-faulty"))(
    "deliberately faulty recording '$id' is rejected",
    async (recording) => {
      const result = await service.askQuestion(recording.question);

      expect(result.outcome).toBe("rejected");
    },
  );

  it("has unique IDs and unique questions", () => {
    const ids = demoRecordings.map((recording) => recording.id);
    const questions = demoRecordings.map((recording) => recording.question.toLowerCase());

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("explains every deliberately faulty recording to visitors", () => {
    for (const recording of demoRecordings) {
      if (recording.kind === "deliberately-faulty") {
        expect(recording.note).toMatch(/^Deliberately faulty example/);
      }
    }
  });
});
