/**
 * 签证 CSV 本地结构校验共用：解析辅助函数与客户键解析（与后端 preview 解析一致，无 DB）。
 */

import { VisaCaseImportPreviewErrorCode } from './visa-case-import-preview-codes'

/** 与后端预览服务相同的 UUID 校验正则。 */
export const VISA_CASE_IMPORT_LOCAL_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export const VISA_CASE_IMPORT_RT_CASE = 'CASE'
export const VISA_CASE_IMPORT_RT_FAMILY = 'FAMILY_MEMBER'
export const VISA_CASE_IMPORT_RT_FILE_PATH = 'FILE_PATH'
export const VISA_CASE_IMPORT_RT_CASE_LOG = 'CASE_LOG'

export type LocalCustomerKeyResult =
  | { ok: true; key: string }
  | { ok: false; code: string; message: string }

/**
 * 将规范化表头与单元格数组折叠为列名字典（与后端 `rowToObject` 一致）。
 *
 * @param headers - 已小写的列名数组
 * @param cells - 与表头等长的单元格
 * @returns 列名到单元格字符串的映射（已 trim）
 */
export function visaCaseImportLocalRowToObject(
  headers: string[],
  cells: string[],
): Record<string, string> {
  const o: Record<string, string> = {}
  for (let i = 0; i < headers.length; i += 1) {
    const key = headers[i]
    if (!key) {
      continue
    }
    o[key] = (cells[i] ?? '').trim()
  }
  return o
}

/**
 * 将 `record_type` 规范为四种大写枚举值之一，非法或空串时返回空串。
 *
 * @param raw - CSV 单元格原文
 * @returns 合法记录类型或空串
 */
export function visaCaseImportLocalNormalizeRecordType(raw: string): string {
  const u = raw.trim().toUpperCase()
  if (
    u === VISA_CASE_IMPORT_RT_CASE ||
    u === VISA_CASE_IMPORT_RT_FAMILY ||
    u === VISA_CASE_IMPORT_RT_FILE_PATH ||
    u === VISA_CASE_IMPORT_RT_CASE_LOG
  ) {
    return u
  }
  return ''
}

/**
 * 非空则返回 trim 后字符串，否则返回 null。
 *
 * @param v - 可选列值
 * @returns 非空串或 null
 */
export function visaCaseImportLocalTrimOrNull(v: string | undefined): string | null {
  const t = v?.trim() ?? ''
  return t.length > 0 ? t : null
}

/**
 * 解析 docs/24 §4.3 布尔列；无法识别且原文非空时返回 null。
 *
 * @param raw - 单元格原文
 * @returns true / false / null（null 表示非空但非法）
 */
export function visaCaseImportLocalParseBool(raw: string | undefined): boolean | null {
  const v = raw?.trim().toLowerCase() ?? ''
  if (v === 'true' || v === '1' || v === 'yes') {
    return true
  }
  if (v === 'false' || v === '0' || v === 'no' || v === '') {
    return v === '' ? null : false
  }
  return null
}

/**
 * 校验 `YYYY-MM-DD` 日期列；非法时返回哨兵 `'INVALID'`。
 *
 * @param raw - 单元格原文
 * @returns 规范化日期串、null（空）或 `'INVALID'`
 */
export function visaCaseImportLocalParseOptionalDate(
  raw: string | undefined,
): string | null | 'INVALID' {
  const t = raw?.trim() ?? ''
  if (!t) {
    return null
  }
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(t)) {
    return 'INVALID'
  }
  return t
}

/**
 * 校验可解析日期时间字符串；非法时返回 `'INVALID'`。
 *
 * @param raw - 单元格原文
 * @returns 原文、null 或 `'INVALID'`
 */
export function visaCaseImportLocalParseOptionalDateTime(
  raw: string | undefined,
): string | null | 'INVALID' {
  const t = raw?.trim() ?? ''
  if (!t) {
    return null
  }
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) {
    return 'INVALID'
  }
  return t
}

/**
 * 将单元格匹配到枚举字面量（大小写不敏感）。
 *
 * @param raw - 单元格原文
 * @param enumObj - 枚举对象
 * @param emptyOk - 空串是否视为合法「未填」
 * @returns 枚举值、空串、`'INVALID'`
 */
export function visaCaseImportLocalPickEnum<T extends string>(
  raw: string | undefined,
  enumObj: Record<string, T>,
  emptyOk: boolean,
): T | '' | 'INVALID' {
  const t = raw?.trim() ?? ''
  if (!t) {
    return emptyOk ? '' : 'INVALID'
  }
  const hit = (Object.values(enumObj) as string[]).find(
    (v) => v.toLowerCase() === t.toLowerCase(),
  )
  return (hit as T) ?? 'INVALID'
}

/**
 * 在不查库前提下解析服务上下文客户键：UUID 或 `code:` 前缀的 customer_code。
 *
 * @param obj - 当前行列字典
 * @returns 成功键或错误码
 */
export function visaCaseImportLocalResolveCustomerKey(
  obj: Record<string, string>,
): LocalCustomerKeyResult {
  const idRaw = obj.customer_id?.trim() ?? ''
  const codeRaw = obj.customer_code?.trim() ?? ''
  if (!idRaw && !codeRaw) {
    return {
      ok: false,
      code: VisaCaseImportPreviewErrorCode.MISSING_SERVICE_CUSTOMER,
      message: 'customer_id または customer_code のいずれかが必要です',
    }
  }
  if (idRaw) {
    if (!VISA_CASE_IMPORT_LOCAL_UUID_RE.test(idRaw)) {
      return {
        ok: false,
        code: VisaCaseImportPreviewErrorCode.INVALID_UUID,
        message: 'customer_id の UUID 形式が無効です',
      }
    }
    return { ok: true, key: idRaw.toLowerCase() }
  }
  return { ok: true, key: `code:${codeRaw.toLowerCase()}` }
}
