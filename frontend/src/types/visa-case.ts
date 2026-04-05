/**
 * 定义签证案件域的声明类型，供 API 层与页面组件统一复用。
 */
import type {
  FamilyLinkMode,
  FamilyRelation,
  FilePathType,
  MaterialItemScope,
  MaterialItemStatus,
  MaterialStatus,
  VisaCaseFeeStatus,
  VisaCaseLogType,
  VisaCaseStatus,
  VisaDataScope,
  VisaReminderType,
} from '@/constants/enums'

export interface VisaCaseFamilyMemberItem {
  id: string
  customerId: string
  customerName: string | null
  memberRole: string
  isPrimary: boolean
  displayNameSnapshot: string
}

export interface VisaCaseItem {
  id: string
  customerId: string
  /** 全局案件列表等在已加载客户关联时附带 */
  customerName?: string | null
  /** 全局案件列表等在已加载客户关联时附带 */
  customerCode?: string | null
  caseType: string | null
  caseStatus: VisaCaseStatus
  isFamilyCase: boolean
  familyLinkMode: FamilyLinkMode | null
  internalPrimaryCustomerId: string | null
  internalPrimaryCustomerName: string | null
  externalPrimaryName: string | null
  externalPrimaryCaseType: string | null
  externalPrimaryExpireDate: string | null
  /** EXTERNAL 家族签下外部主申与本案系统内申请人的家属关系口径（与 `FamilyRelation` 一致）。 */
  externalPrimaryRelationToApplicant: FamilyRelation | null
  assignedTo: string | null
  assigneeName: string | null
  expireDate: string | null
  nextFollowUpAt: string | null
  materialStatus: string | null
  feeStatus: VisaCaseFeeStatus | null
  memo: string | null
  createdBy: string | null
  creatorName: string | null
  createdAt: string
  updatedAt: string
  familyMembers: VisaCaseFamilyMemberItem[]
}

export interface CreateVisaCaseParams {
  customerId: string
  caseType?: string
  caseStatus?: VisaCaseStatus
  isFamilyCase?: boolean
  familyLinkMode?: FamilyLinkMode
  internalPrimaryCustomerId?: string
  externalPrimaryName?: string
  externalPrimaryCaseType?: string
  externalPrimaryExpireDate?: string
  externalPrimaryRelationToApplicant?: FamilyRelation
  assignedTo?: string
  expireDate?: string
  nextFollowUpAt?: string
  materialStatus?: string
  feeStatus?: VisaCaseFeeStatus
  memo?: string
}

export interface UpdateVisaCaseParams {
  caseType?: string
  caseStatus?: VisaCaseStatus
  isFamilyCase?: boolean
  familyLinkMode?: FamilyLinkMode
  internalPrimaryCustomerId?: string
  externalPrimaryName?: string
  externalPrimaryCaseType?: string
  externalPrimaryExpireDate?: string
  externalPrimaryRelationToApplicant?: FamilyRelation
  assignedTo?: string
  expireDate?: string
  nextFollowUpAt?: string
  materialStatus?: string
  feeStatus?: VisaCaseFeeStatus
  memo?: string
}

export interface VisaCaseQueryParams {
  page?: number
  pageSize?: number
  caseStatus?: VisaCaseStatus
  assignedTo?: string
  materialStatus?: string
}

/** 跨客户签证案件登记册分页查询参数，与后端 `QueryGlobalVisaCaseListDto` 对齐。 */
export interface GlobalVisaCaseQueryParams {
  page?: number
  pageSize?: number
  customerId?: string
  customerKeyword?: string
  caseStatuses?: VisaCaseStatus[]
  assignedToIds?: string[]
  unassignedOnly?: boolean
  materialStatuses?: MaterialStatus[]
  feeStatuses?: VisaCaseFeeStatus[]
  expireDateFrom?: string
  expireDateTo?: string
  nextFollowUpAtFrom?: string
  nextFollowUpAtTo?: string
  isFamilyCase?: boolean
  familyLinkMode?: FamilyLinkMode
  supplementRelated?: boolean
  reminderBucket?: VisaReminderType
  /** 与后端 `QueryGlobalVisaCaseListDto.dataScope` 一致（P2-S2e） */
  dataScope?: VisaDataScope
  [key: string]: unknown
}

