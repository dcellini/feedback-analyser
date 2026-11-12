import { Router, type RequestHandler } from "express";
import { z } from "zod";

import type { DemoService } from "../demo/demo-service.js";
import { HttpError } from "./http-errors.js";

/**
 * CHAPTER 8 — MILESTONE 2b: THE ROUTES
 *
 * A Router is a mini-app holding a group of routes. app.ts mounts it at
 * /api, so the paths here are relative to that:
 *
 *   router.get("/health")  →  GET /api/health
 *
 * Compare this file with route() in the native server. Each endpoint is
 * now one declaration: method + path + handler. Express handles the
 * matching, the URL parameters and (via express.json() in app.ts) the
 * body.
 *
 * The handlers are deliberately THIN: read the request, call the
 * service, send the result. All the real work lives in the demo service,
 * which knows nothing about HTTP.
 */

/**
 * The request body POST /api/questions accepts. Same rules as the native
 * server: 3–300 characters after trimming, no unexpected fields.
 */
const askQuestionBodySchema = z.strictObject({
  question: z.string().trim().min(3).max(300),
});

/**
 * ROUTE-LEVEL MIDDLEWARE: only accept JSON bodies.
 *
 * express.json() silently skips bodies that aren't JSON, leaving req.body
 * undefined. That would surface as a confusing "invalid request". This
 * check gives a precise 415 instead, matching the native server.
 *
 * It's passed to router.post() before the handler, so it runs only for
 * that route.
 */
const requireJsonBody: RequestHandler = (req, _res, next) => {
  if (!req.is("application/json")) {
    next(new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Request body must be JSON."));
    return;
  }

  next();
};

/**
 * Creates the API routes for a given service (dependency injection again:
 * tests can pass any DemoService).
 */
export const createApiRouter = (service: DemoService): Router => {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.get("/feedback", (_req, res) => {
    res.json({ feedback: service.listFeedback() });
  });

  /*
   * ":id" is a ROUTE PARAMETER. Express matches the segment, URL-decodes
   * it and puts it on req.params.id. (In the native server: a regex,
   * plus decodeURIComponent, plus a try/catch.)
   *
   * This handler is async. If getFeedbackAnalysis throws (e.g.
   * FEEDBACK_NOT_FOUND), Express 5 passes the error to errorHandler.
   * No try/catch needed here.
   */
  router.get("/feedback/:id/analysis", async (req, res) => {
    res.json({ analysis: await service.getFeedbackAnalysis(req.params.id) });
  });

  router.get("/questions/examples", (_req, res) => {
    res.json({ examples: service.listExampleQuestions() });
  });

  router.post("/questions", requireJsonBody, async (req, res) => {
    /*
     * req.body was parsed by express.json(), but its type is `any`: it
     * came from the network and could be anything. Zod turns it into
     * trusted, typed data, exactly as we do with Gemini's output.
     */
    const parsed = askQuestionBodySchema.safeParse(req.body);

    if (!parsed.success) {
      throw new HttpError(
        400,
        "INVALID_REQUEST",
        'Send JSON like { "question": "..." } with 3–300 characters.',
      );
    }

    res.json(await service.askQuestion(parsed.data.question));
  });

  return router;
};
