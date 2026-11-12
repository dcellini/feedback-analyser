import iconv from "iconv-lite";

import type { DemoService } from "../demo/demo-service.js";

/**
 * CHAPTER 8 — DEPLOYMENT: WARMING UP AT STARTUP
 *
 * WHY DOES THIS EXIST?
 *
 * Cloudflare's free plan allows 10 ms of CPU time per request. Measured
 * on the server side, a warm request uses about 1 ms. But the FIRST
 * request after the Worker starts was much slower:
 *
 *   first POST /api/questions   ~15–20 ms   ← over the limit
 *   later POST /api/questions    ~1 ms
 *
 * Profiling found two "first use" costs:
 *
 *   iconv-lite first decode   ~41 ms → 0.05 ms afterwards
 *     Express's JSON body parser decodes the body with iconv-lite, which
 *     builds its tables of character encodings the first time it's used.
 *
 *   Zod first parse           ~2 ms → 0.04 ms afterwards
 *     Plus our own code paths being compiled by the JavaScript engine.
 *
 * On a quiet portfolio site, most visits start a fresh Worker instance,
 * so "the first request" is most requests. Paying these costs during
 * STARTUP instead moves them out of the per-request CPU limit. Cloudflare
 * limits startup separately, and much more generously.
 *
 * This is a common serverless technique, often called "pre-warming".
 * AWS Lambda has the same cold-start trade-off.
 */
export const warmUp = async (service: DemoService): Promise<void> => {
  /*
   * Build iconv-lite's UTF-8 decoder now. Express's body parser shares
   * this same copy of iconv-lite (npm "dedupes" it), so its first real
   * request finds the tables already built.
   */
  iconv.decode(Buffer.from("{}"), "utf-8");

  /*
   * Run one example question and one analysis through the real pipeline,
   * so Zod's schemas and our own code are compiled before any visitor
   * arrives.
   */
  const [example] = service.listExampleQuestions();

  if (example) {
    await service.askQuestion(example.question);
  }

  const [firstComment] = service.listFeedback();

  if (firstComment) {
    await service.getFeedbackAnalysis(firstComment.id);
  }
};
