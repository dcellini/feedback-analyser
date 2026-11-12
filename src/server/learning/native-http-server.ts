import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { z } from "zod";

import { DemoServiceError, type DemoService } from "../../demo/demo-service.js";

/**
 * CHAPTER 8 — MILESTONE 2a: A SERVER WITH NO FRAMEWORK
 *
 * ⚠️ THIS IS A LEARNING EXERCISE, NOT THE REAL API.
 *
 * The real API (Milestone 2b) uses Express. This file builds the same
 * kind of API using only Node's built-in `node:http` module, so you can
 * see every job a framework does for you:
 *
 *   1. ROUTING          — which code runs for which method + URL?
 *   2. URL PARAMETERS   — pulling "fb-003" out of /api/feedback/fb-003/analysis
 *   3. BODY PARSING     — the request body arrives as a stream of chunks
 *   4. SIZE LIMITS      — stopping someone sending us a 2 GB body
 *   5. VALIDATION       — Zod, as in Chapters 1–7
 *   6. ERROR HANDLING   — so one bad request can't crash the process
 *   7. LOGGING          — method, path, status and duration per request
 *
 * When you read the Express version later, each of these becomes one or
 * two lines. Look out for the "EXPRESS EQUIVALENT" notes.
 *
 * ENDPOINTS
 *
 *   GET  /api/health                    → { status: "ok" }
 *   GET  /api/feedback                  → { feedback: [...] }
 *   GET  /api/feedback/:id/analysis     → { analysis: {...} }
 *   GET  /api/questions/examples        → { examples: [...] }
 *   POST /api/questions   { question }  → the demo service's QuestionResult
 *
 * Every error uses the same shape, so the frontend can handle them all
 * the same way:
 *
 *   { "error": { "code": "NOT_FOUND", "message": "..." } }
 */

/**
 * Maximum request body size, in bytes.
 *
 * A question is at most 300 characters, so 10 KB is generous. Without a
 * limit, a client could send an enormous body and exhaust our memory,
 * because we hold the whole body in memory before parsing it.
 */
const MAX_BODY_BYTES = 10_000;

/**
 * The request body POST /api/questions accepts.
 *
 * `.trim()` runs before the length checks, so "   " counts as empty.
 * The 300-character limit is also a cost control for a future live mode:
 * longer questions mean more AI tokens.
 */
const askQuestionBodySchema = z.strictObject({
  question: z.string().trim().min(3).max(300),
});

/**
 * An error we raise on purpose, with an HTTP status and a safe message.
 *
 * "Safe" means it's fine for the visitor to see. Messages from unexpected
 * errors (which can contain file paths, stack traces or internal details)
 * are never sent to the client.
 */
class HttpError extends Error {
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
 * Writes a JSON response.
 *
 * In node:http, a response is built in three steps:
 *
 *   res.statusCode = 200;                              // status line
 *   res.setHeader("Content-Type", "application/json"); // headers
 *   res.end('{"status":"ok"}');                        // body, then finish
 *
 * Headers must be set BEFORE the body is written: once body bytes go out
 * on the network, the headers have already been sent.
 *
 * EXPRESS EQUIVALENT: res.status(200).json(body)
 */
const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  const json = JSON.stringify(body);

  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  // Content-Length counts BYTES, not characters: "é" is 1 character but 2 bytes.
  res.setHeader("Content-Length", Buffer.byteLength(json));
  res.end(json);
};

/**
 * Reads and parses a JSON request body.
 *
 * WHY IS THIS SO MUCH WORK?
 *
 * `req` is a READABLE STREAM. The body doesn't arrive as one string; it
 * arrives as a series of Buffer chunks, at whatever speed the network
 * delivers them. A 10 KB body might arrive in one chunk or in ten.
 *
 *   for await (const chunk of req)   ← waits for each chunk in turn
 *
 * We have to collect the chunks, enforce our size limit as they arrive,
 * join them, decode the bytes as UTF-8 text, then parse the JSON.
 *
 * EXPRESS EQUIVALENT: app.use(express.json({ limit: "10kb" }))
 */
