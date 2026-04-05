export enum CustomerType {
  PERSONAL = 'PERSONAL',
  COMPANY = 'COMPANY',
}

export enum ServiceType {
  ADMIN = 'ADMIN',
  TAX = 'TAX',
  BOTH = 'BOTH',
}

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum AdminCaseStatus {
  DRAFT = 'DRAFT',
  ACCEPTED = 'ACCEPTED',
  MATERIAL_PENDING = 'MATERIAL_PENDING',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaxContractStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
}

export enum MonthlyStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum MaterialStatus {
  NOT_RECEIVED = 'NOT_RECEIVED',
  PARTIAL = 'PARTIAL',
  COMPLETE = 'COMPLETE',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  VOID = 'VOID',
}

export enum PaymentStatus {
  REGISTERED = 'REGISTERED',
  VERIFIED = 'VERIFIED',
  REFUNDED = 'REFUNDED',
  REVERSED = 'REVERSED',
}

export enum PaymentMethod {
  BANK = 'BANK',
  CASH = 'CASH',
  OTHER = 'OTHER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum TaskStatus {
  TODO = 'TODO',
  DOING = 'DOING',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum BusinessType {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN',
  TAX = 'TAX',
  FINANCE = 'FINANCE',
  INTERNAL = 'INTERNAL',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
}

export enum DepositTransactionType {
  RECHARGE = 'RECHARGE',
  OFFSET = 'OFFSET',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum PermissionType {
  MENU = 'MENU',
  PAGE = 'PAGE',
  BUTTON = 'BUTTON',
}

export enum FileAccessAction {
  DOWNLOAD = 'DOWNLOAD',
  VIEW = 'VIEW',
  DELETE = 'DELETE',
}

export enum LoginType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
}

export enum OperationResult {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export enum NoteType {
  FOLLOW_UP = 'FOLLOW_UP',
  MEMO = 'MEMO',
  GENERAL = 'GENERAL',
}

export enum StaffRelationType {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  SUPPORT = 'SUPPORT',
}

export enum FamilyRelation {
  SPOUSE = 'SPOUSE',
  CHILD = 'CHILD',
  PARENT = 'PARENT',
  OTHER = 'OTHER',
}

export enum VisaAlertLevel {
  EXPIRED = 'EXPIRED',
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  NORMAL = 'NORMAL',
}

export enum InvoiceType {
  ADMIN = 'ADMIN',
  TAX = 'TAX',
  INTERNAL = 'INTERNAL',
}

export enum FamilyLinkMode {
  INTERNAL = 'INTERNAL',
  EXTERNAL = 'EXTERNAL',
}

export enum VisaCaseStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  SUPPLEMENT = 'SUPPLEMENT',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum VisaCaseLogType {
  SUBMISSION = 'SUBMISSION',
  SUPPLEMENT = 'SUPPLEMENT',
  FOLLOW_UP = 'FOLLOW_UP',
  STATUS_CHANGE = 'STATUS_CHANGE',
  GENERAL = 'GENERAL',
}

export enum VisaCaseFeeStatus {
  NOT_BILLED = 'NOT_BILLED',
  BILLED = 'BILLED',
  PARTIAL_PAID = 'PARTIAL_PAID',
  PAID = 'PAID',
}

/** 与后端 `VisaCaseApplicationCategory` 一致，对应 `visa_cases.case_type` 推荐取值。 */
export enum VisaCaseApplicationCategory {
  PR = 'PR',
  NATURALIZATION = 'NATURALIZATION',
  FAMILY_STAY = 'FAMILY_STAY',
  TECH_HUMANITIES_INTERNATIONAL = 'TECH_HUMANITIES_INTERNATIONAL',
  DEPENDENT_SPOUSE = 'DEPENDENT_SPOUSE',
  STUDENT = 'STUDENT',
  WORK_OTHER = 'WORK_OTHER',
  STARTUP = 'STARTUP',
  OTHER = 'OTHER',
}

export enum VisaCaseMemberRole {
  APPLICANT = 'APPLICANT',
  SPOUSE = 'SPOUSE',
  CHILD = 'CHILD',
  PARENT = 'PARENT',
  OTHER = 'OTHER',
}

export enum FilePathType {
  CASE_DOCUMENT = 'CASE_DOCUMENT',
  PERSONAL_DOCUMENT = 'PERSONAL_DOCUMENT',
  CERTIFICATE = 'CERTIFICATE',
  CONTRACT = 'CONTRACT',
  OTHER = 'OTHER',
}

export enum VisaReminderType {
  SUPPLEMENT = 'SUPPLEMENT',
  TODAY_FOLLOW_UP = 'TODAY_FOLLOW_UP',
  EXPIRING_7_DAYS = 'EXPIRING_7_DAYS',
  EXPIRING_2_MONTHS = 'EXPIRING_2_MONTHS',
}

/** 签证域列表与聚合接口共用的数据范围，与后端 `VisaDataScope` 一致（P2-S2e）。 */
export enum VisaDataScope {
  MINE = 'mine',
  TEAM = 'team',
  ALL = 'all',
}

export enum MaterialItemScope {
  CASE = 'CASE',
  MEMBER = 'MEMBER',
}

export enum MaterialItemStatus {
  NOT_COLLECTED = 'NOT_COLLECTED',
  COLLECTED = 'COLLECTED',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

export enum AuditActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  UPLOAD = 'UPLOAD',
  DOWNLOAD = 'DOWNLOAD',
  VOID = 'VOID',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  IMPORT = 'IMPORT',
}

export enum AuditTargetType {
  CUSTOMER = 'CUSTOMER',
  ADMIN_CASE = 'ADMIN_CASE',
  TAX_CONTRACT = 'TAX_CONTRACT',
  TAX_PERIOD = 'TAX_PERIOD',
  INVOICE = 'INVOICE',
  PAYMENT = 'PAYMENT',
  DEPOSIT = 'DEPOSIT',
  FILE = 'FILE',
  USER = 'USER',
  ROLE = 'ROLE',
  NOTE = 'NOTE',
  VISA_CASE = 'VISA_CASE',
  VISA_CASE_LOG = 'VISA_CASE_LOG',
  VISA_CASE_IMPORT = 'VISA_CASE_IMPORT',
  VISA_CASE_ADMIN_SUPPLEMENT = 'VISA_CASE_ADMIN_SUPPLEMENT',
  CUSTOMER_FILE_PATH = 'CUSTOMER_FILE_PATH',
  MATERIAL_TEMPLATE = 'MATERIAL_TEMPLATE',
  INTERVIEW = 'INTERVIEW',
  SYSTEM = 'SYSTEM',
}

/** 导出/离境类操作类型，与后端 `ExportType` 及 `docs/35` 一致。 */
export enum ExportType {
  FILE_ATTACHMENT_STREAM = 'FILE_ATTACHMENT_STREAM',
  FILE_PREVIEW_STREAM = 'FILE_PREVIEW_STREAM',
  AUDIT_LOG_CSV = 'AUDIT_LOG_CSV',
}