export interface VisaCaseLogItem {
  id: string
  visaCaseId: string
  customerId: string
  logType: VisaCaseLogType
  content: string
  submittedItems: string | null
  missingItems: string | null
  nextAction: string | null
  nextFollowUpAt: string | null
  createdBy: string | null
  creatorName: string | null
  createdAt: string
  updatedAt: string
}

/** 案件日志新增/编辑表单与 `el-form` 绑定的字段形状 */
export interface VisaCaseLogFormModelState {
  logType: VisaCaseLogType
  content: string
  submittedItems: string
  missingItems: string
  nextAction: string
  nextFollowUpAt: string
}

export interface CreateVisaCaseLogParams {
  logType: VisaCaseLogType
  content: string
  submittedItems?: string
  missingItems?: string
  nextAction?: string
  nextFollowUpAt?: string
}

export interface UpdateVisaCaseLogParams {
  logType?: VisaCaseLogType
  content?: string
  submittedItems?: string
  missingItems?: string
  nextAction?: string
  nextFollowUpAt?: string
}

export interface VisaCaseLogQueryParams {
  page?: number
  pageSize?: number
  logType?: VisaCaseLogType
  sortOrder?: 'ASC' | 'DESC'
}

export interface CreateFamilyMemberParams {
  customerId: string
  memberRole: string
  isPrimary?: boolean
  displayNameSnapshot: string
}

export interface UpdateFamilyMemberParams {
  memberRole?: string
  isPrimary?: boolean
  displayNameSnapshot?: string
}