const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  /*
   * CHECK 1 — CONTENT TYPE
   *
   * We only accept JSON. 415 means "Unsupported Media Type".
   * The header can include extras, e.g. "application/json; charset=utf-8".
   */
  const contentType = req.headers["content-type"] ?? "";

  if (!contentType.startsWith("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Request body must be JSON.");
  }

  /*
   * CHECK 2 — DECLARED SIZE
   *
   * Clients usually send a Content-Length header. If it already exceeds
   * our limit, we can refuse before reading a single byte.
   * 413 means "Content Too Large".
   */
  const declaredLength = Number(req.headers["content-length"] ?? 0);

  if (declaredLength > MAX_BODY_BYTES) {
    throw new HttpError(413, "BODY_TOO_LARGE", "Request body is too large.");
  }

  /*
   * CHECK 3 — ACTUAL SIZE, WHILE READING
   *
   * Content-Length is optional, and a client could lie about it, so we
   * also count the bytes as they really arrive.
   */
  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunk of req as AsyncIterable<Buffer>) {
    receivedBytes += chunk.length;

    if (receivedBytes > MAX_BODY_BYTES) {
      throw new HttpError(413, "BODY_TOO_LARGE", "Request body is too large.");
    }

    chunks.push(chunk);
  }

  /*
   * Join the chunks and decode them as text.
   *
   * We must join BEFORE decoding: a multi-byte character such as "é" can
   * be split across two chunks, and decoding each half separately would
   * corrupt it.
   */
  const text = Buffer.concat(chunks).toString("utf8");

  /*
   * JSON.parse throws a SyntaxError on invalid JSON. Turn that into a 400
   * error rather than letting it look like a server bug (500).
   */
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON.");
  }
};

/**
 * Converts the demo service's error codes into HTTP statuses.
 *
 * This is the "translation" step described in Milestone 1: the service
 * says WHAT went wrong; the HTTP layer decides HOW to report it.
 */
const toHttpError = (error: DemoServiceError): HttpError => {
  switch (error.code) {
    case "FEEDBACK_NOT_FOUND":
      return new HttpError(404, error.code, error.message);

    case "QUESTION_NOT_AVAILABLE":
      // 422 = the request was well-formed, but we can't process this content.
      return new HttpError(422, error.code, error.message);
  }
};

/**
 * Pattern for /api/feedback/<id>/analysis.
 *
 * `([^/]+)` captures one path segment (anything except "/").
 *
 * EXPRESS EQUIVALENT: app.get("/api/feedback/:id/analysis", ...)
 * and then req.params.id
 */
const ANALYSIS_PATH = /^\/api\/feedback\/([^/]+)\/analysis$/;

/**
 * The ROUTER: decides which code handles a request.
 *
 * Without a framework, routing is just `if` statements comparing the
 * method and path. It works, but notice how it grows with every endpoint,
 * and how easy it would be to get the order or a regex slightly wrong.
 */
