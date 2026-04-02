/**
 * lint-staged 設定 — pre-commit 時にステージ済みファイルのみを検査。
 *
 * 検査内容:
 *   1. ESLint: frontend (.ts/.vue) と backend (.ts) をそれぞれのプロジェクト内で実行
 *   2. JSDoc Layer 2: 強制対象ディレクトリ内の .ts ファイルに対して内容品質を検査
 *
 * モノレポ構成のため、ESLint はサブプロジェクト内から実行し、
 * ファイルパスをサブプロジェクト相対に変換する。
 */

import { relative, resolve } from 'node:path'

const frontendDir = resolve('frontend')
const backendDir = resolve('backend')

export default {
  'frontend/src/**/*.{ts,vue}': (files) => {
    const paths = files.map((f) => relative(frontendDir, f))
    return `cd frontend && npx eslint --no-warn-ignored ${paths.join(' ')}`
  },

  'backend/{src,test}/**/*.ts': (files) => {
    const paths = files.map((f) => relative(backendDir, f))
    return `cd backend && npx eslint --no-warn-ignored ${paths.join(' ')}`
  },

  '{frontend,backend}/src/**/*.ts': (files) => {
    return `node scripts/check-jsdoc.mjs ${files.join(' ')}`
  },
}
