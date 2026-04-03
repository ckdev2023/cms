import {
  DepositTransactionType,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  PaymentStatus,
} from '../../common/constants/enums';

/**
 * 汇总财务模块内部复用的分页结果与列表投影类型，避免 service 文件内联声明过长。
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PostgresErrorLike {
  driverError?: {
    code?: string;
  };
}

export interface DepositAccountListItem {
  id: string;
  customerId: string;
  customerName: string | null;
  customerCode: string | null;
  balance: number;
  transactionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DepositTransactionListItem {
  id: string;
  depositAccountId: string;
  customerId: string | null;
  customerName: string | null;
  transactionType: DepositTransactionType;
  amount: number;
  balanceAfter: number;
  relatedInvoiceId: string | null;
  relatedInvoiceNo: string | null;
  remark: string | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface DepositAccountSummary {
  totalAccounts: string;
  totalBalance: string;
  activeAccounts: string;
}

export const EMPTY_DEPOSIT_ACCOUNT_SUMMARY: DepositAccountSummary = {
  totalAccounts: '0',
  totalBalance: '0',
  activeAccounts: '0',
};

export interface InvoiceListItem {
  id: string;
  customerId: string;
  customerName: string | null;
  invoiceNo: string;
  invoiceType: InvoiceType;
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: Date | null;
  issuedAt: Date | null;
  itemCount: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceSummaryRow {
  status: string;
  count: string;
  totalAmount: string;
}

export interface PaymentListItem {
  id: string;
  customerId: string;
  customerName: string | null;
  paymentNo: string;
  paymentDate: Date;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  remark: string | null;
  allocationCount: number;
  createdBy: string | null;
  reversedAt: Date | null;
  reversalReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentInvoiceItem {
  id: string;
  paymentId: string;
  paymentNo: string | null;
  paymentDate: Date | null;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus | null;
  allocatedAmount: number;
  createdAt: Date;
}

export interface PaymentSummaryRow {
  status: string;
  count: string;
  totalAmount: string;
}
