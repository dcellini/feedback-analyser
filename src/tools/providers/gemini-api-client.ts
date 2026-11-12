
/**
 * CHAPTER 7 — GEMINI API ERROR HANDLING
 *
 * PURPOSE:
 * Provide reliable HTTP communication with Gemini.
 *
 * RESPONSIBILITIES:
 * - Timeout slow requests.
 * - Retry temporary failures.
 * - Avoid retrying permanent failures.
 * - Return safe, categorised errors.
 *
 * The rest of our application does not need
 * to understand these HTTP details.
 */

/**
 * Categorised provider errors.
 *
 * Using a custom Error class lets callers
 * distinguish failure types without parsing
 * error message strings.
 */
export type GeminiApiErrorCode =
  | "timeout"
  | "rate_limit"
  | "unavailable"
  | "http_error"
  | "network_error"
  | "invalid_response";

export class GeminiApiError extends Error {
  constructor(
    public readonly code: GeminiApiErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GeminiApiError";
  }
}

/**
 * Settings are configurable so tests can use
 * short delays without waiting several seconds.
 */
export interface GeminiApiClientOptions {
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  fetchFn?: typeof fetch;
}

const RETRYABLE_STATUSES = new Set([
  429, 500, 502, 503, 504,
]);

/**
 * Convert HTTP failures into safe errors.
 *
 * We deliberately avoid including the raw
 * response body, which could contain sensitive
 * information.
 */
const createHttpError = (
  status: number,
): GeminiApiError => {
  if (status === 429) {
    return new GeminiApiError(
      "rate_limit",
      "Gemini rate limit exceeded.",
      status,
    );
  }

  if (status >= 500) {
    return new GeminiApiError(
      "unavailable",
      "Gemini service is temporarily unavailable.",
      status,
    );
  }

  return new GeminiApiError(
    "http_error",
    `Gemini request failed with HTTP ${status}.`,
    status,
  );
};

/**
 * Exponential backoff:
 *
 * Retry 1: 500ms
 * Retry 2: 1000ms
 *
 * This reduces pressure on a service that
 * may already be overloaded.
 */
const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/**
 * Read Retry-After when Gemini supplies it.
 *
 * Supports seconds and HTTP dates.
 * Caps the delay at 30 seconds.
 */
const getRetryDelay = (
  response: Response,
  fallbackMs: number,
): number => {
  const header = response.headers.get("Retry-After");

  if (!header) {
    return fallbackMs;
  }

  const seconds = Number(header);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 30_000);
  }

  const date = Date.parse(header);

  if (!Number.isNaN(date)) {
    return Math.min(
      Math.max(date - Date.now(), 0),
      30_000,
    );
  }

  return fallbackMs;
};

/**
 * Send a Gemini API request with bounded retries.
 *
 * maxRetries: 2 means:
 * - 1 initial attempt
 * - Up to 2 additional attempts
 *
 * JSON is returned as unknown because the caller
 * must validate the response structure.
 */
export const requestGemini = async (
  url: string,
  apiKey: string,
  body: unknown,
  options: GeminiApiClientOptions = {},
): Promise<unknown> => {
  const {
    timeoutMs = 30_000,
    maxRetries = 2,
    retryDelayMs = 500,
    fetchFn = fetch,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response;

    try {
      response = await fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const isTimeout =
        error instanceof Error &&
        (error.name === "TimeoutError" ||
          error.name === "AbortError");

      const providerError = new GeminiApiError(
        isTimeout ? "timeout" : "network_error",
        isTimeout
          ? "Gemini request timed out."
          : "Unable to connect to Gemini.",
      );

      // Retry transient network errors and timeouts.
      if (attempt < maxRetries) {
        await wait(retryDelayMs * 2 ** attempt);
        continue;
      }

      throw providerError;
    }

    if (!response.ok) {
      const providerError = createHttpError(
        response.status,
      );

      if (
        RETRYABLE_STATUSES.has(response.status) &&
        attempt < maxRetries
      ) {
        await wait(
          getRetryDelay(
            response,
            retryDelayMs * 2 ** attempt,
          ),
        );

        continue;
      }

      throw providerError;
    }

    try {
      return await response.json();
    } catch {
      throw new GeminiApiError(
        "invalid_response",
        "Gemini returned invalid response JSON.",
      );
    }
  }

  // The loop should always return or throw.
  throw new GeminiApiError(
    "unavailable",
    "Gemini request failed after retries.",
  );
};
