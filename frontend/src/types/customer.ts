/**
 * 定义客户档案、备注与客户补充信息的声明类型。
 */
import type {
  CustomerStatus,
  CustomerType,
  FamilyLinkMode,
  FamilyRelation,
  MaterialStatus,
  NoteType,
  ServiceType,
  VisaAlertLevel,
  VisaCaseStatus,
  VisaDataScope,
  VisaReminderType,
} from '@/constants/enums'

/**
 * 客户列表行附带的「主展示签证案件」摘要，与 `GET /customers` 的 `listPrimaryVisaCase` 一致。
 */
export interface CustomerListPrimaryVisaCaseSummary {
  visaCaseId: string
  caseType: string | null
  caseStatus: VisaCaseStatus
  expireDate: string | null
  nextFollowUpAt: string | null
  assignedToUserId: string | null
  assignedToDisplayName: string | null
  /** 与 `GET /customers` `listPrimaryVisaCase` 及 docs/17 §1.11 主展示案件一致 */
  isFamilyCase: boolean
  familyLinkMode: FamilyLinkMode | null
  /** 案件级家属行数（`is_primary = false`），与后端摘要及 doc 21 一致 */
  familyDependentsCount: number
  materialStatus: MaterialStatus | null
  /** checklist 行总数，与 `GET .../visa-cases/:id/materials/summary` 一致 */
  materialChecklistTotal: number
  materialChecklistCollected: number
  materialChecklistNotApplicable: number
  materialChecklistSuggestedStatus: MaterialStatus
  /** 持久化 material_status 与 checklist 建议是否不一致 */
  materialChecklistOutOfSync: boolean
}

/**
 * `listPrimaryVisaCase` 摘要来源，与 `GET /customers` / 详情同源字段及 docs/31 §5.4 一致。
 */
export type ListPrimaryVisaCaseSource =
  | 'SELF'
  | 'PRIMARY_CUSTOMER_FALLBACK'
  | null

export interface CompanyInfoData {
  id?: string
  corporationNumber: string | null
  fiscalMonth: number | null
  representativeName: string | null
}

export interface PersonInfoData {
  id?: string
  nationality: string | null
  /** 自然人护照号码主数据（person_info，可空；与 docs/17 §1.12 一致） */
  passportNumber: string | null
  residenceStatus: string | null
  residenceExpireDate: string | null
  isFamilyMember: boolean
  familyRelation: FamilyRelation | null
  primaryCustomerId: string | null
  remindDaysBefore: number | null
  daysLeft: number | null
  alertLevel: VisaAlertLevel | null
}

export interface CustomerItem {
  id: string
  customerCode: string
  customerType: CustomerType
  customerName: string
  phone: string | null
  email: string | null
  /** 主档微信标识，与 `GET/PUT /customers` 及列表 `keyword` 检索一致，最长 50 字符 */
  wechatId: string | null
  /** 主档 LINE 标识，与 `GET/PUT /customers` 及列表 `keyword` 检索一致，最长 50 字符 */
  lineId: string | null
  address: string | null
  serviceType: ServiceType
  ownerUserId: string | null
  ownerName: string | null
  status: CustomerStatus
  /** 客户头像文件 ID（`files`，CUSTOMER 业务图片）；未设置时为 null */
  photoFileId: string | null
  /**
   * `GET /customers` 只读字段，与 `visaReminderBucket` 筛选及 `VisaReminderType` 枚举一致；
   * 多开放案件时取 `docs/21` §9 最高优先级一桶。
   */
  visaDerivedRisk?: VisaReminderType | null
  /** 列表主展示签证案件；无开放案件或未匹配时为 null */
  listPrimaryVisaCase?: CustomerListPrimaryVisaCaseSummary | null
  /**
   * 主展示摘要来源：本人名下案件为 `SELF`，家属回退至主客户摘要为 `PRIMARY_CUSTOMER_FALLBACK`，否则为 `null`。
   */
  listPrimaryVisaCaseSource?: ListPrimaryVisaCaseSource
  /**
   * 当来源为 `PRIMARY_CUSTOMER_FALLBACK` 时为主客户 UUID；其余情况为 `null` 或省略。
   */
  primaryCustomerIdForListFallback?: string | null
  companyInfo: CompanyInfoData | null
  personInfo: PersonInfoData | null
  createdAt: string
  updatedAt: string
}

/** 客户详情；与 `GET /customers/:id` 一致时包含与列表同源的主展示案件摘要及 `listPrimaryVisaCaseSource` 等只读字段。 */
export interface CustomerDetail extends CustomerItem {
  staffRelations: {
    id: string
    userId: string
    relationType: string
    user: { id: string; displayName: string }
  }[]
}

