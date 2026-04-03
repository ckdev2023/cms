import {
  MaterialStatus,
  MonthlyStatus,
  TaxContractStatus,
} from '../../common/constants/enums';
import type { TaxContract } from './entities';

export const STATUS_TRANSITIONS: Record<
  TaxContractStatus,
  TaxContractStatus[]
> = {
  [TaxContractStatus.ACTIVE]: [
    TaxContractStatus.EXPIRED,
    TaxContractStatus.TERMINATED,
  ],
  [TaxContractStatus.EXPIRED]: [
    TaxContractStatus.ACTIVE,
    TaxContractStatus.TERMINATED,
  ],
  [TaxContractStatus.TERMINATED]: [],
};

export type PaginatedResponse<TItem> = {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type TaxContractListDto = {
  id: string;
  customerId: string;
  customerName: string | null;
  contractName: string;
  contractStatus: TaxContractStatus;
  billingCycle: TaxContract['billingCycle'];
  startDate: Date;
  endDate: Date | null;
  monthlyFee: number;
  ownerUserId: string | null;
  ownerName: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TaxPeriodListDto = {
  id: string;
  taxContractId: string;
  customerId: string;
  periodYm: string;
  declarationDeadline: Date | null;
  monthlyStatus: MonthlyStatus;
  materialStatus: MaterialStatus;
  documentCount: number;
  documentReceivedCount: number;
  workItemCount: number;
  workItemCompletedCount: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TaxPeriodDocumentDto = {
  id: string;
  documentName: string;
  fileId: string | null;
  received: boolean;
  receivedAt: Date | null;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TaxPeriodWorkItemDto = {
  id: string;
  itemName: string;
  completed: boolean;
  completedAt: Date | null;
  completedBy: string | null;
  completedByName: string | null;
  remark: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type TaxPeriodDetailDto = {
  id: string;
  taxContractId: string;
  customerId: string;
  periodYm: string;
  declarationDeadline: Date | null;
  monthlyStatus: MonthlyStatus;
  materialStatus: MaterialStatus;
  documents: TaxPeriodDocumentDto[];
  workItems: TaxPeriodWorkItemDto[];
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};
