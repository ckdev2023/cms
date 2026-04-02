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

  // ── JSDoc gate (Layer 1) — S06/S07 ──
  // Targets: services, controllers, guards, interceptors, helpers, filters (S06 mandatory scope)
  // warn level — graduated adoption per S05/S19
  {
    files: [
      'src/modules/**/*.service.ts',
      'src/modules/**/*.controller.ts',
      'src/modules/auth/guards/*.ts',
      'src/common/interceptors/*.ts',
      'src/common/helpers/*.ts',
      'src/common/filters/*.ts',
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
