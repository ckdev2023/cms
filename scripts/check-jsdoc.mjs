#!/usr/bin/env node
/**
 * JSDoc 质量检查器（Layer 2）。
 *
 * eslint-plugin-jsdoc（Layer 1）负责存在性与基本结构（@param / @returns 覆盖）。
 * 本脚本检查 ESLint 规则难以表达的内容质量：
 *
 *   1. 描述不得为空泛词黑名单中的词汇（S06 §质量判断标准）
 *   2. 描述有效字符不少于 8 个（S06 §通过条件 #2）
 *   3. 含 throw new 的函数须标注 @throws（S06 §通过条件 #5）
 *
 * 用法：
 *   node scripts/check-jsdoc.mjs            # 扫描全部强制目录
 *   node scripts/check-jsdoc.mjs f1.ts f2.ts # 仅检查指定文件（lint-staged 模式）
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const IS_CI = !!process.env.GITHUB_ACTIONS

// ── Target directories (aligned with S06 / S08 mandatory scope) ──────

const FRONTEND_DIRS = [
  'frontend/src/stores',
  'frontend/src/composables',
  'frontend/src/directives',
  'frontend/src/utils',
  'frontend/src/api',
  'frontend/src/constants',
  'frontend/src/i18n',
  'frontend/src/router',
]
const FRONTEND_TYPES_DIR = 'frontend/src/types'

const BACKEND_DIRS = [
  'backend/src/common/interceptors',
  'backend/src/common/helpers',
  'backend/src/common/filters',
  'backend/src/modules/auth/guards',
]

const BACKEND_MODULES_DIR = 'backend/src/modules'
const BACKEND_MODULE_RE = /\.(service|controller)\.ts$/
const SKIP_FILE_RE = /(?:\.d\.ts|\.spec\.ts|\.test\.ts)$/
const TYPE_FILE_EXEMPT_RE = /(?:^|\/)index\.ts$/

// ── Quality rules (from S06) ─────────────────────────────────────────

const BANNED_PHRASES = new Set([
  '处理', '获取', '设置', '执行', '操作', '初始化',
  '处理数据', '获取信息', '处理请求', '辅助方法',
  'helper', 'process', 'handle', 'get data',
  'execute', 'initialize', 'do something',
])

const MIN_DESC_CHARS = 8
const MAX_JSDOC_GAP = 3

// ── File collection ──────────────────────────────────────────────────

function walk(dir, accept) {
  const out = []
  if (!existsSync(dir)) return out
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name)
    if (ent.isDirectory()) {
      out.push(...walk(full, accept))
    } else if (accept(ent.name)) {
      out.push(full)
    }
  }
  return out
}

function collectTargetFiles() {
  const files = []
  const tsOnly = (n) => n.endsWith('.ts') && !SKIP_FILE_RE.test(n)

  for (const d of FRONTEND_DIRS) files.push(...walk(join(ROOT, d), tsOnly))
  files.push(...walk(join(ROOT, FRONTEND_TYPES_DIR), tsOnly))
  for (const d of BACKEND_DIRS) files.push(...walk(join(ROOT, d), tsOnly))

  const modDir = join(ROOT, BACKEND_MODULES_DIR)
  if (existsSync(modDir)) {
    files.push(...walk(modDir, (n) => BACKEND_MODULE_RE.test(n)))
  }

  return files
}

function isTargetFile(absPath) {
  const rel = relative(ROOT, absPath)
  const allDirs = [...FRONTEND_DIRS, FRONTEND_TYPES_DIR, ...BACKEND_DIRS]
  if (allDirs.some((d) => rel.startsWith(d)) && !SKIP_FILE_RE.test(rel)) return true
  if (rel.startsWith(BACKEND_MODULES_DIR) && BACKEND_MODULE_RE.test(rel)) return true
  return false
}

// ── Parsing ──────────────────────────────────────────────────────────

const FUNC_RE =
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(/
const METHOD_RE =
  /^\s*(?:(?:public|private|protected)\s+)?(?:static\s+)?(?:async\s+)?(\w+)\s*\(/
const SKIP_NAMES = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'import', 'from',
  'new', 'class', 'interface', 'type', 'enum', 'const', 'let', 'var',
  'constructor', 'super', 'await', 'typeof', 'delete',
])
const SKIP_LINE_RE =
  /^\s*(?:constructor|export\s*\{|import\s|\/\/|const\s|let\s|var\s|type\s|interface\s|enum\s|class\s)/

function extractEntries(source) {
  const lines = source.split('\n')
  const entries = []
  let inJsdoc = false
  let jsdocBuf = []
  let jsdocEnd = -999
  let jsdocText = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const ln = i + 1

    if (!inJsdoc && line.includes('/**')) {
      inJsdoc = true
      jsdocBuf = [line]
    } else if (inJsdoc) {
      jsdocBuf.push(line)
    }

    if (inJsdoc && line.includes('*/')) {
      inJsdoc = false
      jsdocEnd = ln
      jsdocText = jsdocBuf.join('\n')
      jsdocBuf = []
      continue
    }

    if (inJsdoc) continue

    const m = line.match(FUNC_RE) || line.match(METHOD_RE)
    if (!m) continue
    if (SKIP_LINE_RE.test(line)) continue

    const name = m[1]
    if (!name || name.length < 2 || SKIP_NAMES.has(name)) continue

    const hasDoc = ln - jsdocEnd <= MAX_JSDOC_GAP
    entries.push({
      name,
      line: ln,
      hasDoc,
      jsdoc: hasDoc ? jsdocText : null,
    })
  }

  return entries
}

