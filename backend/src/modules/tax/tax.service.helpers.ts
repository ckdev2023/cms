import type { Repository } from 'typeorm';

import { MaterialStatus } from '../../common/constants/enums';
import type {
  TaxContract,
  TaxMonthlyDocument,
  TaxMonthlyWorkItem,
  TaxPeriod,
} from './entities';
import type {
  TaxContractListDto,
  TaxPeriodDetailDto,
  TaxPeriodListDto,
} from './tax.service.types';

function resolveMaterialStatus(
  docs: Pick<TaxMonthlyDocument, 'received'>[],
): MaterialStatus {
  if (docs.length === 0) {
    return MaterialStatus.NOT_RECEIVED;
  }

  const receivedCount = docs.filter((doc) => doc.received).length;
  if (receivedCount === 0) {
    return MaterialStatus.NOT_RECEIVED;
  }

  if (receivedCount === docs.length) {
    return MaterialStatus.COMPLETE;
  }

  return MaterialStatus.PARTIAL;
}

export async function recalcTaxPeriodMaterialStatus(
  documentRepo: Repository<TaxMonthlyDocument>,
  periodRepo: Repository<TaxPeriod>,
  periodId: string,
): Promise<void> {
  const docs = await documentRepo.find({
    where: { taxPeriodId: periodId },
  });
  const period = await periodRepo.findOne({
    where: { id: periodId },
  });

  if (!period) {
    return;
  }

  period.materialStatus = resolveMaterialStatus(docs);
  await periodRepo.save(period);
}

export function expandMonths(startYm: string, endYm: string): string[] {
  const [startYear, startMonth] = startYm.split('-').map(Number);
  const [endYear, endMonth] = endYm.split('-').map(Number);
  const months: string[] = [];
  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, '0')}`);
    month++;

    if (month > 12) {
      month = 1;
      year++;
    }
  }

  return months;
}

export function calcDeadline(periodYm: string, day: number): Date {
  const [year, month] = periodYm.split('-').map(Number);
  let deadlineYear = year;
  let deadlineMonth = month + 1;

  if (deadlineMonth > 12) {
    deadlineMonth = 1;
    deadlineYear++;
  }

  const maxDay = new Date(deadlineYear, deadlineMonth, 0).getDate();
  return new Date(deadlineYear, deadlineMonth - 1, Math.min(day, maxDay));
}

export function toContractListDto(contract: TaxContract): TaxContractListDto {
  return {
    id: contract.id,
    customerId: contract.customerId,
    customerName: contract.customer?.customerName ?? null,
    contractName: contract.contractName,
    contractStatus: contract.contractStatus,
    billingCycle: contract.billingCycle,
    startDate: contract.startDate,
    endDate: contract.endDate,
    monthlyFee: contract.monthlyFee,
    ownerUserId: contract.ownerUserId,
    ownerName: contract.owner?.displayName ?? null,
    createdBy: contract.createdBy,
    updatedBy: contract.updatedBy,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
  };
}

export function toPeriodListDto(period: TaxPeriod): TaxPeriodListDto {
  return {
    id: period.id,
    taxContractId: period.taxContractId,
    customerId: period.customerId,
    periodYm: period.periodYm,
    declarationDeadline: period.declarationDeadline,
    monthlyStatus: period.monthlyStatus,
    materialStatus: period.materialStatus,
    documentCount: period.documents?.length ?? 0,
    documentReceivedCount:
      period.documents?.filter((doc) => doc.received).length ?? 0,
    workItemCount: period.workItems?.length ?? 0,
    workItemCompletedCount:
      period.workItems?.filter((item) => item.completed).length ?? 0,
    createdBy: period.createdBy,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
  };
}

function toPeriodDocumentDto(
  document: TaxMonthlyDocument,
): TaxPeriodDetailDto['documents'][number] {
  return {
    id: document.id,
    documentName: document.documentName,
    fileId: document.fileId,
    received: document.received,
    receivedAt: document.receivedAt,
    remark: document.remark,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function toPeriodWorkItemDto(
  workItem: TaxMonthlyWorkItem,
): TaxPeriodDetailDto['workItems'][number] {
  return {
    id: workItem.id,
    itemName: workItem.itemName,
    completed: workItem.completed,
    completedAt: workItem.completedAt,
    completedBy: workItem.completedBy,
    completedByName: workItem.completedByUser?.displayName ?? null,
    remark: workItem.remark,
    sortOrder: workItem.sortOrder,
    createdAt: workItem.createdAt,
    updatedAt: workItem.updatedAt,
  };
}

export function toPeriodDetailDto(period: TaxPeriod): TaxPeriodDetailDto {
  return {
    id: period.id,
    taxContractId: period.taxContractId,
    customerId: period.customerId,
    periodYm: period.periodYm,
    declarationDeadline: period.declarationDeadline,
    monthlyStatus: period.monthlyStatus,
    materialStatus: period.materialStatus,
    documents: (period.documents ?? []).map(toPeriodDocumentDto),
    workItems: (period.workItems ?? []).map(toPeriodWorkItemDto),
    createdBy: period.createdBy,
    createdAt: period.createdAt,
    updatedAt: period.updatedAt,
  };
}
