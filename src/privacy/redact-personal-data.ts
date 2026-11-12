
/**
 * CHAPTER 7 — PRIVACY: NEW
 *
 * Redacts common personal identifiers from text
 * before it is shared with an external LLM.
 *
 * This is a first layer of privacy protection,
 * not a comprehensive personal-data detector.
 *
 * Limitations:
 * - Does not detect people's names.
 * - Does not detect addresses or health information.
 * - Phone detection covers common UK mobile formats.
 * - Pattern matching can produce false positives.
 */

/**
 * Matches common email address formats.
 *
 * This is deliberately a practical pattern,
 * not a complete implementation of email standards.
 */
const EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/**
 * Matches common UK mobile number formats:
 *
 * 07700 900123
 * 07700900123
 * +44 7700 900123
 * 0044 7700 900123
 *
 * This is not a complete UK telephone-number parser.
 */
const UK_MOBILE_PATTERN =
  /(?<!\w)(?:\+44\s?7|0044\s?7|07)(?:[\s-]?\d){9}(?!\w)/g;

/**
 * CHAPTER 7 — NEW
 *
 * Returns a new string with supported identifiers
 * replaced by descriptive placeholders.
 *
 * We preserve the rest of the feedback so it
 * remains useful for sentiment and theme analysis.
 */
export const redactPersonalData = (text: string): string => {
  return text
    .replace(EMAIL_PATTERN, "[EMAIL REDACTED]")
    .replace(UK_MOBILE_PATTERN, "[PHONE REDACTED]");
};
