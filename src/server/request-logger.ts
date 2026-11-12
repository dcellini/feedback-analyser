import type { RequestHandler } from "express";

/**
 * CHAPTER 8 — MILESTONE 2b: OUR FIRST MIDDLEWARE
 *
 * Middleware is a function that runs for a request BEFORE (or around) the
 * route handler. It receives three arguments:
 *
 *   req  — the request
 *   res  — the response
 *   next — call this to pass the request on to the next middleware
 *
 * A middleware must either SEND A RESPONSE or CALL next(). If it does
 * neither, the request hangs until the client gives up.
 *
 * This one calls next() straight away, so the request carries on, but
 * first it registers a listener that logs the outcome once the response
 * has been sent.
 *
 * NATIVE EQUIVALENT: res.on("finish", ...) at the top of the request
 * listener in createNativeServer.
 *
 * We log the method, path, status and duration, but never request bodies
 * or headers, which may contain personal data or credentials.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = performance.now();

  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${durationMs}ms)`);
  });

  next();
};
