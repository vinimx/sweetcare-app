import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

/** @type {import("eslint").Linter.Config[]} */
export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      ...tsPlugin.configs["strict-type-checked"].rules,
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    files: ["apps/api/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        process: "readonly",
        crypto: "readonly",
        Buffer: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
      },
    },
    rules: {
      // Prisma's $extends generates a type too complex for the language service to
      // resolve, causing false-positive no-unsafe-* cascade across all repositories.
      // Integration tests provide the safety net for these call sites.
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      // Fastify route registration functions and stubs are conventionally async
      // even without an explicit await (Fastify resolves the returned promise).
      "@typescript-eslint/require-await": "off",
      // Prisma extended client type surfaces as an error type in the language service,
      // causing no-redundant-type-constituents false positives on union annotations.
      "@typescript-eslint/no-redundant-type-constituents": "off",
      // Fastify's request.protocol / request.headers members and Prisma JSON fields
      // have types that fool the unnecessary-condition check in the language service.
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
  {
    files: ["apps/mobile/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        FormData: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        process: "readonly",
        crypto: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        Intl: "readonly",
      },
    },
  },
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.expo/**",
      "**/coverage/**",
      "eslint.config.mjs",
      // API test files and vitest config are excluded from the project tsconfig;
      // type-aware linting requires them to be in a tsconfig to resolve correctly.
      "apps/api/tests/**",
      "apps/api/vitest.config.ts",
    ],
  },
];
