// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

// CLAUDE.md non-negotiable #1: MODEL AGNOSTIC. All LLM inference must route
// through packages/ai-orchestrator's InferenceProvider adapter. No provider
// SDK may be imported directly anywhere else in the codebase.
const RESTRICTED_LLM_SDK_IMPORTS = [
  {
    group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*"],
    message:
      "Do not import @anthropic-ai/sdk directly. Route all LLM calls through packages/ai-orchestrator's InferenceProvider adapter (see AnthropicProvider).",
  },
  {
    group: ["openai", "openai/*"],
    message:
      "Do not import openai directly. Route all LLM calls through packages/ai-orchestrator's InferenceProvider adapter (see OpenAIProvider).",
  },
  {
    group: ["@google/generative-ai", "@google/generative-ai/*", "@google-cloud/vertexai"],
    message:
      "Do not import Google AI SDKs directly. Route all LLM calls through packages/ai-orchestrator's InferenceProvider adapter (see GoogleProvider).",
  },
  {
    group: ["@mistralai/mistralai", "@mistralai/mistralai/*"],
    message:
      "Do not import the Mistral SDK directly. Route all LLM calls through packages/ai-orchestrator's InferenceProvider adapter.",
  },
  {
    group: ["groq-sdk", "groq-sdk/*"],
    message:
      "Do not import the Groq SDK directly. Route all LLM calls through packages/ai-orchestrator's InferenceProvider adapter.",
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/*.config.js",
      "**/*.config.ts",
      "**/coverage/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": ["error", { patterns: RESTRICTED_LLM_SDK_IMPORTS }],
    },
  },
  {
    // The one carve-out: concrete provider adapters are the only files
    // permitted to import an LLM provider SDK directly.
    files: ["packages/ai-orchestrator/src/providers/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    // Pino handles structured logging server-side; console.log is fine in
    // config/scripts but not in application source.
    files: ["**/*.config.ts", "**/scripts/**/*.ts", "**/*.test.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    // apps/web only: React/hooks correctness plus jsx-a11y (NFR-13 / UI-03:
    // WCAG 2.1 AA on the dashboard UI - catching obvious violations at lint
    // time, not a substitute for real accessibility testing).
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs["recommended-latest"].rules,
      ...jsxA11y.configs.recommended.rules,
      "no-console": "off",
      // Redundant (and produces false positives) on typed components -
      // TypeScript already enforces prop shapes at compile time.
      "react/prop-types": "off",
    },
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "18.3" } },
  },
);
