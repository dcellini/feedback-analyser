import type {
  ApiErrorBody,
  ExampleQuestionsResponse,
  FeedbackAnalysisResponse,
  FeedbackListResponse,
  QuestionResult,
} from "./types";

/**
 * CHAPTER 9 — API CLIENT
 *
 * The ONLY file in the frontend that knows about URLs, HTTP methods and
 * status codes. Components call friendly functions instead:
 *
 *   const { feedback } = await api.listFeedback();
 *
 * WHY A SEPARATE CLIENT?
 *
 * The same reason the backend has a service layer: components shouldn't
 * care HOW data arrives. If the API moves, gains authentication or adds
 * a header, this is the only file that changes.
 *
 * ERRORS
 *
 * fetch() only rejects on NETWORK failures (offline, DNS, connection
 * refused). A 404 or 500 is still a "successful" fetch, with
 * response.ok === false. A common bug is forgetting to check that.
 *
 * So this client turns every failure into one error type, ApiError, with
 * a `code` the UI can switch on and a `message` it can show.
 */

/**
 * Relative URL: in development the Vite proxy forwards /api to the Node
 * server; in production CloudFront will route /api to the backend.
 */
const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Narrows unknown JSON to our error shape.
 *
 * A TYPE GUARD: the return type `body is ApiErrorBody` tells TypeScript
 * that, when this returns true, `body` can be treated as ApiErrorBody.
 */
const isApiErrorBody = (body: unknown): body is ApiErrorBody =>
  typeof body === "object" &&
  body !== null &&
  "error" in body &&
  typeof (body as ApiErrorBody).error?.code === "string";

/**
 * Sends a request and returns the parsed JSON body.
 *
 * `signal` lets a component CANCEL a request it no longer needs (for
 * example, if it unmounts before the response arrives).
 */
const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...init.headers },
    });
  } catch (error) {
    // A cancelled request isn't a failure the user needs to hear about.
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError("NETWORK_ERROR", "Couldn't reach the server. Check your connection.");
  }

  /*
   * Parse the body whatever the status, because error responses carry
   * useful JSON too. If the body isn't JSON at all (e.g. an HTML error
   * page from a proxy), fall back to null.
   */
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(body.error.code, body.error.message, response.status);
    }

    throw new ApiError("UNEXPECTED_RESPONSE", "The server returned an unexpected error.", response.status);
  }

  /*
   * We trust the shape here because the types come from the backend code
   * and the backend is ours. (For a third-party API we'd validate with
   * Zod, as the backend does with Gemini.)
   */
  return body as T;
};

export const api = {
  listFeedback: (signal?: AbortSignal) =>
    request<FeedbackListResponse>("/feedback", signal ? { signal } : {}),

  getFeedbackAnalysis: (id: string, signal?: AbortSignal) =>
    request<FeedbackAnalysisResponse>(
      `/feedback/${encodeURIComponent(id)}/analysis`,
      signal ? { signal } : {},
    ),

  listExampleQuestions: (signal?: AbortSignal) =>
    request<ExampleQuestionsResponse>("/questions/examples", signal ? { signal } : {}),

  askQuestion: (question: string, signal?: AbortSignal) =>
    request<QuestionResult>("/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      ...(signal ? { signal } : {}),
    }),
};
