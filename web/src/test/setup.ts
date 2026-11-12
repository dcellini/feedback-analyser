/**
 * CHAPTER 9 — TEST SETUP (runs before every test file)
 */
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/*
 * Adds matchers such as toBeInTheDocument() and toHaveAttribute() (above).
 *
 * Testing Library only removes rendered components between tests
 * automatically when Vitest's `globals` option is on. We import
 * describe/it/expect explicitly instead, so we clean up ourselves.
 * Otherwise each test would still see the previous test's page.
 */
afterEach(() => {
  cleanup();
});
