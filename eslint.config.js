import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: ["dist/"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "scripts/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // Downgraded to a warning to match the previous typescript-eslint v5 preset.
      "@typescript-eslint/no-explicit-any": "warn",
      // TypeScript itself reports undefined globals; no-undef only produces
      // false positives for jest/DOM globals in TS files.
      "no-undef": "off",
      "semi": ["error", "always"],
    },
  },
];
