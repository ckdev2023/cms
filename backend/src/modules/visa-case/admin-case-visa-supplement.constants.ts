/**
 * 行政案件向签证域补录（P2-S3d）预览与提交阶段的错误码、终态常量。
 */

/** 预览或提交阶段的业务错误码（与前端展示、审计摘要衔接）。 */
export const AdminCaseVisaSupplementErrorCode = {
  EMPTY_ID_LIST: 'EMPTY_ID_LIST',
  ADMIN_CASE_NOT_FOUND: 'ADMIN_CASE_NOT_FOUND',
  DUPLICATE_ADMIN_CASE_IN_REQUEST: 'DUPLICATE_ADMIN_CASE_IN_REQUEST',
  BATCH_ALREADY_COMMITTED: 'BATCH_ALREADY_COMMITTED',
} as const;

/** 预览行状态。 */
export const AdminCaseVisaSupplementRowStatus = {
  OK: 'OK',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  DUPLICATE_SKIPPED: 'DUPLICATE_SKIPPED',
} as const;

/** 提交后单行 outcome。 */
export const AdminCaseVisaSupplementCommitOutcome = {
  CASE_CREATED: 'CASE_CREATED',
  SKIPPED_DUPLICATE: 'SKIPPED_DUPLICATE',
  FAILED: 'FAILED',
} as const;

/** 不阻断整批的警告码。 */
export const AdminCaseVisaSupplementWarningCode = {
  ADMIN_STATUS_WEAKLY_MAPPED: 'ADMIN_STATUS_WEAKLY_MAPPED',
} as const;

/** 单次请求允许的最大行政案件 ID 数量。 */
export const ADMIN_CASE_VISA_SUPPLEMENT_MAX_IDS = 500;
