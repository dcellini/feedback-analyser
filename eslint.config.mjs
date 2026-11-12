
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
    ignores: ["node_modules/**", "dist/**", "coverage/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],
    },
  },
);
