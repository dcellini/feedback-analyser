import type { ErrorRequestHandler, RequestHandler } from "express";

import { DemoServiceError } from "../demo/demo-service.js";

/**
 * CHAPTER 8 — MILESTONE 2b: ERRORS IN EXPRESS
 *
 * Compare with the native server (src/server/learning/native-http-server.ts),
 * where error handling was one big try/catch inside the request listener.
 *
 * In Express, errors flow to ERROR-HANDLING MIDDLEWARE: a function with
 * FOUR parameters (error, req, res, next). Express recognises it by that
 * parameter count, so it must declare all four, even unused ones.
 *
 * How does an error reach it?
 *
 *   - Throwing inside a route handler, sync or async. (Express 5 catches
 *     rejected promises from async handlers. Express 4 did NOT, which
 *     crashed many servers.)
 *   - Calling next(error) from middleware.
 *   - Express's own body parser, e.g. for invalid JSON.
 *
 * Every error response uses the same shape as the native server, so the
 * frontend works with either:
 *
 *   { "error": { "code": "NOT_FOUND", "message": "..." } }
 */

/**
 * An error we raise on purpose, with an HTTP status and a message that's
 * safe to show the visitor. (Same idea as the native server's HttpError.)
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Translates the demo service's error codes into HTTP statuses.
 *
 * The service says WHAT went wrong; this layer decides HOW to report it.
 * `Record<DemoServiceError["code"], ...>` makes TypeScript insist that
 * every service error code has a status here.
 */
const serviceErrorStatus: Record<DemoServiceError["code"], number> = {
  FEEDBACK_NOT_FOUND: 404,
  QUESTION_NOT_AVAILABLE: 422,
};

/**
 * Errors from Express's JSON body parser carry a `type` field.
 * We convert the two we expect into our own error format.
 */
const bodyParserErrors: Record<string, HttpError> = {
  "entity.parse.failed": new HttpError(400, "INVALID_JSON", "Request body is not valid JSON."),
  "entity.too.large": new HttpError(413, "BODY_TOO_LARGE", "Request body is too large."),
};

const getBodyParserError = (error: unknown): HttpError | undefined => {
  if (typeof error === "object" && error !== null && "type" in error && typeof error.type === "string") {
    return bodyParserErrors[error.type];
  }

  return undefined;
};

/**
 * Converts any thrown value into a status and a SAFE response body.
 */
const toErrorResponse = (error: unknown): { status: number; code: string; message: string } => {
  if (error instanceof HttpError) {
    return { status: error.status, code: error.code, message: error.message };
  }

  if (error instanceof DemoServiceError) {
    return { status: serviceErrorStatus[error.code], code: error.code, message: error.message };
  }

  const bodyParserError = getBodyParserError(error);

  if (bodyParserError) {
    return {
      status: bodyParserError.status,
      code: bodyParserError.code,
      message: bodyParserError.message,
    };
  }

  /*
   * Anything else is unexpected: log the details on the server only, and
   * send a generic message. Internal messages can contain file paths,
   * library details or worse, and must never reach the client.
   */
  console.error("Unexpected error handling request:", error);

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Something went wrong. Please try again.",
  };
};

/**
 * The error-handling middleware. Registered LAST in app.ts, so it
 * receives errors from every route and middleware before it.
 *
 * NATIVE EQUIVALENT: the catch block in createNativeServer.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  /*
   * If the response has already started, we can't change its status.
   * Hand over to Express's default handler, which closes the connection.
   */
  if (res.headersSent) {
    next(error);
    return;
  }

  const { status, code, message } = toErrorResponse(error);
  res.status(status).json({ error: { code, message } });
};

/**
 * Runs when no route matched. Registered after all the routes, so a
 * request only reaches it if nothing earlier sent a response.
 *
 * NATIVE EQUIVALENT: the final `throw new HttpError(404, ...)` in route().
 */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, "NOT_FOUND", `No route for ${req.method} ${req.path}.`));
};
