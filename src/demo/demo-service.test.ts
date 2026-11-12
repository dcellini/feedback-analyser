import { beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  createReplayDemoService,
  defaultDemoData,
  DemoServiceError,
  type DemoService,
} from "./demo-service.js";
import { ReplayMismatchError } from "./providers/replay-tool-provider.js";

/**
 * CHAPTER 8 — DEMO SERVICE TESTS
 *
 * These test the service the HTTP API will call. No server, no Gemini:
 * just function calls, which is why keeping business logic out of the
 * HTTP layer makes testing so much easier.
 *
 * The recordings themselves are covered in data/demo-recordings.test.ts.
 * Here we test the service's own responsibilities:
 *
 * - Redaction of listed feedback.
 * - Analysis lookup and "not found" errors.
 * - Question matching and "not available" errors.
 * - Sorting expected failures (rejected) from unexpected ones (thrown).
 * - Independence of concurrent requests.
 * - Failing fast on incomplete data.
 */
describe("createReplayDemoService", () => {
  let service: DemoService;

  beforeAll(async () => {
    service = await createReplayDemoService();
  });

  describe("listFeedback", () => {
    it("lists all 24 synthetic comments", () => {
      expect(service.listFeedback()).toHaveLength(24);
    });

    it("redacts personal data before returning feedback", () => {
      const fb020 = service.listFeedback().find((item) => item.id === "fb-020");

      expect(fb020?.text).toContain("[EMAIL REDACTED]");
      expect(fb020?.text).toContain("[PHONE REDACTED]");
      expect(fb020?.text).not.toContain("sam.taylor@example.com");
    });
  });

  describe("getFeedbackAnalysis", () => {
    it("returns a validated analysis for a known comment", async () => {
      const analysis = await service.getFeedbackAnalysis("fb-003");

      expect(analysis.sentiment).toBe("negative");
      expect(analysis.priority).toBe("high");
    });

    it("throws FEEDBACK_NOT_FOUND for an unknown ID", async () => {
      await expect(service.getFeedbackAnalysis("fb-999")).rejects.toMatchObject({
        name: "DemoServiceError",
        code: "FEEDBACK_NOT_FOUND",
      });
    });

    it("rejects a malformed recorded analysis instead of returning it", async () => {
      const broken = await createReplayDemoService({
        ...defaultDemoData,
        analyses: { ...defaultDemoData.analyses, "fb-001": '{"sentiment":"amazing"}' },
      });

      await expect(broken.getFeedbackAnalysis("fb-001")).rejects.toThrow(ZodError);
    });
  });

  describe("listExampleQuestions", () => {
    it("lists each recorded question with its kind and note", () => {
      const examples = service.listExampleQuestions();

      expect(examples).toHaveLength(defaultDemoData.recordings.length);
      expect(examples[0]).toEqual({
        id: "workload-and-count",
        question: expect.any(String),
        kind: "genuine",
        note: expect.any(String),
      });
    });
  });

  describe("askQuestion", () => {
    it("returns a verified answer with the tool calls the agent made", async () => {
      const result = await service.askQuestion(
        "How many feedback comments are there, and what do employees say about workload?",
      );

      expect(result.outcome).toBe("verified");

      // The `if` narrows the union so TypeScript allows `result.answer`.
      if (result.outcome === "verified") {
        expect(result.answer.status).toBe("answered");
        expect(result.answer.numericalClaims).toEqual([
          { metric: "totalFeedback", operator: "eq", value: 24 },
        ]);
      }

      expect(result.toolCalls.map((call) => call.name)).toEqual([
        "getFeedbackStats",
        "searchFeedback",
      ]);
    });

    it("matches example questions regardless of case and spacing", async () => {
      const result = await service.askQuestion("  what do employees say   about their MANAGERS? ");

      expect(result.example.id).toBe("manager-views");
    });

    it("returns 'rejected' with a readable reason when grounding fails", async () => {
      const result = await service.askQuestion("How many feedback comments have been submitted?");

      expect(result).toMatchObject({
        outcome: "rejected",
        reason: "Numerical claim failed: totalFeedback eq 30 (actual value: 24).",
        example: { kind: "deliberately-faulty" },
      });
    });

    it("throws QUESTION_NOT_AVAILABLE for a question that wasn't recorded", async () => {
      const promise = service.askQuestion("What is the meaning of life?");

      await expect(promise).rejects.toBeInstanceOf(DemoServiceError);
      await expect(promise).rejects.toMatchObject({ code: "QUESTION_NOT_AVAILABLE" });
    });

    it("re-throws unexpected failures instead of reporting them as rejections", async () => {
      /*
       * A recording that ends without an answer is a bug, not a bad AI
       * answer, so it must NOT become a friendly "rejected" result.
       */
      const [first] = defaultDemoData.recordings;
      const broken = await createReplayDemoService({
        ...defaultDemoData,
        recordings: [{ ...first!, responses: first!.responses.slice(0, 1) }],
      });

      await expect(broken.askQuestion(first!.question)).rejects.toThrow(ReplayMismatchError);
    });

    it("handles concurrent questions independently", async () => {
      /*
       * Promise.all starts all three at once, so their tool calls
       * interleave on the event loop, just like three visitors asking at
       * the same moment. Each must still get its own correct answer and
       * its own tool-call list.
       */
      const [workload, managers, canteen] = await Promise.all([
        service.askQuestion(
          "How many feedback comments are there, and what do employees say about workload?",
        ),
        service.askQuestion("What do employees say about their managers?"),
        service.askQuestion("What do employees think about the canteen food?"),
      ]);

      expect(workload.example.id).toBe("workload-and-count");
      expect(workload.toolCalls).toHaveLength(2);

      expect(managers.example.id).toBe("manager-views");
      expect(managers.toolCalls).toHaveLength(1);

      expect(canteen.outcome === "verified" && canteen.answer.status).toBe("insufficient_evidence");
    });
  });

  describe("startup checks", () => {
    it("refuses to start if a comment has no recorded analysis", async () => {
      const { "fb-001": _removed, ...analyses } = defaultDemoData.analyses;

      await expect(createReplayDemoService({ ...defaultDemoData, analyses })).rejects.toThrow(
        "no recorded analysis for fb-001",
      );
    });

    it("refuses to start if a comment has no embedding", async () => {
      const { "fb-001": _removed, ...feedbackEmbeddings } = defaultDemoData.feedbackEmbeddings;

      await expect(
        createReplayDemoService({ ...defaultDemoData, feedbackEmbeddings }),
      ).rejects.toThrow("no embedding for fb-001");
    });
  });
});
