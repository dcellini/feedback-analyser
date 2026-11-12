import { createReplayDemoService } from "../../demo/demo-service.js";
import { createNativeServer } from "./native-http-server.js";

/**
 * CHAPTER 8 — MILESTONE 2a: STARTING THE NATIVE SERVER
 *
 * Run with:
 *
 *   npm run learn:native-server
 *
 * then, in another terminal:
 *
 *   curl http://localhost:3000/api/health
 *
 * This file is the ENTRY POINT: the one place that creates the real
 * dependencies, wires them together and starts listening. Keeping this
 * separate from native-http-server.ts means the server itself never
 * reads environment variables or opens ports, so tests can build it with
 * whatever they like.
 *
 * This pattern is often called the "composition root".
 */

/*
 * PORT comes from the environment so a hosting platform can choose it.
 * Environment variables are always strings (or undefined), hence Number().
 */
const port = Number(process.env.PORT ?? 3000);

/*
 * Top-level await: this file is an ES module ("type": "module" in
 * package.json), so we can await at the top level without an async
 * wrapper function.
 */
const service = await createReplayDemoService();
const server = createNativeServer(service);

/*
 * listen() is asynchronous: it asks the operating system for the port,
 * and the callback runs once the server is actually accepting connections.
 */
server.listen(port, () => {
  console.log(`Native learning server listening on http://localhost:${port}`);
  console.log("Try: curl http://localhost:" + port + "/api/health");
});

/*
 * GRACEFUL SHUTDOWN
 *
 * Pressing Ctrl+C sends the process a SIGINT signal. Hosting platforms
 * send SIGTERM when they stop or replace a server.
 *
 * server.close() stops accepting NEW connections, then calls back once the
 * in-progress requests have finished. Without this, a deploy could cut
 * off a visitor's request halfway through.
 */
const shutdown = (signal: string) => {
  console.log(`\n${signal} received: finishing in-progress requests, then stopping.`);

  server.close(() => {
    console.log("Server stopped.");
    process.exit(0);
  });

  /*
   * Browsers keep idle connections open for reuse ("keep-alive"), which
   * can stop close() from finishing. Close the idle ones straight away.
   */
  server.closeIdleConnections();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
