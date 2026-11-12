
import { describe, expect, it, vi } from "vitest";

import {
  GeminiApiError,
  requestGemini,
} from "./gemini-api-client.js";

/**
 * CHAPTER 7 — GEMINI API CLIENT TESTS
 *
 * These tests use mocked fetch responses.
 *
 * They make NO real Gemini API requests.
 *
 * retryDelayMs: 0 keeps retry tests fast.
 */

const url = "https://example.com/gemini";
const apiKey = "test-api-key";
const requestBody = {
  contents: [
    {
      role: "user",
      parts: [{ text: "Hello" }],
    },
  ],
};

/**
 * Creates a realistic HTTP response without
 * needing an actual network connection.
 */
const createResponse = (
  status: number,
  body: unknown = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

describe("requestGemini", () => {
  it("returns JSON from a successful request", async () => {
    const expected = {
      candidates: [{ content: { parts: [{ text: "Hello" }] } }],
    };

    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse(200, expected),
    );

    const result = await requestGemini(
      url,
      apiKey,
      requestBody,
      { fetchFn },
    );

    expect(result).toEqual(expected);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries a temporary 503 and succeeds", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createResponse(503))
      .mockResolvedValueOnce(createResponse(200, { ok: true }));

    const result = await requestGemini(
      url,
      apiKey,
      requestBody,
      { fetchFn, retryDelayMs: 0 },
    );

    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("retries a 429 rate limit response", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(createResponse(429))
      .mockResolvedValueOnce(createResponse(200, { ok: true }));

    const result = await requestGemini(
      url,
      apiKey,
      requestBody,
      { fetchFn, retryDelayMs: 0 },
    );

    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent 401 error", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse(401),
    );

    await expect(
      requestGemini(url, apiKey, requestBody, {
        fetchFn,
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({
      code: "http_error",
      status: 401,
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("stops after the configured retry limit", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      createResponse(503),
    );

    await expect(
      requestGemini(url, apiKey, requestBody, {
        fetchFn,
        maxRetries: 2,
        retryDelayMs: 0,
      }),
    ).rejects.toMatchObject({
      code: "unavailable",
      status: 503,
    });

    // One initial request plus two retries.
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("rejects invalid response JSON", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("not valid JSON", { status: 200 }),
    );

    await expect(
      requestGemini(url, apiKey, requestBody, {
        fetchFn,
      }),
    ).rejects.toMatchObject({
      code: "invalid_response",
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries network failures before giving up", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(
      new TypeError("Network unavailable"),
    );

    await expect(
      requestGemini(url, apiKey, requestBody, {
        fetchFn,
        maxRetries: 2,
        retryDelayMs: 0,
      }),
    ).rejects.toBeInstanceOf(GeminiApiError);

    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it("reports network failures using a safe error code", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(
      new TypeError("Sensitive internal network details"),
    );

    await expect(
      requestGemini(url, apiKey, requestBody, {
        fetchFn,
        maxRetries: 0,
      }),
    ).rejects.toMatchObject({
      code: "network_error",
      message: "Unable to connect to Gemini.",
    });
  });


it("times out a slow request and retries", async () => {
  /**
   * Simulate a fetch request that never completes
   * unless its AbortSignal is triggered.
   *
   * This tests actual cancellation rather than
   * simply throwing a fake timeout error.
   */
  const fetchFn = vi.fn<typeof fetch>(
    async (_url, options) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = options?.signal;

        if (!signal) {
          reject(new Error("Expected an AbortSignal."));
          return;
        }

        const abort = () => {
          reject(
            signal.reason ??
              new DOMException(
                "Request aborted",
                "AbortError",
              ),
          );
        };

        if (signal.aborted) {
          abort();
        } else {
          signal.addEventListener("abort", abort, {
            once: true,
          });
        }
      });
    },
  );

  await expect(
    requestGemini(url, apiKey, requestBody, {
      fetchFn,
      timeoutMs: 20,
      maxRetries: 1,
      retryDelayMs: 0,
    }),
  ).rejects.toMatchObject({
    code: "timeout",
    message: "Gemini request timed out.",
  });

  // Initial attempt + one retry.
  expect(fetchFn).toHaveBeenCalledTimes(2);
});

});
