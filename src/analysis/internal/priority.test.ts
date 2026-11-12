import { isHighPriority } from "./priority.js";

import { describe, it, expect } from "vitest";

/*
 * Group the tests for isHighPriority() together.
 *
 * This function contains a very simple business rule:
 *
 *     priority === "high" → true
 *     anything else       → false
 */
describe("isHighPriority", () => {
  /*
   * Test the positive case.
   *
   * This confirms that "high" is correctly recognised as high priority.
   */
  it("returns true for high priority", () => {
    expect(isHighPriority("high")).toBe(true);
  });

  /*
   * Test the negative cases.
   *
   * We check both other valid priority values to make sure they are
   * correctly treated as not high priority.
   */
  it("returns false for non-high priority", () => {
    expect(isHighPriority("medium")).toBe(false);
    expect(isHighPriority("low")).toBe(false);
  });
});
  