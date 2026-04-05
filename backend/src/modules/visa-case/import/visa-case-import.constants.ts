/**
 * 历史签证 CSV 导入预览层使用的记录类型、错误码与行状态常量，供 S3b 与后续 S3c/S3e 对齐。
 */

/** 模板 `record_type` 列允许的值。 */
export const VisaCaseImportRecordType = {
  CASE: 'CASE',
  FAMILY_MEMBER: 'FAMILY_MEMBER',
  FILE_PATH: 'FILE_PATH',
  CASE_LOG: 'CASE_LOG',
} as const;

export type VisaCaseImportRecordTypeValue =
  (typeof VisaCaseImportRecordType)[keyof typeof VisaCaseImportRecordType];

/** 行级或文件级校验错误码（与 docs/23 衔接，供前端与报告展示）。 */
export const VisaCaseImportErrorCode = {
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
} as const;

/** 不阻断整批但需提示的警告码。 */
export const VisaCaseImportWarningCode = {
  FILE_PATH_DUPLICATE_IN_FILE: 'FILE_PATH_DUPLICATE_IN_FILE',
} as const;

/** 预览行终态。 */
export const VisaCaseImportRowStatus = {
  OK: 'OK',
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  DUPLICATE_SKIPPED: 'DUPLICATE_SKIPPED',
} as const;

export type VisaCaseImportRowStatusValue =
  (typeof VisaCaseImportRowStatus)[keyof typeof VisaCaseImportRowStatus];

/** S3c 分批写入后单行结果终态。 */
export const VisaCaseImportCommitOutcome = {
  CASE_CREATED: 'CASE_CREATED',
  MEMBER_ADDED: 'MEMBER_ADDED',
  FILE_PATH_CREATED: 'FILE_PATH_CREATED',
  CASE_LOG_CREATED: 'CASE_LOG_CREATED',
  SKIPPED_DUPLICATE: 'SKIPPED_DUPLICATE',
  FAILED: 'FAILED',
} as const;

export type VisaCaseImportCommitOutcomeValue =
  (typeof VisaCaseImportCommitOutcome)[keyof typeof VisaCaseImportCommitOutcome];

/** 同一 CSV 内容（SHA-256）重复提交时的冲突码。 */
export const VisaCaseImportCommitErrorCode = {
  CSV_ALREADY_IMPORTED: 'CSV_ALREADY_IMPORTED',
} as const;

/** 模板必须包含的列名（小写）。 */
export const VISA_CASE_IMPORT_REQUIRED_HEADERS = ['record_type'] as const;
