
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * ESLint configuration for Feedback Analyser.
 *
 * CHAPTER 6 — CONFIGURATION IMPROVEMENT
 *
 * Allow unused function parameters prefixed with "_".
 *
 * This is useful for mock implementations where
 * a function must accept an argument to satisfy
 * an interface but doesn't actually use it.
 */
export default tseslint.config(
  {
    // CHAPTER 9: web/ is a separate package with its own tooling.
    ignores: ["node_modules/**", "dist/**", "coverage/**", "web/**", ".wrangler/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          /*
           * CHAPTER 8: allow `const { removed, ...rest } = obj` when only
           * `rest` is used. This is the standard way to copy an object
           * without one key, so the "unused" variable is intentional.
           */
          ignoreRestSiblings: true,
        },
      ],
    },
  },
);
