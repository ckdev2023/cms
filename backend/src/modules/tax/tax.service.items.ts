import { NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

import type {
  CreateTaxDocumentDto,
  CreateTaxWorkItemDto,
  UpdateTaxDocumentDto,
  UpdateTaxWorkItemDto,
} from './dto';
import type {
  TaxMonthlyDocument,
  TaxMonthlyWorkItem,
  TaxPeriod,
} from './entities';

async function findPeriodOrThrow(
  periodRepo: Repository<TaxPeriod>,
  periodId: string,
): Promise<void> {
  const period = await periodRepo.findOne({ where: { id: periodId } });

  if (!period) {
    throw new NotFoundException('月次期間が見つかりません');
  }
}

async function findDocumentOrThrow(
  documentRepo: Repository<TaxMonthlyDocument>,
  docId: string,
): Promise<TaxMonthlyDocument> {
  const document = await documentRepo.findOne({ where: { id: docId } });

  if (!document) {
    throw new NotFoundException('資料が見つかりません');
  }

  return document;
}

async function findWorkItemOrThrow(
  workItemRepo: Repository<TaxMonthlyWorkItem>,
  itemId: string,
): Promise<TaxMonthlyWorkItem> {
  const item = await workItemRepo.findOne({ where: { id: itemId } });

  if (!item) {
    throw new NotFoundException('作業項目が見つかりません');
  }

  return item;
}

export async function createTaxDocument(
  periodRepo: Repository<TaxPeriod>,
  documentRepo: Repository<TaxMonthlyDocument>,
  periodId: string,
  dto: CreateTaxDocumentDto,
): Promise<TaxMonthlyDocument> {
  await findPeriodOrThrow(periodRepo, periodId);

  const document = documentRepo.create({
    taxPeriodId: periodId,
    documentName: dto.documentName,
    fileId: dto.fileId ?? null,
    received: dto.received ?? false,
    receivedAt: dto.received ? new Date() : null,
    remark: dto.remark ?? null,
  });

  return documentRepo.save(document);
}

export async function updateTaxDocument(
  documentRepo: Repository<TaxMonthlyDocument>,
  docId: string,
  dto: UpdateTaxDocumentDto,
): Promise<TaxMonthlyDocument> {
  const document = await findDocumentOrThrow(documentRepo, docId);

  if (dto.documentName !== undefined) {
    document.documentName = dto.documentName;
  }
  if (dto.fileId !== undefined) {
    document.fileId = dto.fileId ?? null;
  }
  if (dto.remark !== undefined) {
    document.remark = dto.remark ?? null;
  }
  if (dto.received !== undefined) {
    const wasReceived = document.received;
    document.received = dto.received;

    if (dto.received && !wasReceived) {
      document.receivedAt = new Date();
    } else if (!dto.received) {
      document.receivedAt = null;
    }
  }

  return documentRepo.save(document);
}

export async function removeTaxDocument(
  documentRepo: Repository<TaxMonthlyDocument>,
  docId: string,
): Promise<TaxMonthlyDocument> {
  const document = await findDocumentOrThrow(documentRepo, docId);
  await documentRepo.remove(document);
  return document;
}

export async function createTaxWorkItem(
  periodRepo: Repository<TaxPeriod>,
  workItemRepo: Repository<TaxMonthlyWorkItem>,
  periodId: string,
  dto: CreateTaxWorkItemDto,
): Promise<TaxMonthlyWorkItem> {
  await findPeriodOrThrow(periodRepo, periodId);

  const item = workItemRepo.create({
    taxPeriodId: periodId,
    itemName: dto.itemName,
    completed: dto.completed ?? false,
    completedAt: dto.completed ? new Date() : null,
    remark: dto.remark ?? null,
    sortOrder: dto.sortOrder ?? 0,
  });

  return workItemRepo.save(item);
}

export async function updateTaxWorkItem(
  workItemRepo: Repository<TaxMonthlyWorkItem>,
  itemId: string,
  dto: UpdateTaxWorkItemDto,
  userId?: string,
): Promise<TaxMonthlyWorkItem> {
  const item = await findWorkItemOrThrow(workItemRepo, itemId);

  if (dto.itemName !== undefined) {
    item.itemName = dto.itemName;
  }
  if (dto.remark !== undefined) {
    item.remark = dto.remark ?? null;
  }
  if (dto.sortOrder !== undefined) {
    item.sortOrder = dto.sortOrder;
  }
  if (dto.completed !== undefined) {
    const wasCompleted = item.completed;
    item.completed = dto.completed;

    if (dto.completed && !wasCompleted) {
      item.completedAt = new Date();
      item.completedBy = userId ?? null;
    } else if (!dto.completed) {
      item.completedAt = null;
      item.completedBy = null;
    }
  }

  return workItemRepo.save(item);
}

export async function removeTaxWorkItem(
  workItemRepo: Repository<TaxMonthlyWorkItem>,
  itemId: string,
): Promise<TaxMonthlyWorkItem> {
  const item = await findWorkItemOrThrow(workItemRepo, itemId);
  await workItemRepo.remove(item);
  return item;
}
