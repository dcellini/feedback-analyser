/**
 * CHAPTER 8 — TYPES FOR CLOUDFLARE'S "cloudflare:node" MODULE
 *
 * `cloudflare:node` only exists inside the Cloudflare Workers runtime, so
 * TypeScript has no types for it. This declaration describes the one
 * function we use, so worker.ts type-checks with the rest of the backend.
 *
 * (Cloudflare can generate a full set of runtime types with
 * `npx wrangler types`, but they're large and clash with Node's types.
 * One small declaration is all we need.)
 */
declare module "cloudflare:node" {
  /**
   * Routes incoming Worker requests to the node:http server listening on
   * `port` (a virtual port inside the Worker), and returns the Worker's
   * default export.
   */
  export function httpServerHandler(options: { port: number }): {
    fetch(request: Request, env: unknown, context: unknown): Promise<Response>;
  };
}
