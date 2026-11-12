import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createReplayDemoService } from "../../demo/demo-service.js";
import { createNativeServer } from "./native-http-server.js";

/**
 * CHAPTER 8 — MILESTONE 2a: NATIVE SERVER TESTS
 *
 * HOW DO YOU TEST A SERVER WITHOUT A FRAMEWORK?
 *
 * You start a real one and send it real HTTP requests:
 *
 *   1. listen(0)  → port 0 asks the operating system for ANY free port,
 *                   so tests never clash with something on port 3000.
 *   2. read the port the OS actually chose from server.address().
 *   3. use fetch() (built into Node) to make requests.
 *   4. close the server afterwards.
 *
 * This is genuine end-to-end HTTP, which is nice, but it's slower and
 * needs this set-up code. In Milestone 2b, the `supertest` library does
 * all of this for Express in one line.
 */
describe("native learning server", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Keep test output tidy: the server logs every request.
    vi.spyOn(console, "log").mockImplementation(() => {});

    server = createNativeServer(await createReplayDemoService());

    /*
     * listen() reports success with a callback, so we wrap it in a
     * Promise to be able to `await` it.
     */
    await new Promise<void>((resolve) => server.listen(0, resolve));

    const { port } = server.address() as AddressInfo;
    baseUrl = `http://localhost:${port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    vi.restoreAllMocks();
  });

  /** Sends a POST with a JSON body. */
  const postJson = (path: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("GET /api/health returns ok", async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("GET /api/feedback lists redacted feedback", async () => {
    const response = await fetch(`${baseUrl}/api/feedback`);
    const body = await response.json();

    expect(body.feedback).toHaveLength(24);
    expect(JSON.stringify(body)).not.toContain("sam.taylor@example.com");
  });

  it("GET /api/feedback/:id/analysis returns an analysis", async () => {
    const response = await fetch(`${baseUrl}/api/feedback/fb-003/analysis`);

    expect(response.status).toBe(200);
    expect((await response.json()).analysis.priority).toBe("high");
  });

  it("returns 404 FEEDBACK_NOT_FOUND for an unknown feedback ID", async () => {
    const response = await fetch(`${baseUrl}/api/feedback/fb-999/analysis`);

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("FEEDBACK_NOT_FOUND");
  });

  it("GET /api/questions/examples lists the example questions", async () => {
    const response = await fetch(`${baseUrl}/api/questions/examples`);

    expect((await response.json()).examples).toHaveLength(6);
  });

  it("POST /api/questions returns the demo service result", async () => {
    const response = await postJson("/api/questions", {
      question: "What do employees think about the canteen food?",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.outcome).toBe("verified");
    expect(body.answer.status).toBe("insufficient_evidence");
  });

  it("returns 422 for a question the demo can't answer", async () => {
    const response = await postJson("/api/questions", { question: "What is the weather like?" });

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("QUESTION_NOT_AVAILABLE");
  });

  it.each([
    ["a missing question", {}],
    ["a question that is too short", { question: "Hi" }],
    ["a question that is too long", { question: "a".repeat(301) }],
    ["unexpected extra fields", { question: "What about pay?", admin: true }],
  ])("returns 400 INVALID_REQUEST for %s", async (_description, body) => {
    const response = await postJson("/api/questions", body);

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_REQUEST");
  });

  it("returns 400 INVALID_JSON for malformed JSON", async () => {
    const response = await postJson("/api/questions", "{not json");

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("INVALID_JSON");
  });

  it("returns 415 when the body isn't JSON", async () => {
    const response = await fetch(`${baseUrl}/api/questions`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "question=hello",
    });

    expect(response.status).toBe(415);
  });

  it("returns 413 when the body is too large", async () => {
    const response = await postJson("/api/questions", { question: "a".repeat(20_000) });

    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("BODY_TOO_LARGE");
  });

  it("returns 404 NOT_FOUND for unknown routes", async () => {
    const response = await fetch(`${baseUrl}/api/does-not-exist`);

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
  });

  it("returns a generic 500 for unexpected errors, without leaking details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    // A service whose method throws an unexpected error.
    const service = await createReplayDemoService();
    service.listFeedback = () => {
      throw new Error("database password is hunter2");
    };

    const failing = createNativeServer(service);
    await new Promise<void>((resolve) => failing.listen(0, resolve));
    const { port } = failing.address() as AddressInfo;

    const response = await fetch(`http://localhost:${port}/api/feedback`);
    const text = await response.text();

    await new Promise((resolve) => failing.close(resolve));

    expect(response.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain("hunter2");
  });
});
