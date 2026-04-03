// @ts-check
import eslint from '@eslint/js';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      // ── Debug remnants (error — never in committed code) ──
      'no-debugger': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-alert': 'error',

      // ── Dangerous patterns (error — security / correctness) ──
      'no-eval': 'error',
      'no-new-func': 'error',
      'eqeqeq': ['error', 'always'],

      // ── Dangerous comments (warn — tech-debt markers) ──
      'no-warning-comments': [
        'warn',
        { terms: ['fixme', 'hack', 'xxx', 'bug'], location: 'start' },
      ],

      // ── Import ordering (warn — auto-fixable, progressive adoption) ──
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',

      // ── Complexity / length guards (warn — signal for refactoring) ──
      'complexity': ['warn', { max: 15 }],
      'max-depth': ['warn', { max: 4 }],
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'warn',
        { max: 80, skipBlankLines: true, skipComments: true },
      ],

      // ── TypeScript (warn — progressive cleanup of existing code) ──
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',

      // ── Prettier ──
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },

  // ── Declaration layer gate (error) — common dto / entities + selected module contracts ──
  // Declaration-centric DTO / Entity files require stable imports and class-level docs.
  {
    files: [
      'src/common/dto/**/*.ts',
      'src/common/entities/**/*.ts',
      'src/modules/admin-case/dto/**/*.ts',
      'src/modules/finance/entities/**/*.ts',
      'src/modules/system/dto/**/*.ts',
      'src/modules/system/entities/**/*.ts',
      'src/modules/tax/dto/**/*.ts',
    ],
    ignores: ['**/index.ts'],
    plugins: {
      jsdoc: jsdocPlugin,
    },
    settings: {
      jsdoc: { mode: 'typescript' },
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'jsdoc/require-jsdoc': ['error', {
        require: {
          ClassDeclaration: true,
          FunctionDeclaration: false,
          MethodDefinition: false,
        },
      }],
      'jsdoc/match-description': ['error', {
        matchDescription: '[\\u4e00-\\u9fff]',
        message: 'JSDoc 描述须包含中文（S06 标准）',
      }],
    },
  },

  // ── Common foundation gate (error) — helpers / interceptors / filters ──
  // Shared backend infrastructure should fail fast on missing docs and unstable imports.
  {
    files: [
      'src/common/helpers/**/*.ts',
      'src/common/interceptors/**/*.ts',
      'src/common/filters/*.ts',
    ],
    ignores: ['**/index.ts'],
    plugins: { jsdoc: jsdocPlugin },
    settings: { jsdoc: { mode: 'typescript' } },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'jsdoc/require-jsdoc': ['error', {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
        },
        checkConstructors: false,
        checkGetters: false,
        checkSetters: false,
        minLineCount: 2,
      }],
      'jsdoc/require-param': 'error',
      'jsdoc/require-param-description': 'error',
      'jsdoc/require-returns': 'error',
      'jsdoc/require-returns-description': 'error',
      'jsdoc/match-description': ['error', {
        matchDescription: '[\\u4e00-\\u9fff]',
        message: 'JSDoc 描述须包含中文（S06 标准）',
      }],
    },
  },

  // ── Contract declaration gate (error) — common interfaces ──
  // Interface files are cross-module contracts; keep imports stable and let Layer 2 enforce file overview docs.
  {
    files: ['src/common/interfaces/**/*.ts'],
    ignores: ['**/index.ts'],
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },

  // ── Migration gate (error) — src/migrations ──
  // Generated SQL migrations should keep semantic docs/import order strict
  // while opting out of noisy formatting and complexity guards.
  {
    files: ['src/migrations/**/*.ts'],
    plugins: { jsdoc: jsdocPlugin },
    settings: { jsdoc: { mode: 'typescript' } },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'jsdoc/require-jsdoc': ['error', {
        require: {
          ClassDeclaration: true,
          FunctionDeclaration: false,
          MethodDefinition: false,
        },
      }],
      'jsdoc/match-description': ['error', {
        matchDescription: '[\\u4e00-\\u9fff]',
        message: 'JSDoc 描述须包含中文（S06 标准）',
      }],
      complexity: 'off',
      'max-depth': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'prettier/prettier': 'off',
    },
  },

  // ── JSDoc gate (Layer 1) — S06/S07 ──
  // Targets: services, controllers, guards (S06 mandatory scope)
  // warn level — graduated adoption per S05/S19
  {
    files: [
      'src/modules/**/*.service.ts',
      'src/modules/**/*.controller.ts',
      'src/modules/auth/guards/*.ts',
    ],
    ignores: ['**/index.ts'],
    plugins: { jsdoc: jsdocPlugin },
    settings: { jsdoc: { mode: 'typescript' } },
    rules: {
      'jsdoc/require-jsdoc': ['warn', {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: false,
        },
        checkConstructors: false,
        checkGetters: false,
        checkSetters: false,
        minLineCount: 2,
      }],
      'jsdoc/require-param': 'warn',
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns': 'warn',
      'jsdoc/require-returns-description': 'warn',
      'jsdoc/match-description': ['warn', {
        matchDescription: '[\\u4e00-\\u9fff]',
        message: 'JSDoc 描述须包含中文（S06 标准）',
      }],
    },
  },
);
