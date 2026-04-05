/**
 * 签证 CSV 本地结构校验结果类型（与预览表格行展示字段对齐）。
 */

/** 单行本地校验结果（物理行号与预览 `rowNumber` 对齐）。 */
export interface VisaCaseImportLocalAnalyzeRow {
  sourceLineNumber: number
  recordType: string
  errors: Array<{ code: string; message: string }>
  warnings: Array<{ code: string; message: string }>
}

/** 整表本地校验结果。 */
export interface VisaCaseImportLocalAnalyzeResult {
  blockingFileErrors: Array<{ code: string; message: string }>
  rows: VisaCaseImportLocalAnalyzeRow[]
}
