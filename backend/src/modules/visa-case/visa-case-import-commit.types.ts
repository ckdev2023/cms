/** 单行写入结果，供前端下载报告与对账。 */
export interface VisaCaseImportCommitRowResultDto {
  rowNumber: number;
  recordType: string;
  outcome: string;
  message?: string;
  errorCode?: string;
  visaCaseId?: string;
  entityId?: string;
}

/** 整批提交响应，含批次 ID 与汇总计数。 */
export interface VisaCaseImportCommitResultDto {
  importBatchId: string;
  contentSha256: string;
  fileName: string | null;
  /** 操作者用户 UUID，与 `visa_case_import_batches.created_by` 及 `audit_logs.user_id` 一致。 */
  createdBy: string | null;
  /** 批次行写入时间 ISO8601，与 `visa_case_import_batches.created_at` 可对账。 */
  createdAt: string;
  summary: {
    rowCount: number;
    createdCaseCount: number;
    skippedDuplicateCaseCount: number;
    addedMemberCount: number;
    createdFilePathCount: number;
    createdLogCount: number;
    failedRowCount: number;
  };
  rows: VisaCaseImportCommitRowResultDto[];
}
