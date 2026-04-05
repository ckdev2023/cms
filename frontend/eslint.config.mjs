// @ts-check
import eslint from "@eslint/js";
import jsdocPlugin from "eslint-plugin-jsdoc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "src/auto-imports.d.ts", "src/components.d.ts"],
  },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],

  {
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
  },

  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    rules: {
      // ── Debug remnants (error — never in committed code) ──
      "no-debugger": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-alert": "error",

      // ── Dangerous patterns (error — security / correctness) ──
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      eqeqeq: ["error", "always"],

      // ── Bug-prone patterns (correctness) ──
      "no-cond-assign": ["error", "always"],
      "for-direction": "error",
      "no-unmodified-loop-condition": "error",
      "no-await-in-loop": "error",
      curly: ["error", "all"],

      // ── Readability ──
      "no-lonely-if": "error",
      "no-else-return": ["error", { allowElseIf: false }],
      "@typescript-eslint/prefer-for-of": "error",

      // ── Dangerous comments (warn — tech-debt markers) ──
      "no-warning-comments": [
        "warn",
        { terms: ["fixme", "hack", "xxx", "bug"], location: "start" },
      ],

      // ── Import ordering (warn — auto-fixable, progressive adoption) ──
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",

      // ── Complexity / length guards (warn — signal for refactoring) ──
      complexity: ["warn", { max: 15 }],
      // 与后端对齐：嵌套深度超过 4 层即阻断（预检全仓无存量违规）
      "max-depth": ["error", { max: 4 }],
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 80, skipBlankLines: true, skipComments: true },
      ],

      // ── TypeScript (warn — progressive cleanup of existing code) ──
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",

      // ── Vue ──
      "vue/multi-word-component-names": "off",
      "vue/no-v-html": "error",
      "vue/block-order": ["error", { order: ["script", "template", "style"] }],
      "vue/component-api-style": ["error", ["script-setup"]],
      "vue/define-macros-order": [
        "error",
        {
          order: ["defineProps", "defineEmits", "defineOptions", "defineSlots"],
        },
      ],
      "vue/no-unused-refs": "error",
      "vue/no-useless-v-bind": "error",
      "vue/prefer-true-attribute-shorthand": "error",

      // Formatting-only rules — disabled until a formatter (Prettier) is introduced.
      "vue/max-attributes-per-line": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/html-self-closing": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/html-indent": "off",
      "vue/first-attribute-linebreak": "off",
    },
  },

  {
    files: ["src/i18n/messages/**/*.ts"],
    rules: {
      // Locale dictionaries are intentionally large static data files.
      "max-lines": "off",
    },
  },

  {
    files: [
      "src/constants/enum-labels.ts",
      "src/views/visa/VisaCaseImportView.vue",
      "src/views/customer/components/CustomerVisaCaseDialog.vue",
    ],
    rules: {
      // 枚举标签全集与签证向导/导入大单页：行数超阈与拆分牵涉多域引用，单独跟踪收敛而非阻断日常提交
      "max-lines": "off",
    },
  },

  // ── JSDoc gate (Layer 1) — S06/S07 ──
  // Targets: stores, composables, directives, utils, api, constants, i18n, router (S06 mandatory scope)
  // warn level — graduated adoption per S05/S19
  {
    files: [
      "src/stores/**/*.ts",
      "src/composables/**/*.ts",
      "src/directives/**/*.ts",
      "src/utils/**/*.ts",
      "src/api/**/*.ts",
      "src/constants/**/*.ts",
      "src/i18n/**/*.ts",
      "src/router/**/*.ts",
    ],
    plugins: { jsdoc: jsdocPlugin },
    settings: { jsdoc: { mode: "typescript" } },
    rules: {
      "jsdoc/require-jsdoc": [
        "warn",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: false,
          },
          checkConstructors: false,
          minLineCount: 2,
        },
      ],
      "jsdoc/require-param": "warn",
      "jsdoc/require-param-description": "warn",
      "jsdoc/require-returns": "warn",
      "jsdoc/require-returns-description": "warn",
      "jsdoc/match-description": [
        "warn",
        {
          matchDescription: "[\\u4e00-\\u9fff]",
          message: "JSDoc 描述须包含中文（S06 标准）",
        },
      ],
    },
  },

  // ── .vue JSDoc gate (Layer 1) — conservative scope per S06/S19 Wave 7b ──
  // Only named function declarations with ≥6 lines; arrow functions, lifecycle
  // hooks, watchers, and trivial handlers are exempted.
  // warn level — graduated adoption; upgrade path in S19.
  {
    files: ["src/**/*.vue"],
    plugins: { jsdoc: jsdocPlugin },
    settings: { jsdoc: { mode: "typescript" } },
    rules: {
      "jsdoc/require-jsdoc": [
        "warn",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: false,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
          checkConstructors: false,
          minLineCount: 6,
        },
      ],
      "jsdoc/require-param": "warn",
      "jsdoc/require-param-description": "warn",
      "jsdoc/require-returns": "warn",
      "jsdoc/require-returns-description": "warn",
      "jsdoc/match-description": [
        "warn",
        {
          matchDescription: "[\\u4e00-\\u9fff]",
          message: "JSDoc 描述须包含中文（S06 标准）",
        },
      ],
    },
  },

  // ── Shared types gate — stricter declaration hygiene for src/types ──
  {
    files: ["src/types/**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },

  // ── Pinia stores gate — stricter than general frontend JSDoc scope ──
  {
    files: ["src/stores/**/*.ts"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: false,
          },
          checkConstructors: false,
          minLineCount: 2,
        },
      ],
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/match-description": [
        "error",
        {
          matchDescription: "[\\u4e00-\\u9fff]",
          message: "stores JSDoc 描述须包含中文（S06 标准）",
        },
      ],
    },
  },

  // ── Utils gate — strict local quality bar without blocking unrelated directories ──
  {
    files: ["src/utils/**/*.ts"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: false,
          },
          checkConstructors: false,
          minLineCount: 2,
        },
      ],
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/match-description": [
        "error",
        {
          matchDescription: "[\\u4e00-\\u9fff]",
          message: "utils JSDoc 描述须包含中文（S06 标准）",
        },
      ],
    },
  },

  // ── API gate — strict contract and request wrapper documentation ──
  {
    files: ["src/api/**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "jsdoc/require-jsdoc": [
        "error",
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: false,
            ClassDeclaration: false,
          },
          checkConstructors: false,
          minLineCount: 2,
        },
      ],
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/match-description": [
        "error",
        {
          matchDescription: "[\\u4e00-\\u9fff]",
          message: "api JSDoc 描述须包含中文（S06 标准）",
        },
      ],
    },
  },
);
