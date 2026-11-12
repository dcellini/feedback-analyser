import "dotenv/config";

import { createGeminiAIProvider } from "./gemini-ai-provider.js";

/*
 * Create the real Gemini provider.
 *
 * Unlike our tests, this script does not use a mock. Calling
 * `analyzeFeedback()` below will make a real request to Gemini.
 */
const provider = createGeminiAIProvider();

/*
 * Send some realistic employee feedback to Gemini.
 *
 * The provider is responsible for communicating with Gemini and returning
 * the model's structured JSON output as a string.
 */
const result = await provider.analyzeFeedback(
  "Employees are frustrated because performance reviews are often delayed. Communication from managers is inconsistent, and people feel they don't know what is expected of them.",
);

/*
 * Display the raw result so we can inspect what Gemini actually returned.
 *
 * This is a manual development/debugging script, so console.log() is
 * appropriate here.
 */
console.log(result);
