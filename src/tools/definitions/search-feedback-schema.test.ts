
import { describe, expect, it } from "vitest";
import { searchFeedbackSchema } from "./search-feedback-schema.js";

describe("searchFeedbackSchema", () => {
  it("accepts valid search arguments", () => {
    const result = searchFeedbackSchema.parse({
      query: "management",
      limit: 3,
    });

    expect(result).toEqual({
      query: "management",
      limit: 3,
    });
  });

  it("uses a default limit of 5", () => {
    const result = searchFeedbackSchema.parse({
      query: "management",
    });

    expect(result).toEqual({
      query: "management",
      limit: 5,
    });
  });

  it("rejects an empty search query", () => {
    expect(() =>
      searchFeedbackSchema.parse({
        query: "   ",
      }),
    ).toThrow();
  });

  it("rejects a limit greater than 10", () => {
    expect(() =>
      searchFeedbackSchema.parse({
        query: "management",
        limit: 100,
      }),
    ).toThrow();
  });

  it("rejects incorrect argument types", () => {
    expect(() =>
      searchFeedbackSchema.parse({
        query: 123,
        limit: "five",
      }),
    ).toThrow();
  });
});
