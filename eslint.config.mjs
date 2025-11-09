import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "main.js",
      "node_modules/**",
      "onnxruntime/**",
      "dist/**",
      "*.js",
      "*.mjs",
      "tests/**",
    ],
  },

  ...tseslint.configs.recommended,

  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      /* --- General sanity --- */
      "no-duplicate-imports": "error",
      "no-prototype-builtins": "off",

      /* --- Imports & unused --- */
      "sort-imports": [
        "error",
        {
          ignoreCase: true,
          ignoreDeclarationSort: false,
          memberSyntaxSortOrder: ["none", "all", "multiple", "single"],
          allowSeparatedGroups: true,
        },
      ],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      /* --- Style & formatting --- */
      semi: ["error", "never"],
      "no-extra-semi": "error",

      quotes: ["error", "single", { avoidEscape: true }],
      indent: ["error", 2],
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "never"],
      "space-before-function-paren": [
        "error",
        { anonymous: "always", named: "never", asyncArrow: "always" },
      ],
      "no-trailing-spaces": "error",
      "eol-last": ["error", "always"],

      /* --- Disable strict TS rules that get annoying --- */
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
);
