import { httpServerHandler } from "cloudflare:node";

import { createReplayDemoService } from "../demo/demo-service.js";
import { createApp } from "./app.js";
import { warmUp } from "./warm-up.js";

/**
 * CHAPTER 8 — DEPLOYMENT: THE CLOUDFLARE WORKER ENTRY POINT
 *
 * A third "composition root", next to:
 *
 *   start-server.ts                 Express on your machine (npm run dev:api)
 *   learning/start-native-server.ts the framework-free learning server
 *   worker.ts                       Express on Cloudflare (this file)
 *
 * All three build the same app from the same service. Only this tiny
 * file knows about Cloudflare, which is why moving to AWS Lambda later
 * would mean writing one more small file like this, not changing the app.
 *
 * HOW DOES EXPRESS RUN ON CLOUDFLARE?
 *
 * Cloudflare Workers aren't Node.js. A Worker is a function that receives
 * a web-standard Request and returns a Response:
 *
 *   export default { fetch(request) { return new Response("hi") } }
 *
 * Express expects Node's http server instead. With the `nodejs_compat`
 * flag (see wrangler.jsonc), Cloudflare provides a compatible `node:http`,
 * and httpServerHandler() connects the two:
 *
 *   Request → httpServerHandler → "port 8080" → Express app → Response
 *
 * The port is virtual: nothing listens on a real network port. It just
 * tells httpServerHandler which of the app.listen() calls to send
 * requests to.
 *
 * STARTUP
 *
 * This top-level code runs once when Cloudflare starts an instance of the
 * Worker (a "cold start"). The service and app are then reused for every
 * request that instance handles, exactly like a long-running server. An
 * instance can be discarded at any time, though, so never rely on memory
 * surviving between requests. The demo service keeps no per-user state,
 * so that's fine.
 */
const PORT = 8080;

const service = await createReplayDemoService();

/*
 * Pay one-off "first use" costs now, at startup, rather than in a
 * visitor's first request (see warm-up.ts for the measurements).
 */
await warmUp(service);

createApp(service).listen(PORT);

export default httpServerHandler({ port: PORT });
