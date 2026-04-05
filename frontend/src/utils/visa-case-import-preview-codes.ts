/**
 * 历史签证 CSV 导入预览层错误码与警告码字面量（与 `docs/24` §6 / §6.1、
 * `backend/.../visa-case-import.constants.ts` 对齐），供表格展示、对账测试与类型收窄。
 */

/** docs/24 §6：`VisaCaseImportErrorCode` 全量键。 */
export const VisaCaseImportPreviewErrorCode = {
  EMPTY_FILE: 'EMPTY_FILE',
  MISSING_HEADER_ROW: 'MISSING_HEADER_ROW',
  MISSING_RECORD_TYPE_COLUMN: 'MISSING_RECORD_TYPE_COLUMN',
  INVALID_RECORD_TYPE: 'INVALID_RECORD_TYPE',
  MISSING_SERVICE_CUSTOMER: 'MISSING_SERVICE_CUSTOMER',
  CUSTOMER_NOT_FOUND: 'CUSTOMER_NOT_FOUND',
  CUSTOMER_CODE_AMBIGUOUS: 'CUSTOMER_CODE_AMBIGUOUS',
  CUSTOMER_INACTIVE: 'CUSTOMER_INACTIVE',
  INVALID_UUID: 'INVALID_UUID',
  DUPLICATE_LEGACY_REF_IN_FILE: 'DUPLICATE_LEGACY_REF_IN_FILE',
  INTERNAL_REQUIRES_PRIMARY: 'INTERNAL_REQUIRES_PRIMARY',
  EXTERNAL_REQUIRES_NAME: 'EXTERNAL_REQUIRES_NAME',
  INVALID_ENUM: 'INVALID_ENUM',
  INVALID_DATE: 'INVALID_DATE',
  INVALID_BOOLEAN: 'INVALID_BOOLEAN',
  LEGACY_REF_REQUIRED: 'LEGACY_REF_REQUIRED',
  ORPHAN_FAMILY_ROW: 'ORPHAN_FAMILY_ROW',
  ORPHAN_FILE_PATH_ROW: 'ORPHAN_FILE_PATH_ROW',
  ORPHAN_LOG_ROW: 'ORPHAN_LOG_ROW',
  LOG_TYPE_REQUIRED: 'LOG_TYPE_REQUIRED',
  LOG_CONTENT_REQUIRED: 'LOG_CONTENT_REQUIRED',
  FILE_PATH_REQUIRED: 'FILE_PATH_REQUIRED',
  MEMBER_CUSTOMER_REQUIRED: 'MEMBER_CUSTOMER_REQUIRED',
  DISPLAY_NAME_REQUIRED: 'DISPLAY_NAME_REQUIRED',
} as const

/** docs/24 §6.1：预览警告码。 */
export const VisaCaseImportPreviewWarningCode = {
  FILE_PATH_DUPLICATE_IN_FILE: 'FILE_PATH_DUPLICATE_IN_FILE',
} as const

/** docs/24 §6 表列出的全部预览错误码（含预留 `MISSING_HEADER_ROW`），用于契约测试。 */
export const VISA_CASE_IMPORT_DOCS24_SECTION6_ERROR_CODES: readonly string[] = [
  VisaCaseImportPreviewErrorCode.EMPTY_FILE,
  VisaCaseImportPreviewErrorCode.MISSING_HEADER_ROW,
  VisaCaseImportPreviewErrorCode.MISSING_RECORD_TYPE_COLUMN,
  VisaCaseImportPreviewErrorCode.INVALID_RECORD_TYPE,
  VisaCaseImportPreviewErrorCode.MISSING_SERVICE_CUSTOMER,
  VisaCaseImportPreviewErrorCode.CUSTOMER_NOT_FOUND,
  VisaCaseImportPreviewErrorCode.CUSTOMER_CODE_AMBIGUOUS,
  VisaCaseImportPreviewErrorCode.CUSTOMER_INACTIVE,
  VisaCaseImportPreviewErrorCode.INVALID_UUID,
  VisaCaseImportPreviewErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
  VisaCaseImportPreviewErrorCode.INTERNAL_REQUIRES_PRIMARY,
  VisaCaseImportPreviewErrorCode.EXTERNAL_REQUIRES_NAME,
  VisaCaseImportPreviewErrorCode.INVALID_ENUM,
  VisaCaseImportPreviewErrorCode.INVALID_DATE,
  VisaCaseImportPreviewErrorCode.INVALID_BOOLEAN,
  VisaCaseImportPreviewErrorCode.LEGACY_REF_REQUIRED,
  VisaCaseImportPreviewErrorCode.ORPHAN_FAMILY_ROW,
  VisaCaseImportPreviewErrorCode.ORPHAN_FILE_PATH_ROW,
  VisaCaseImportPreviewErrorCode.ORPHAN_LOG_ROW,
  VisaCaseImportPreviewErrorCode.LOG_TYPE_REQUIRED,
  VisaCaseImportPreviewErrorCode.LOG_CONTENT_REQUIRED,
  VisaCaseImportPreviewErrorCode.FILE_PATH_REQUIRED,
  VisaCaseImportPreviewErrorCode.MEMBER_CUSTOMER_REQUIRED,
  VisaCaseImportPreviewErrorCode.DISPLAY_NAME_REQUIRED,
]

/** docs/24 §6.1 警告码列表。 */
export const VISA_CASE_IMPORT_DOCS24_SECTION61_WARNING_CODES: readonly string[] = [
  VisaCaseImportPreviewWarningCode.FILE_PATH_DUPLICATE_IN_FILE,
]

/**
 * 从预览接口响应体中收集出现过的 `errors[]` / `warnings[]` / `blockingFileErrors` 的 `code`，便于契约与 UI 回归。
 *
 * @param result - 与 `VisaCaseImportPreviewResult` 同形的只读对象
 * @param result.blockingFileErrors - 文件级阻断错误列表
 * @param result.rows - 数据行预览结果（含行级 errors / warnings）
 * @returns 去重后的码列表（顺序不稳定）
 */
export function collectVisaCaseImportPreviewCodesFromResponse(result: {
  readonly blockingFileErrors: readonly { readonly code: string }[]
  readonly rows: readonly {
    readonly errors: readonly { readonly code: string }[]
    readonly warnings: readonly { readonly code: string }[]
  }[]
}): string[] {
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
