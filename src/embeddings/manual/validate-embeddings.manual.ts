import "dotenv/config";

import { createGeminiEmbeddingProvider } from "../providers/gemini-embedding-provider.js";
import { createCachedEmbeddingProvider } from "../providers/cached-embedding-provider.js";
import { evaluateThemes } from "../../evaluation/semantic/evaluate-themes.js";
import { compareText } from "./compare-text.js";


/**
 * MANUAL EMBEDDING VALIDATION
 *
 * IMPORTANT: Running this file makes real Gemini API calls.
 *
 * Five unique texts are used:
 *   management
 *   management support
 *   office parking
 *   recognition
 *   employee appreciation
 *
 * With a successful run and the cache, the underlying
 * embedding provider should be called five times.
 */

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing");
}

const provider = createCachedEmbeddingProvider(createGeminiEmbeddingProvider(apiKey));

const main = async (): Promise<void> => {
  /**runEvaluation
   * STEP 1 — COMPARE RELATED AND UNRELATED TEXT
   *
   * All three comparisons use the same cached provider.
   * The second comparison reuses "management".
   */
  const related = await compareText({
    textA: "management",
    textB: "management support",
    embeddingProvider: provider,
  });

  const unrelated = await compareText({
    textA: "management",
    textB: "office parking",
    embeddingProvider: provider,
  });

  const recognition = await compareText({
    textA: "recognition",
    textB: "employee appreciation",
    embeddingProvider: provider,
  });

  console.log("Semantic similarity scores:");
  console.table({
    "Management / management support": related,
    "Management / office parking": unrelated,
    "Recognition / employee appreciation": recognition,
  });

  /**
   * STEP 2 — CHECK THE RELATIVE RANKING
   *
   * We expect related management phrases to score higher
   * than the unrelated parking phrase.
   *
   * We deliberately don't assert a fixed score like 0.85.
   * That threshold needs to be calibrated using real data.
   */
  console.log("Related management phrases rank higher:", related > unrelated);

  /**
   * STEP 3 — TEST OUR SEMANTIC THEME EVALUATOR
   *
   * Reuses cached embeddings for the same strings.
   *
   * This checks our original evaluation problem:
   * expected "management" vs actual "management support".
   */
  const themeEvaluation = await evaluateThemes({
    expectedThemes: ["management"],
    actualThemes: ["management support", "office parking"],
    embeddingProvider: provider,
    threshold: 0.85,
  });

  console.log("Theme evaluation:");
  console.dir(themeEvaluation, { depth: null });
};

await main();
