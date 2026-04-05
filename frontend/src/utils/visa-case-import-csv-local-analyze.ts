/**
 * 在不调用预览 API、不查库的前提下，对 UTF-8 CSV 做与后端同构的**结构层**校验，
 * 产出与 `docs/24` §6 一致的 `code`，供导入页预检单测与模板示例回归。
 *
 * 限制：无法产生依赖客户主档解析的码（如 `CUSTOMER_NOT_FOUND`）；此类码由 Vitest 对预览响应 mock 断言。
 */

import { parseImportCsvWithLineNumbers } from './visa-case-import-csv'
import {
  VISA_CASE_IMPORT_RT_CASE,
  visaCaseImportLocalNormalizeRecordType,
  visaCaseImportLocalResolveCustomerKey,
  visaCaseImportLocalRowToObject,
  visaCaseImportLocalTrimOrNull,
} from './visa-case-import-csv-local-helpers'
import type {
  VisaCaseImportLocalAnalyzeResult,
  VisaCaseImportLocalAnalyzeRow,
} from './visa-case-import-csv-local-types'
import { visaCaseImportLocalValidateRow } from './visa-case-import-csv-local-validate'
import { VisaCaseImportPreviewErrorCode } from './visa-case-import-preview-codes'

export type { VisaCaseImportLocalAnalyzeResult, VisaCaseImportLocalAnalyzeRow } from './visa-case-import-csv-local-types'

type RowObjectEntry = { sourceLineNumber: number; obj: Record<string, string> }

/**
 * 扫描 CASE 行 legacy 键计数并在重复时写入文件级阻断错误。
 *
 * @param rowObjects - 已解析的数据行对象列表
 * @param blockingFileErrors - 待追加阻断错误的数组（原地修改）
 */
function appendDuplicateLegacyBlocking(
  rowObjects: RowObjectEntry[],
  blockingFileErrors: Array<{ code: string; message: string }>,
): void {
  const legacyKeyCounts = new Map<string, number>()
  for (const { obj } of rowObjects) {
    const rt = visaCaseImportLocalNormalizeRecordType(obj.record_type)
    if (rt !== VISA_CASE_IMPORT_RT_CASE) {
      continue
    }
    const ref = visaCaseImportLocalTrimOrNull(obj.legacy_case_ref)
    if (!ref) {
      continue
    }
    const cr = visaCaseImportLocalResolveCustomerKey(obj)
    if (!cr.ok) {
      continue
    }
    const k = `${cr.key}\t${ref}`
    legacyKeyCounts.set(k, (legacyKeyCounts.get(k) ?? 0) + 1)
  }
  for (const [, n] of legacyKeyCounts) {
    if (n > 1) {
      blockingFileErrors.push({
        code: VisaCaseImportPreviewErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
        message: '同一顧客・legacy_case_ref の CASE 行が CSV 内で重複しています',
      })
      break
    }
  }
}

/**
 * 从已解析行构建「服务客户键 + legacy ref」的 CASE 组集合，供从属行 orphan 校验。
 *
 * @param rowObjects - 已解析的数据行对象列表
 * @returns CASE 组键集合
 */
function buildCaseGroups(rowObjects: RowObjectEntry[]): Set<string> {
  const caseGroups = new Set<string>()
  for (const { obj } of rowObjects) {
    const rt = visaCaseImportLocalNormalizeRecordType(obj.record_type)
    if (rt !== VISA_CASE_IMPORT_RT_CASE) {
      continue
    }
    const ref = visaCaseImportLocalTrimOrNull(obj.legacy_case_ref)
    if (!ref) {
      continue
    }
    const cr = visaCaseImportLocalResolveCustomerKey(obj)
    if (cr.ok) {
      caseGroups.add(`${cr.key}\t${ref}`)
    }
  }
  return caseGroups
}

/**
 * 解析 CSV 文本并输出与后端预览同构的错误码（无 DB 部分）。
 *
 * @param text - 完整 CSV 文本
 * @returns 文件级阻断与逐行 errors/warnings
 */
export function analyzeVisaCaseImportCsvLocal(text: string): VisaCaseImportLocalAnalyzeResult {
  const blockingFileErrors: Array<{ code: string; message: string }> = []
  const { headers, dataRows } = parseImportCsvWithLineNumbers(text)

  if (headers.length === 0 && dataRows.length === 0) {
    blockingFileErrors.push({
      code: VisaCaseImportPreviewErrorCode.EMPTY_FILE,
      message: 'CSV が空です',
    })
    return { blockingFileErrors, rows: [] }
  }

  if (!headers.includes('record_type')) {
    blockingFileErrors.push({
      code: VisaCaseImportPreviewErrorCode.MISSING_RECORD_TYPE_COLUMN,
      message: '必須列がありません: record_type',
    })
    return { blockingFileErrors, rows: [] }
  }

  const rowObjects: RowObjectEntry[] = dataRows.map((dr) => ({
    sourceLineNumber: dr.sourceLineNumber,
    obj: visaCaseImportLocalRowToObject(headers, dr.cells),
  }))

  appendDuplicateLegacyBlocking(rowObjects, blockingFileErrors)

  const blockingDuplicateLegacy = blockingFileErrors.some(
    (e) => e.code === VisaCaseImportPreviewErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
  )

  const caseGroups = buildCaseGroups(rowObjects)
  const filePathKeys = new Map<string, number>()
  const rows: VisaCaseImportLocalAnalyzeRow[] = []

  for (const { sourceLineNumber, obj } of rowObjects) {
    rows.push(
      visaCaseImportLocalValidateRow({
        sourceLineNumber,
        obj,
        caseGroups,
        filePathKeys,
        blockingDuplicateLegacy,
      }),
    )
  }

  return { blockingFileErrors, rows }
}

/**
 * 收集本地分析结果中出现过的所有错误码与警告码（含文件级阻断）。
 *
 * @param result - `analyzeVisaCaseImportCsvLocal` 的返回值
 * @returns 去重后的码列表
 */
export function collectVisaCaseImportLocalAnalyzeCodes(
  result: VisaCaseImportLocalAnalyzeResult,
): string[] {
  const set = new Set<string>()
  for (const e of result.blockingFileErrors) {
    set.add(e.code)
  }
  for (const row of result.rows) {
    for (const e of row.errors) {
      set.add(e.code)
    }
    for (const w of row.warnings) {
      set.add(w.code)
    }
  }
  return [...set]
}
