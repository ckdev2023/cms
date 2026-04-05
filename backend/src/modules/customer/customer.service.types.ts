import type {
  CustomerType,
  FamilyLinkMode,
  FamilyRelation,
  MaterialStatus,
  VisaAlertLevel,
  VisaCaseStatus,
  VisaReminderType,
} from '../../common/constants/enums';
import type { Customer } from './entities/customer.entity';

/**
 * 客户列表接口允许参与动态排序的列名白名单，用于阻断非法 orderBy 注入。
 */
export const ALLOWED_CUSTOMER_LIST_SORT_FIELDS = [
  'customerCode',
  'customerName',
  'customerType',
  'serviceType',
  'status',
  'createdAt',
  'updatedAt',
] as const;

/**
 * 客户列表排序白名单中的单个字段名类型。
 */
export type AllowedCustomerListSortField =
  (typeof ALLOWED_CUSTOMER_LIST_SORT_FIELDS)[number];

export type PersonInfoResponseDto = {
  id: string;
  nationality: string | null;
  passportNumber: string | null;
  residenceStatus: string | null;
  residenceExpireDate: Date | null;
  isFamilyMember: boolean;
  familyRelation: FamilyRelation | null;
  primaryCustomerId: string | null;
  remindDaysBefore: number | null;
  daysLeft: number | null;
  alertLevel: VisaAlertLevel | null;
};

export type CustomerResponseDto = {
  id: string;
  customerCode: string;
  customerType: CustomerType;
  customerName: string;
  phone: string | null;
  email: string | null;
  wechatId: string | null;
  lineId: string | null;
  address: string | null;
  serviceType: Customer['serviceType'];
  ownerUserId: string | null;
  ownerName: string | null;
  status: Customer['status'];
  /** 客户头像文件 ID（`files`，CUSTOMER 业务图片）；未设置时为 null */
  photoFileId: string | null;
  companyInfo: {
    id: string;
    corporationNumber: string | null;
    fiscalMonth: number | null;
    representativeName: string | null;
  } | null;
  personInfo: PersonInfoResponseDto | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 列表/详情中 `listPrimaryVisaCase` 摘要的来源：`SELF` 为本人名下案件；`PRIMARY_CUSTOMER_FALLBACK` 为家属行回退至主客户摘要；无摘要或不适用时为 `null`（与 docs/31 §5.4 一致）。
 */
export type ListPrimaryVisaCaseSource =
  | 'SELF'
  | 'PRIMARY_CUSTOMER_FALLBACK'
  | null;

/**
 * 客户列表「主展示案件」摘要，选取与排序规则见 `docs/17` §1.11（不按负责人/数据范围分叉）。
 */
export type CustomerListPrimaryVisaCaseSummaryDto = {
  visaCaseId: string;
  caseType: string | null;
  caseStatus: VisaCaseStatus;
  expireDate: Date | null;
  nextFollowUpAt: Date | null;
  assignedToUserId: string | null;
  assignedToDisplayName: string | null;
  /** 主展示案件是否家族签（与 `visa_cases.is_family_case` 一致） */
  isFamilyCase: boolean;
  /** 家族签主申内/外模式；非家族签或未设置时为 null */
  familyLinkMode: FamilyLinkMode | null;
  /**
   * 主展示案件在 `visa_case_family_members` 中 `is_primary = false` 的家属行数（不含系统内主申人行；与 doc 21 案件级家属模型一致）。
   */
  familyDependentsCount: number;
  /** 案件材料摘要状态（P0 手工维护，可空） */
  materialStatus: MaterialStatus | null;
  /**
   * 主展示案件 checklist 行总数（`visa_case_material_items`），与 `GET /visa-cases/:id/materials/summary` 的 `total` 一致。
   */
  materialChecklistTotal: number;
  /** checklist 中 `COLLECTED` 件数 */
  materialChecklistCollected: number;
  /** checklist 中 `NOT_APPLICABLE` 件数 */
  materialChecklistNotApplicable: number;
  /**
   * 由 checklist 完成度推导的建议 `material_status`，与 materials/summary 的 `suggestedStatus` 同源算法。
   */
  materialChecklistSuggestedStatus: MaterialStatus;
  /**
   * 持久化 `material_status` 与 checklist 建议是否不一致（含持久化为空但建议非 NOT_RECEIVED 的情形）。
   */
  materialChecklistOutOfSync: boolean;
};

export type CustomerListItemResponseDto = CustomerResponseDto & {
  /** 该客户名下开放签证案件按 P0 去重后的最高优先级提醒桶，只读派生、不落库 */
  visaDerivedRisk: VisaReminderType | null;
  /** 当前客户在列表中的主展示签证案件摘要；无案件时为 null */
  listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummaryDto | null;
  /**
   * `listPrimaryVisaCase` 的来源标注；有摘要且来自本人第一轮查询时为 `SELF`，来自主客户回退时为 `PRIMARY_CUSTOMER_FALLBACK`，否则为 `null`。
   */
  listPrimaryVisaCaseSource: ListPrimaryVisaCaseSource;
  /**
   * 当 `listPrimaryVisaCaseSource === 'PRIMARY_CUSTOMER_FALLBACK'` 时为主客户 UUID；其余情况为 `null`。
   */
  primaryCustomerIdForListFallback: string | null;
};

/**
 * 详情接口在实体上附加的列表同源主展示案件字段（与 `CustomerListItemResponseDto` 中对应项语义一致）。
 */
export type CustomerDetailListPrimaryVisaCaseAugmentDto = {
  listPrimaryVisaCase: CustomerListPrimaryVisaCaseSummaryDto | null;
  listPrimaryVisaCaseSource: ListPrimaryVisaCaseSource;
  primaryCustomerIdForListFallback: string | null;
};

export type CustomerListResponse = {
  items: CustomerListItemResponseDto[];
  total: number;
  page: number;
  pageSize: number;
};
