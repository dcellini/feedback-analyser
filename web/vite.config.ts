/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * CHAPTER 9 — VITE CONFIGURATION
 *
 * Vite does two jobs:
 *
 *   `npm run dev`   → a development server with instant reloads
 *   `npm run build` → plain static files in web/dist (HTML, JS, CSS)
 *
 * Those static files are what we'll later upload to S3 and serve through
 * CloudFront. There's no Node.js server in the browser: a "React app"
 * in production is just files.
 */
export default defineConfig({
  plugins: [react()],

  server: {
    /*
     * THE DEV PROXY — how the frontend reaches the API locally.
     *
     * The app always calls RELATIVE URLs like fetch("/api/feedback").
     *
     * In development, the browser sends that to Vite (localhost:5173),
     * and Vite forwards anything under /api to the Node server on
     * localhost:3000:
     *
     *   browser ──/api/feedback──► Vite :5173 ──► Node API :3000
     *
     * In production, CloudFront will do the same job: /api/* goes to the
     * backend, everything else to the static files.
     *
     * WHY NOT CALL http://localhost:3000 DIRECTLY?
     *
     * A different port counts as a different ORIGIN, so the browser would
     * enforce CORS rules and we'd need extra CORS configuration. With the
     * proxy, the browser only ever talks to one origin, both locally and
     * in production, so CORS never comes up.
     */
    proxy: {
      "/api": "http://localhost:3000",
    },
  },

  test: {
    // Simulates a browser (document, window) inside Node for React tests.
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
