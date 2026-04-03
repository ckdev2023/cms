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
  INTERVIEW = 'INTERVIEW',
  SYSTEM = 'SYSTEM',
}
