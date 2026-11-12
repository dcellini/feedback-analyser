import express, { type Express } from "express";

import type { DemoService } from "../demo/demo-service.js";
import { errorHandler, notFoundHandler } from "./http-errors.js";
import { requestLogger } from "./request-logger.js";
import { createApiRouter } from "./routes.js";

/**
 * CHAPTER 8 — MILESTONE 2b: THE EXPRESS APP
 *
 * This is the real API. The native server in src/server/learning/ is kept
 * for comparison: same endpoints, same responses, same tests.
 *
 * THE ORDER OF app.use() CALLS IS THE ORDER A REQUEST TRAVELS
 *
 *   Request
 *     ↓
 *   requestLogger        logs the outcome once the response is sent
 *     ↓
 *   express.json()       parses JSON bodies, enforces the 10 KB limit
 *     ↓
 *   /api router          the endpoints (routes.ts)
 *     ↓  (no route matched)
 *   notFoundHandler      turns "nothing matched" into a 404 error
 *     ↓  (any error, from anywhere above)
 *   errorHandler         one safe, consistent error response
 *
 * Getting the order wrong is a classic Express bug. For example, put
 * notFoundHandler BEFORE the router and every request becomes a 404.
 *
 * Like the native version, this only CREATES the app. start-server.ts
 * starts it, and tests use it without opening a port at all.
 */
export const createApp = (service: DemoService): Express => {
  const app = express();

  /*
   * Express adds an "X-Powered-By: Express" header by default. It tells
   * attackers which framework (and so which known vulnerabilities) to
   * try, and helps nobody else. Turn it off.
   */
  app.disable("x-powered-by");

  app.use(requestLogger);

  /*
   * Parse JSON bodies up to 10 KB. Larger bodies are rejected with an
   * error of type "entity.too.large", and invalid JSON with
   * "entity.parse.failed". errorHandler converts both into our format.
   *
   * NATIVE EQUIVALENT: the whole of readJsonBody().
   */
  app.use(express.json({ limit: "10kb" }));

  app.use("/api", createApiRouter(service));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
