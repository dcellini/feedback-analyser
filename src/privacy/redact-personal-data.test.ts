
import { describe, expect, it } from "vitest";

import { redactPersonalData } from "./redact-personal-data.js";

/**
 * CHAPTER 7 — PRIVACY: NEW
 *
 * Tests our first personal-data redaction layer.
 *
 * These tests use local strings only.
 * No external services are contacted.
 */
describe("redactPersonalData", () => {
  it("redacts an email address", () => {
    const feedback =
      "Contact me at sarah@example.com about management.";

    expect(redactPersonalData(feedback)).toBe(
      "Contact me at [EMAIL REDACTED] about management.",
    );
  });

  it("redacts a UK mobile phone number", () => {
    const feedback =
      "My phone number is 07700 900123.";

    expect(redactPersonalData(feedback)).toBe(
      "My phone number is [PHONE REDACTED].",
    );
  });

  it("redacts a UK mobile number with country code", () => {
    const feedback =
      "Please call +44 7700 900123.";

    expect(redactPersonalData(feedback)).toBe(
      "Please call [PHONE REDACTED].",
    );
  });

  it("redacts multiple identifiers", () => {
    const feedback =
      "Email sarah@example.com or call 07700 900123.";

    expect(redactPersonalData(feedback)).toBe(
      "Email [EMAIL REDACTED] or call [PHONE REDACTED].",
    );
  });

  it("preserves feedback without matching identifiers", () => {
    const feedback =
      "Management should communicate more clearly.";

    expect(redactPersonalData(feedback)).toBe(feedback);
  });

  it("preserves meaningful feedback around redacted data", () => {
    const feedback =
      "My manager is supportive. " +
      "Contact me at sarah@example.com.";

    expect(redactPersonalData(feedback)).toBe(
      "My manager is supportive. " +
        "Contact me at [EMAIL REDACTED].",
    );
  });
});
