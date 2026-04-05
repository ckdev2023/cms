import type {
  FamilyRelation,
  FilePathType,
  MaterialItemScope,
  MaterialItemStatus,
  MaterialStatus,
  VisaCaseLogType,
  VisaCaseStatus,
  VisaReminderType,
} from '../../common/constants/enums';

/**
 * 按案件状态聚合的件数，用于签证域统计 API。
 */
export type VisaCaseStatusCountDto = {
  caseStatus: VisaCaseStatus;
  count: number;
};

/**
 * 按 P0 提醒桶去重后的案件计数，含未命中任一桶的「其他」件数。
 */
export type VisaDomainReminderBucketStatsDto = {
  supplement: number;
  todayFollowUp: number;
  expiring7Days: number;
  expiring2Months: number;
  noBucket: number;
};

/**
 * 签证域只读统计响应，与 `docs/25` §5 KPI 及 `/visa-reminders` 桶规则对齐。
 */
export type VisaDomainStatsDto = {
  caseStatusCounts: VisaCaseStatusCountDto[];
  reminderBuckets: VisaDomainReminderBucketStatsDto;
  /** 未完结未取消案件中 `expire_date` 距今日日历天数 ≤7（含已过期）的件数 */
  expiringWithin7DaysWindow: number;
  /** 未完结未取消案件中「今日待跟进」条件满足的件数（与桶内今日跟进计数可并存为独立 KPI） */
  todayFollowUpCount: number;
  /** 未完结未取消案件中补件状态或最新日志命中补件规则的件数 */
  supplementRelatedCount: number;
  /** 全部非软删案件中 `assigned_to` 为空的件数；传入 `assignedTo` 筛选时固定为 0 */
  unassignedCount: number;
};

/**
 * 签证案件 API 层使用的家属成员响应结构，与控制器序列化字段一致。
 */
export type FamilyMemberResponseDto = {
  id: string;
  customerId: string;
  customerName: string | null;
  memberRole: string;
  isPrimary: boolean;
  displayNameSnapshot: string;
};

/**
 * 签证案件详情与列表项的扁平响应结构，聚合负责人与家属展示字段。
 */
export type VisaCaseResponseDto = {
  id: string;
  customerId: string;
  caseType: string | null;
  caseStatus: VisaCaseStatus;
  isFamilyCase: boolean;
  familyLinkMode: string | null;
  internalPrimaryCustomerId: string | null;
  internalPrimaryCustomerName: string | null;
  externalPrimaryName: string | null;
  externalPrimaryCaseType: string | null;
  externalPrimaryExpireDate: Date | null;
  externalPrimaryRelationToApplicant: FamilyRelation | null;
  assignedTo: string | null;
  assigneeName: string | null;
  expireDate: Date | null;
  nextFollowUpAt: Date | null;
  materialStatus: string | null;
  feeStatus: string | null;
  memo: string | null;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: Date;
  updatedAt: Date;
  familyMembers: FamilyMemberResponseDto[];
  /** 全局列表等场景在已加载 `customer` 关联时附带 */
  customerName?: string | null;
  /** 全局列表等场景在已加载 `customer` 关联时附带 */
  customerCode?: string | null;
};

/**
 * 签证案件分页列表响应包装，含统一分页元数据。
 */
export type VisaCaseListResponse = {
  items: VisaCaseResponseDto[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * 单条案件日志的扁平响应结构，含结构化跟进字段与创建人展示名。
 */
export type VisaCaseLogResponseDto = {
  id: string;
  visaCaseId: string;
  customerId: string;
  logType: VisaCaseLogType;
  content: string;
  submittedItems: string | null;
  missingItems: string | null;
  nextAction: string | null;
  nextFollowUpAt: Date | null;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 案件日志分页列表响应包装。
 */
export type VisaCaseLogListResponse = {
  items: VisaCaseLogResponseDto[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * 客户资料路径台账单条响应结构。
 */
export type CustomerFilePathResponseDto = {
  id: string;
  customerId: string;
  visaCaseId: string | null;
  pathType: FilePathType;
  filePath: string;
  displayName: string | null;
  remark: string | null;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 资料路径分页列表响应包装。
 */
export type CustomerFilePathListResponse = {
  items: CustomerFilePathResponseDto[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * 提醒列表中单行提醒项，含桶类型与到期余量天数。
 */
export type VisaReminderItemDto = {
  id: string;
  customerId: string;
  customerName: string;
  caseType: string | null;
  caseStatus: VisaCaseStatus;
  assignedTo: string | null;
  assigneeName: string | null;
  expireDate: Date | null;
  nextFollowUpAt: Date | null;
  materialStatus: string | null;
  reminderType: VisaReminderType;
  daysLeft: number | null;
  alertLevel: string | null;
};

/**
 * 四类提醒桶的计数汇总，用于列表页摘要展示。
 */
export type VisaReminderSummary = {
  supplement: number;
  todayFollowUp: number;
  expiring7Days: number;
  expiring2Months: number;
};

/**
 * 工作台每桶 Top N 提醒预览，字段语义与 `VisaReminderItemDto` / `GET /visa-reminders` 一致。
 */
export type VisaWorkbenchReminderPreviewsDto = {
  supplement: VisaReminderItemDto[];
  todayFollowUp: VisaReminderItemDto[];
  expiring7Days: VisaReminderItemDto[];
  expiring2Months: VisaReminderItemDto[];
};

/**
 * 签证工作台只读聚合载荷：`stats` 与 `GET /visa-cases/stats` 同源；预览与提醒列表同源计算。
 */
export type VisaWorkbenchAggregateDto = {
  stats: VisaDomainStatsDto;
  reminderPreviews: VisaWorkbenchReminderPreviewsDto;
};

/**
 * 签证提醒分页列表响应，含桶筛选后的分页结果与汇总。
 */
export type VisaReminderListResponse = {
  items: VisaReminderItemDto[];
  total: number;
  page: number;
  pageSize: number;
  summary: VisaReminderSummary;
};

/**
 * 模板材料项响应结构。
 */
export type MaterialTemplateItemResponseDto = {
  id: string;
  groupName: string;
  itemName: string;
  scope: MaterialItemScope;
  sortOrder: number;
  isRequired: boolean;
};

/**
 * 材料模板详情响应结构，含全部模板项。
 */
export type MaterialTemplateResponseDto = {
  id: string;
  caseType: string;
  displayName: string;
  isActive: boolean;
  items: MaterialTemplateItemResponseDto[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 案件材料实例响应结构，含模板来源与家属归属信息。
 */
export type VisaCaseMaterialItemResponseDto = {
  id: string;
  visaCaseId: string;
  templateItemId: string | null;
  visaCaseFamilyMemberId: string | null;
  familyMemberName: string | null;
  groupName: string;
  itemName: string;
  itemStatus: MaterialItemStatus;
  sortOrder: number;
  remark: string | null;
  collectedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 案件材料 checklist 建议摘要，含完成统计、当前持久化状态与建议 material_status。
 *
 * `currentStatus` 对应 `visa_cases.material_status` 的持久化值；
 * `suggestedStatus` 由 checklist 完成度实时计算。两者不一致时前端提示操作员同步。
 */
export type MaterialSummaryResponseDto = {
  total: number;
  collected: number;
  notCollected: number;
  notApplicable: number;
  currentStatus: MaterialStatus | null;
  suggestedStatus: MaterialStatus;
};
