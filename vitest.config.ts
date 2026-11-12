import { configDefaults, defineConfig } from "vitest/config";

/**
 * CHAPTER 9 — BACKEND TEST CONFIGURATION
 *
 * Before Chapter 9, Vitest's defaults were enough. Now the repository also
 * contains the React app in web/, whose tests need a browser-like
 * environment (jsdom) and run with web/'s own Vitest config.
 *
 * So the backend test run excludes web/ explicitly. Run frontend tests
 * with `npm test` inside web/ (or `npm run test:web` from here).
 */
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "web/**"],
  },
});