export interface CreateCustomerParams {
  customerType: CustomerType
  customerName: string
  phone?: string
  email?: string
  wechatId?: string
  lineId?: string
  address?: string
  serviceType: ServiceType
  ownerUserId?: string
  /** 新建时仅允许尚未绑定客户的 CUSTOMER 类图片附件 */
  photoFileId?: string
  companyInfo?: {
    corporationNumber?: string
    fiscalMonth?: number
    representativeName?: string
  }
  personInfo?: {
    nationality?: string
    passportNumber?: string
    residenceStatus?: string
    residenceExpireDate?: string
    isFamilyMember?: boolean
    familyRelation?: FamilyRelation
    primaryCustomerId?: string
    remindDaysBefore?: number
  }
}

/**
 * 更新客户载荷；`ownerUserId` 显式传 `null` 可清空主档负责人（与 `PUT /customers` 局部更新语义一致）。
 */
export type UpdateCustomerParams = Partial<
  Omit<CreateCustomerParams, 'ownerUserId' | 'photoFileId'>
> & {
  ownerUserId?: string | null
  /** 传 `null` 表示清除客户头像 */
  photoFileId?: string | null
}

export interface CustomerQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  /** 微信主档模糊筛选，与后端 `QueryCustomerDto.wechatId` 一致 */
  wechatId?: string
  /** LINE 主档模糊筛选，与后端 `QueryCustomerDto.lineId` 一致 */
  lineId?: string
  customerType?: CustomerType
  serviceType?: ServiceType
  /**
   * 签证案件类目：列表筛选用 `visa_case_application_type` 字典值（或 `allow-create` 自定义），与后端 `QueryCustomerDto.visaCaseTypeKeyword` 一致，对 `case_type` 做 ILIKE（最长 100）。
   */
  visaCaseTypeKeyword?: string
  /** 主展示案件状态，与后端 `QueryCustomerDto.listPrimaryVisaCaseStatus` 及摘要列同源 */
  listPrimaryVisaCaseStatus?: VisaCaseStatus
  /** 主展示案件是否家族签，与后端 `QueryCustomerDto.listPrimaryIsFamilyCase` 一致 */
  listPrimaryIsFamilyCase?: boolean
  /** 主展示案件主申内/外模式，与后端 `QueryCustomerDto.listPrimaryFamilyLinkMode` 一致 */
  listPrimaryFamilyLinkMode?: FamilyLinkMode
  /**
   * 仅列表搜索表单：`yes`/`no` 在请求前映射为 `listPrimaryIsFamilyCase`。
   */
  listPrimaryFamilyCaseFilter?: 'yes' | 'no'
  status?: CustomerStatus
  /** 与 `GET /visa-cases` 的 reminderBucket、签证提醒页筛选语义一致 */
  visaReminderBucket?: VisaReminderType
  /** 与签证案件列表 `dataScope` 一致，用于客户列表派生风险 EXISTS（P2-S2e） */
  dataScope?: VisaDataScope
  /**
   * 主档在留期限 N 自然日以内（含），与 `QueryCustomerDto.residenceExpireWithinDays` 一致；
   * 与签证案件到期提醒独立。
   */
  residenceExpireWithinDays?: number
  ownerUserId?: string
  /** 列出挂在指定主档下的家属客户，与后端 `QueryCustomerDto.primaryCustomerId` 一致 */
  primaryCustomerId?: string
  sortBy?: string
  sortOrder?: 'ASC' | 'DESC'
  [key: string]: unknown
}

export interface NoteItem {
  id: string
  customerId: string
  content: string
  noteType: NoteType
  /** 与签证案件日志结构化字段同源，客户备注侧可选填写 */
  submittedItems: string | null
  missingItems: string | null
  nextAction: string | null
  nextFollowUpAt: string | null
  createdBy: string | null
  creatorName: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateNoteParams {
  content: string
  noteType?: NoteType
  submittedItems?: string
  missingItems?: string
  nextAction?: string
  nextFollowUpAt?: string
}

export interface UpdateNoteParams {
  content?: string
  noteType?: NoteType
  submittedItems?: string
  missingItems?: string
  nextAction?: string
  /** 传 `null` 可清空跟进时间 */
  nextFollowUpAt?: string | null
}

export interface NoteQueryParams {
  page?: number
  pageSize?: number
  noteType?: NoteType
  sortOrder?: 'ASC' | 'DESC'
}
