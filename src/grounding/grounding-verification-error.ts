/**
 * CHAPTER 8 — NEW: A dedicated error type for grounding failures
 *
 * WHY DOES THIS EXIST?
 *
 * Before Chapter 8, grounding failures were thrown as a plain Error:
 *
 *   throw new Error("Grounding verification failed: ...");
 *
 * That was fine for scripts and tests. But a server needs to react
 * differently to different kinds of failure:
 *
 *   - Grounding failed     → the AI gave an unsupported answer.
 *                            This is an EXPECTED outcome we want to
 *                            show the visitor ("the validator caught it").
 *
 *   - Something else broke → a bug or outage. The visitor should get
 *                            a generic "something went wrong" message.
 *
 * With a plain Error, the only way to tell them apart is to inspect the
 * message text, e.g. `error.message.startsWith("Grounding ...")`.
 * That's fragile: rewording a message would silently break the check.
 *
 * A custom class lets callers use `instanceof` instead:
 *
 *   if (error instanceof GroundingVerificationError) { ... }
 *
 * The message text is unchanged, so every existing test that checks for
 * "Grounding verification failed" still passes.
 */
export class GroundingVerificationError extends Error {
  constructor(reason: string) {
    /*
     * Keep the exact message format used since Chapter 7.
     *
     * Example:
     *   new GroundingVerificationError("Unknown source ID: fb-099")
     *   → message: "Grounding verification failed: Unknown source ID: fb-099"
     */
    super(`Grounding verification failed: ${reason}`);

    /*
     * Error subclasses should set `name`.
     *
     * It appears in stack traces and logs, e.g.
     *   "GroundingVerificationError: Grounding verification failed: ..."
     * instead of the less helpful "Error: ...".
     */
    this.name = "GroundingVerificationError";

    /*
     * Keep the reason on its own so callers can show it without the
     * "Grounding verification failed:" prefix.
     */
    this.reason = reason;
  }

  readonly reason: string;
}