// ── Quality checks ───────────────────────────────────────────────────

function extractDescription(jsdoc) {
  const parts = []
  for (const line of jsdoc.split('\n')) {
    const clean = line.replace(/^\s*\/?\*+\/?/g, '').trim()
    if (clean.startsWith('@')) break
    if (clean) parts.push(clean)
  }
  return parts.join(' ').trim()
}

function checkDescription(desc) {
  const violations = []

  const stripped = desc.replace(/[\s。.，,、！!？?：:；;（）()\-—·「」『』""'']/g, '')
  if (stripped.length < MIN_DESC_CHARS) {
    violations.push(`描述过短（有效字符 ${stripped.length}/${MIN_DESC_CHARS}）`)
  }

  const normalized = desc.replace(/[。.]\s*$/, '').trim().toLowerCase()
  if (BANNED_PHRASES.has(normalized)) {
    violations.push(`描述为空泛词："${desc}"`)
  }

  return violations
}

function checkHasChinese(desc) {
  return /[\u4e00-\u9fff]/.test(desc)
}

function hasThrowInBody(lines, funcLineIdx) {
  let depth = 0
  let started = false
  const limit = Math.min(funcLineIdx + 200, lines.length)

  for (let i = funcLineIdx; i < limit; i++) {
    const line = lines[i]
    for (const ch of line) {
      if (ch === '{') { depth++; started = true }
      if (ch === '}') depth--
    }
    if (started && depth <= 0) break
    if (started && /\bthrow\s+new\b/.test(line)) return true
  }
  return false
}

const EXPORTED_TYPE_RE = /^\s*export\s+(?:interface|type|enum)\s+\w+/m
const MODULE_AUGMENT_RE = /^\s*declare\s+module\s+['"][^'"]+['"]\s*\{/m

function needsTypeOverview(source, filePath) {
  return (
    filePath.startsWith(join(ROOT, FRONTEND_TYPES_DIR)) &&
    !TYPE_FILE_EXEMPT_RE.test(relative(ROOT, filePath)) &&
    (EXPORTED_TYPE_RE.test(source) || MODULE_AUGMENT_RE.test(source))
  )
}

function extractFileOverview(source) {
  const trimmed = source.trimStart()
  if (!trimmed.startsWith('/**')) return null

  const end = trimmed.indexOf('*/')
  if (end === -1) return null

  return trimmed.slice(0, end + 2)
}

// ── Per-file check ───────────────────────────────────────────────────

function checkFile(filePath) {
  const source = readFileSync(filePath, 'utf-8')
  const lines = source.split('\n')
  const entries = extractEntries(source)
  const violations = []

  for (const entry of entries) {
    if (!entry.hasDoc || !entry.jsdoc) continue

    const desc = extractDescription(entry.jsdoc)
    for (const msg of checkDescription(desc)) {
      violations.push({ line: entry.line, name: entry.name, msg })
    }

    if (
      !/@throws\b/.test(entry.jsdoc) &&
      hasThrowInBody(lines, entry.line - 1)
    ) {
      violations.push({
        line: entry.line,
        name: entry.name,
        msg: '函数体含 throw new 但 JSDoc 缺少 @throws',
      })
    }
  }

  if (needsTypeOverview(source, filePath)) {
    const overview = extractFileOverview(source)

    if (!overview) {
      violations.push({
        line: 1,
        name: 'fileoverview',
        msg: '类型文件缺少顶部说明注释',
      })
    } else {
      const desc = extractDescription(overview)
      for (const msg of checkDescription(desc)) {
        violations.push({ line: 1, name: 'fileoverview', msg })
      }
      if (!checkHasChinese(desc)) {
        violations.push({
          line: 1,
          name: 'fileoverview',
          msg: '类型文件说明须包含中文描述',
        })
      }
    }
  }

  return violations
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2)
  let files

  if (args.length > 0) {
    files = args
      .map((f) => (f.startsWith('/') ? f : join(ROOT, f)))
      .filter((f) => existsSync(f) && isTargetFile(f))
  } else {
    files = collectTargetFiles()
  }

  if (files.length === 0) {
    console.log('⊘ JSDoc 质量検査：対象ファイルなし')
    process.exit(0)
  }

  let total = 0

  for (const f of files) {
    const vs = checkFile(f)
    const rel = relative(ROOT, f)
    for (const v of vs) {
      if (IS_CI) {
        console.error(`::error file=${rel},line=${v.line}::${v.name}: ${v.msg}`)
      } else {
        console.error(`  ${rel}:${v.line} [${v.name}] ${v.msg}`)
      }
      total++
    }
  }

  if (total > 0) {
    console.error(`\n❌ JSDoc 質量検査：${total} 件の問題を検出`)
    process.exit(1)
  }

  console.log(`✓ JSDoc 質量検査 OK（${files.length} ファイル）`)
}

main()
