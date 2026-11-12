import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createReplayDemoService, type DemoService } from "../demo/demo-service.js";
import { createApp } from "./app.js";

/**
 * CHAPTER 8 — MILESTONE 2b: EXPRESS API TESTS
 *
 * These check the same behaviour as the native server's tests, so the two
 * servers are provably interchangeable for the frontend.
 *
 * WHAT'S DIFFERENT?
 *
 * No listen(0), no port lookup, no close(). supertest takes the Express
 * app, starts it on a temporary port behind the scenes, sends the request,
 * and gives back the response:
 *
 *   await request(app).get("/api/health").expect(200);
 *
 * Compare this file's set-up with native-http-server.test.ts.
 */
describe("Express API", () => {
  let service: DemoService;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    service = await createReplayDemoService();
    app = createApp(service);
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it("GET /api/health returns ok", async () => {
    const response = await request(app).get("/api/health").expect(200);

    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.body).toEqual({ status: "ok" });
  });

  it("doesn't advertise the framework in an X-Powered-By header", async () => {
    const response = await request(app).get("/api/health");

    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("GET /api/feedback lists redacted feedback", async () => {
    const response = await request(app).get("/api/feedback").expect(200);

    expect(response.body.feedback).toHaveLength(24);
    expect(JSON.stringify(response.body)).not.toContain("sam.taylor@example.com");
  });

  it("GET /api/feedback/:id/analysis returns an analysis", async () => {
    const response = await request(app).get("/api/feedback/fb-003/analysis").expect(200);

    expect(response.body.analysis.priority).toBe("high");
  });

  it("returns 404 FEEDBACK_NOT_FOUND for an unknown feedback ID", async () => {
    const response = await request(app).get("/api/feedback/fb-999/analysis").expect(404);

    expect(response.body.error.code).toBe("FEEDBACK_NOT_FOUND");
  });

  it("GET /api/questions/examples lists the example questions", async () => {
    const response = await request(app).get("/api/questions/examples").expect(200);

    expect(response.body.examples).toHaveLength(6);
  });

  it("POST /api/questions returns a verified answer", async () => {
    const response = await request(app)
      .post("/api/questions")
      .send({ question: "What do employees think about the canteen food?" })
      .expect(200);

    expect(response.body.outcome).toBe("verified");
    expect(response.body.answer.status).toBe("insufficient_evidence");
  });

  it("POST /api/questions returns 200 with outcome 'rejected' for a faulty answer", async () => {
    const response = await request(app)
      .post("/api/questions")
      .send({ question: "How many feedback comments have been submitted?" })
      .expect(200);

    expect(response.body.outcome).toBe("rejected");
  });

  it("returns 422 for a question the demo can't answer", async () => {
    const response = await request(app)
      .post("/api/questions")
      .send({ question: "What is the weather like?" })
      .expect(422);

    expect(response.body.error.code).toBe("QUESTION_NOT_AVAILABLE");
  });

  it.each([
    ["a missing question", {}],
    ["a question that is too short", { question: "Hi" }],
    ["a question that is too long", { question: "a".repeat(301) }],
    ["unexpected extra fields", { question: "What about pay?", admin: true }],
    ["a JSON array instead of an object", ["What about pay?"]],
  ])("returns 400 INVALID_REQUEST for %s", async (_description, body) => {
    const response = await request(app).post("/api/questions").send(body).expect(400);

    expect(response.body.error.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 INVALID_JSON for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/questions")
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);

    expect(response.body.error.code).toBe("INVALID_JSON");
  });

  it("returns 415 when the body isn't JSON", async () => {
    const response = await request(app)
      .post("/api/questions")
      .set("Content-Type", "text/plain")
      .send("question=hello")
      .expect(415);

    expect(response.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("returns 413 when the body is too large", async () => {
    const response = await request(app)
      .post("/api/questions")
      .send({ question: "a".repeat(20_000) })
      .expect(413);

    expect(response.body.error.code).toBe("BODY_TOO_LARGE");
  });

  it("returns 404 NOT_FOUND for unknown routes", async () => {
    const response = await request(app).get("/api/does-not-exist").expect(404);

    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("returns a generic 500 for unexpected errors, without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const failingService: DemoService = {
      ...service,
      listFeedback: () => {
        throw new Error("database password is hunter2");
      },
    };

    const response = await request(createApp(failingService)).get("/api/feedback").expect(500);

    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });

  it("catches errors thrown by async handlers (an Express 5 feature)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const failingService: DemoService = {
      ...service,
      getFeedbackAnalysis: async () => {
        throw new Error("upstream timeout");
      },
    };

    await request(createApp(failingService)).get("/api/feedback/fb-001/analysis").expect(500);
  });
});