export interface CustomerFilePathItem {
  id: string
  customerId: string
  visaCaseId: string | null
  pathType: FilePathType
  filePath: string
  displayName: string | null
  remark: string | null
  createdBy: string | null
  creatorName: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateCustomerFilePathParams {
  customerId: string
  visaCaseId?: string
  pathType?: FilePathType
  filePath: string
  displayName?: string
  remark?: string
}

export interface UpdateCustomerFilePathParams {
  visaCaseId?: string
  pathType?: FilePathType
  filePath?: string
  displayName?: string
  remark?: string
}

export interface CustomerFilePathQueryParams {
  page?: number
  pageSize?: number
  pathType?: FilePathType
}

export interface VisaReminderItem {
  id: string
  customerId: string
  customerName: string
  caseType: string | null
  caseStatus: VisaCaseStatus
  assignedTo: string | null
  assigneeName: string | null
  expireDate: string | null
  nextFollowUpAt: string | null
  materialStatus: string | null
  reminderType: VisaReminderType
  daysLeft: number | null
}

export interface VisaReminderQueryParams {
  page?: number
  pageSize?: number
  reminderType?: VisaReminderType
  assignedTo?: string
  dataScope?: VisaDataScope
  [key: string]: unknown
}

export interface MaterialTemplateItem {
  id: string
  templateId: string
  groupName: string
  itemName: string
  scope: MaterialItemScope
  sortOrder: number
  isRequired: boolean
  createdAt: string
  updatedAt: string
}

export interface MaterialTemplateDetail {
  id: string
  caseType: string
  displayName: string
  isActive: boolean
  items: MaterialTemplateItem[]
  createdAt: string
  updatedAt: string
}

export interface MaterialTemplateListItem {
  id: string
  caseType: string
  displayName: string
  isActive: boolean
  itemCount: number
  createdAt: string
  updatedAt: string
}

export interface VisaCaseMaterialItemDetail {
  id: string
  visaCaseId: string
  templateItemId: string | null
  visaCaseFamilyMemberId: string | null
  familyMemberName: string | null
  groupName: string
  itemName: string
  itemStatus: MaterialItemStatus
  sortOrder: number
  remark: string | null
  collectedAt: string | null
  createdBy: string | null
  creatorName: string | null
  createdAt: string
  updatedAt: string
}

export interface MaterialSummary {
  total: number
  collected: number
  notCollected: number
  notApplicable: number
  currentStatus: string | null
  suggestedStatus: string
}

export interface UpdateVisaCaseMaterialItemParams {
  itemStatus?: MaterialItemStatus
  remark?: string
  sortOrder?: number
}

export interface VisaCaseLogPreFillData {
  visaCaseId: string
  logType: VisaCaseLogType
  content: string
  submittedItems: string
  missingItems: string
}

export interface CreateVisaCaseMaterialItemParams {
  groupName: string
  itemName: string
  scope?: MaterialItemScope
  visaCaseFamilyMemberId?: string
  sortOrder?: number
  remark?: string
}

/** 历史签证 CSV 导入预览行级错误项。 */
export interface VisaCaseImportPreviewErrorItem {
  code: string
  message: string
}

/** 历史签证 CSV 导入 dry-run 单行结果。 */
export interface VisaCaseImportPreviewRow {
  rowNumber: number
  recordType: string
  status: string
  errors: VisaCaseImportPreviewErrorItem[]
  warnings: VisaCaseImportPreviewErrorItem[]
  resolved?: Record<string, unknown>
}

/** 历史签证 CSV 导入预览整体响应（与后端 `VisaCaseImportPreviewResultDto` 对齐）。 */
export interface VisaCaseImportPreviewResult {
  dryRun: true
  contentSha256: string
  blockingFileErrors: VisaCaseImportPreviewErrorItem[]
  summary: {
    rowCount: number
    okRowCount: number
    errorRowCount: number
    warningRowCount: number
    duplicateSkippedRowCount: number
    canProceed: boolean
  }
  rows: VisaCaseImportPreviewRow[]
}

/** 历史签证 CSV 导入单行提交结果。 */
export interface VisaCaseImportCommitRowResult {
  rowNumber: number
  recordType: string
  outcome: string
  message?: string
  errorCode?: string
  visaCaseId?: string
  entityId?: string
}

/** 历史签证 CSV 导入批次提交响应。 */
export interface VisaCaseImportCommitResult {
  importBatchId: string
  contentSha256: string
  fileName: string | null
  /** 操作者用户 UUID，与 `visa_case_import_batches.created_by` 及审计日志一致。 */
  createdBy: string | null
  /** 批次写入时间 ISO8601，可与批次表 `created_at` 对账。 */
  createdAt: string
  summary: {
    rowCount: number
    createdCaseCount: number
    skippedDuplicateCaseCount: number
    addedMemberCount: number
    createdFilePathCount: number
    createdLogCount: number
    failedRowCount: number
  }
  rows: VisaCaseImportCommitRowResult[]
}

/** 导入成功批次表 `summary` JSON 与 commit 响应汇总字段对齐。 */
export interface VisaCaseImportBatchSummary {
  fileName: string | null
  rowCount: number
  createdCaseCount: number
  skippedDuplicateCaseCount: number
  addedMemberCount: number
  createdFilePathCount: number
  createdLogCount: number
  failedRowCount: number
}

/**
 * 只读批次审计项（`GET /visa-cases/import/batches`），与 `docs/23` §6.4、`docs/24` §3.5 对账字段一致。
 */
export interface VisaCaseImportBatchAuditItem {
  importBatchId: string
  contentSha256: string
  createdBy: string | null
  createdByDisplayName: string | null
  createdAt: string
  summary: VisaCaseImportBatchSummary | null
}

/** P2-S3d：行政案件→签证补录预览行（与后端 DTO 对齐）。 */
export interface AdminCaseVisaSupplementPreviewRow {
  rowNumber: number
  adminCaseId: string
  status: string
  errors: { code: string; message: string }[]
  warnings: { code: string; message: string }[]
  customerId: string | null
  adminCaseName: string | null
  existingVisaCaseId?: string
  proposed?: {
    caseType: string | null
    caseStatus: VisaCaseStatus
    expireDate: string | null
    assignedTo: string | null
    importReference: string
    memoPreview: string
  }
}

/** P2-S3d：补录预览响应。 */
export interface AdminCaseVisaSupplementPreviewResult {
  contentSha256: string
  summary: {
    rowCount: number
    okCount: number
    warningRowCount: number
    errorCount: number
    duplicateSkippedCount: number
    canProceed: boolean
  }
  rows: AdminCaseVisaSupplementPreviewRow[]
}

/** P2-S3d：补录提交单行结果。 */
export interface AdminCaseVisaSupplementCommitRowResult {
  adminCaseId: string
  outcome: string
  message?: string
  errorCode?: string
  visaCaseId?: string
}

/** P2-S3d：补录提交整批响应。 */
export interface AdminCaseVisaSupplementCommitResult {
  supplementBatchId: string
  contentSha256: string
  summary: {
    rowCount: number
    createdCaseCount: number
    skippedDuplicateCount: number
    failedRowCount: number
  }
  rows: AdminCaseVisaSupplementCommitRowResult[]
}

/**
 * 与后端 `QueryVisaCaseStatsDto` 对齐的签证域统计查询参数：
 * 与登记册 `GlobalVisaCaseQueryParams` 同构筛选（无分页），并保留单一 `assignedTo` 供工作台等旧路径。
 */
export type VisaDomainStatsQueryParams = Omit<
  GlobalVisaCaseQueryParams,
  'page' | 'pageSize'
> & {
  assignedTo?: string
}

/** 提醒桶去重计数，与 `/visa-reminders` 桶规则一致。 */
export interface VisaDomainReminderBucketStats {
  supplement: number
  todayFollowUp: number
  expiring7Days: number
  expiring2Months: number
  noBucket: number
}

/** 单状态件数，对应后端 `VisaCaseStatusCountDto`。 */
export interface VisaCaseStatusCountItem {
  caseStatus: VisaCaseStatus
  count: number
}

/** 签证域只读统计响应，与 `GET /visa-cases/stats` 对齐。 */
export interface VisaDomainStats {
  caseStatusCounts: VisaCaseStatusCountItem[]
  reminderBuckets: VisaDomainReminderBucketStats
  expiringWithin7DaysWindow: number
  todayFollowUpCount: number
  supplementRelatedCount: number
  unassignedCount: number
}

/** 与 `GET /visa-reminders` 列表 `summary` 字段对齐的四类桶计数。 */
export interface VisaReminderSummaryCounts {
  supplement: number
  todayFollowUp: number
  expiring7Days: number
  expiring2Months: number
}

/** 工作台 `GET /workbench/visa` 返回的每桶 Top N 预览，行结构同 `VisaReminderItem`。 */
export interface VisaWorkbenchReminderPreviews {
  supplement: VisaReminderItem[]
  todayFollowUp: VisaReminderItem[]
  expiring7Days: VisaReminderItem[]
  expiring2Months: VisaReminderItem[]
}

/** 与后端 `QueryVisaWorkbenchDto` 对齐的工作台聚合查询参数。 */
export interface VisaWorkbenchQueryParams {
  assignedTo?: string
  dataScope?: VisaDataScope
  /** 每桶预览条数，0–20，默认 5；0 表示仅拉取 stats */
  previewLimit?: number
}

/**
 * 工作台只读聚合响应，与 `GET /workbench/visa` 对齐；
 * 统计同 `/visa-cases/stats`，预览行同 `/visa-reminders` 分类与排序。
 */
export interface VisaWorkbenchAggregate {
  stats: VisaDomainStats
  reminderPreviews: VisaWorkbenchReminderPreviews
}