const route = async (
  req: IncomingMessage,
  res: ServerResponse,
  service: DemoService,
): Promise<void> => {
  /*
   * req.url is only the path and query string, e.g. "/api/feedback?page=2".
   * The URL class needs a full URL to parse, so we give it a dummy base.
   * `pathname` is then "/api/feedback" without the query string.
   */
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";

  if (method === "GET" && pathname === "/api/health") {
    sendJson(res, 200, { status: "ok" });
    return;
  }

  if (method === "GET" && pathname === "/api/feedback") {
    sendJson(res, 200, { feedback: service.listFeedback() });
    return;
  }

  const analysisMatch = method === "GET" ? ANALYSIS_PATH.exec(pathname) : null;

  if (analysisMatch) {
    /*
     * Path segments arrive URL-encoded (a space is "%20"), so decode it.
     * decodeURIComponent throws on malformed input such as "%E0%A4%A",
     * so treat that as a bad request rather than a server error.
     */
    let id: string;

    try {
      id = decodeURIComponent(analysisMatch[1]!);
    } catch {
      throw new HttpError(400, "INVALID_REQUEST", "The feedback ID is not valid.");
    }

    sendJson(res, 200, { analysis: await service.getFeedbackAnalysis(id) });
    return;
  }

  if (method === "GET" && pathname === "/api/questions/examples") {
    sendJson(res, 200, { examples: service.listExampleQuestions() });
    return;
  }

  if (method === "POST" && pathname === "/api/questions") {
    const body = await readJsonBody(req);

    /*
     * Validate with Zod. safeParse() returns { success, data | error }
     * instead of throwing, so we can choose our own error response.
     */
    const parsed = askQuestionBodySchema.safeParse(body);

    if (!parsed.success) {
      throw new HttpError(
        400,
        "INVALID_REQUEST",
        'Send JSON like { "question": "..." } with 3–300 characters.',
      );
    }

    sendJson(res, 200, await service.askQuestion(parsed.data.question));
    return;
  }

  /*
   * Nothing matched. (A fuller server would return 405 Method Not Allowed
   * for a known path with the wrong method, e.g. DELETE /api/health.
   * Express doesn't do that by default either.)
   */
  throw new HttpError(404, "NOT_FOUND", `No route for ${method} ${pathname}.`);
};

/**
 * Creates the server, without starting it.
 *
 * WHY NOT CALL listen() HERE?
 *
 * Separating "create" from "start" lets the tests start it on a random
 * free port (port 0), and lets start-native-server.ts decide the real
 * port from configuration. The service is passed in (dependency
 * injection), so tests could also supply a different one.
 */
export const createNativeServer = (service: DemoService): Server =>
  /*
   * createServer() takes ONE function, called for EVERY request.
   * Node gives it:
   *   req — the incoming request (a readable stream, plus method/url/headers)
   *   res — the response we build (a writable stream)
   */
  createServer(async (req, res) => {
    const startedAt = performance.now();

    /*
     * REQUEST LOGGING
     *
     * "finish" fires once the response has been fully handed to the
     * network. Registering the listener FIRST means every request is
     * logged, whichever route handles it and whether or not it fails.
     *
     * We log the method, path and status, but never request bodies,
     * which may contain personal data.
     *
     * EXPRESS EQUIVALENT: a logging middleware registered first.
     */
    res.on("finish", () => {
      const durationMs = Math.round(performance.now() - startedAt);
      console.log(`${req.method} ${req.url} → ${res.statusCode} (${durationMs}ms)`);
    });

    /*
     * ERROR HANDLING
     *
     * This function is async. If anything inside throws and we don't
     * catch it, the returned promise rejects, and Node doesn't handle
     * rejections from request listeners for us. That's an UNHANDLED
     * REJECTION, which crashes the entire process: every visitor's
     * request would fail, not just this one.
     *
     * So everything goes through one try/catch.
     *
     * EXPRESS EQUIVALENT: the error-handling middleware,
     * app.use((error, req, res, next) => { ... })
     */
    try {
      await route(req, res, service);
    } catch (error) {
      // Errors we raised on purpose: their message is safe to show.
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: { code: error.code, message: error.message } });
        return;
      }

      // The service's expected errors: translate to an HTTP status.
      if (error instanceof DemoServiceError) {
        const httpError = toHttpError(error);
        sendJson(res, httpError.status, {
          error: { code: httpError.code, message: httpError.message },
        });
        return;
      }

      /*
       * Anything else is unexpected. Log the details on the SERVER, where
       * only we can see them, and give the client a generic message.
       */
      console.error("Unexpected error handling request:", error);

      /*
       * If the response has already started (headers sent), we can't
       * change its status any more. The best we can do is end it.
       */
      if (res.headersSent) {
        res.end();
        return;
      }

      sendJson(res, 500, {
        error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      });
    }
  });
