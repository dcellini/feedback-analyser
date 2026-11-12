import { createReplayDemoService } from "../demo/demo-service.js";
import { createApp } from "./app.js";

/**
 * CHAPTER 8 — MILESTONE 2b: STARTING THE EXPRESS API
 *
 * Run with:
 *
 *   npm run dev:api
 *
 * This is the COMPOSITION ROOT: the one place that creates the real
 * dependencies, wires them together and starts listening. Compare it with
 * src/server/learning/start-native-server.ts: the two are almost
 * identical, because all the differences live inside app.ts.
 *
 * (When we deploy to AWS Lambda, there will be a second entry point that
 * hands the same `app` to Lambda instead of calling listen().)
 */

const port = Number(process.env.PORT ?? 3000);

const service = await createReplayDemoService();
const app = createApp(service);

/*
 * app.listen() creates a node:http server with the Express app as its
 * request listener, and returns that server. Under the hood it's the
 * same createServer() we used by hand.
 */
const server = app.listen(port, () => {
  console.log(`Feedback Analyser API listening on http://localhost:${port}`);
});

/*
 * GRACEFUL SHUTDOWN, as in the native server: stop accepting new
 * connections, let in-progress requests finish, then exit.
 */
const shutdown = (signal: string) => {
  console.log(`\n${signal} received: finishing in-progress requests, then stopping.`);

  server.close(() => {
    console.log("Server stopped.");
    process.exit(0);
  });

  server.closeIdleConnections();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
