import { NotFoundException } from '@nestjs/common';
import { Brackets, type Repository } from 'typeorm';

import type { QueryDepositAccountDto } from './dto/query-deposit-account.dto';
import type { QueryDepositTransactionDto } from './dto/query-deposit-transaction.dto';
import { DepositAccount } from './entities/deposit-account.entity';
import { DepositTransaction } from './entities/deposit-transaction.entity';
import {
  type DepositAccountListItem,
  type DepositAccountSummary,
  type DepositTransactionListItem,
  EMPTY_DEPOSIT_ACCOUNT_SUMMARY,
  type PaginatedResult,
} from './finance.types';

function toAccountListDto(
  account: DepositAccount & { transactionCount?: number },
): DepositAccountListItem {
  return {
    id: account.id,
    customerId: account.customerId,
    customerName: account.customer?.customerName ?? null,
    customerCode: account.customer?.customerCode ?? null,
    balance: account.balance,
    transactionCount: account.transactionCount ?? 0,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function toTransactionListDto(
  transaction: DepositTransaction,
): DepositTransactionListItem {
  return {
    id: transaction.id,
    depositAccountId: transaction.depositAccountId,
    customerId: transaction.depositAccount?.customerId ?? null,
    customerName: transaction.depositAccount?.customer?.customerName ?? null,
    transactionType: transaction.transactionType,
    amount: transaction.amount,
    balanceAfter: transaction.balanceAfter,
    relatedInvoiceId: transaction.relatedInvoiceId,
    relatedInvoiceNo: transaction.relatedInvoice?.invoiceNo ?? null,
    remark: transaction.remark,
    createdBy: transaction.createdBy,
    createdAt: transaction.createdAt,
  };
}

export async function findDepositAccounts(
  accountRepo: Repository<DepositAccount>,
  query: QueryDepositAccountDto,
): Promise<PaginatedResult<DepositAccountListItem>> {
  const {
    page = 1,
    pageSize = 20,
    keyword,
    sortBy,
    sortOrder = 'DESC',
  } = query;

  const qb = accountRepo
    .createQueryBuilder('da')
    .leftJoinAndSelect('da.customer', 'customer')
    .loadRelationCountAndMap('da.transactionCount', 'da.transactions');

  if (keyword) {
    qb.andWhere(
      new Brackets((sub) => {
        sub
          .where('customer.customerName ILIKE :kw', { kw: `%${keyword}%` })
          .orWhere('customer.customerCode ILIKE :kw', { kw: `%${keyword}%` });
      }),
    );
  }

  if (query.customerId) {
    qb.andWhere('da.customerId = :customerId', {
      customerId: query.customerId,
    });
  }

  if (query.hasBalance) {
    qb.andWhere('da.balance > 0');
  }

  const allowedSortFields = ['balance', 'createdAt', 'updatedAt'];
  const orderField =
    sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'updatedAt';
  qb.orderBy(`da.${orderField}`, sortOrder);

  qb.skip((page - 1) * pageSize).take(pageSize);

  const [items, total] = await qb.getManyAndCount();

  return {
    items: items.map(toAccountListDto),
    total,
    page,
    pageSize,
  };
}

export async function findDepositAccountById(
  accountRepo: Repository<DepositAccount>,
  id: string,
): Promise<DepositAccount> {
  const account = await accountRepo.findOne({
    where: { id },
    relations: ['customer'],
  });

  if (!account) {
    throw new NotFoundException('預り金アカウントが見つかりません');
  }

  return account;
}

export function findDepositAccountByCustomer(
  accountRepo: Repository<DepositAccount>,
  customerId: string,
): Promise<DepositAccount | null> {
  return accountRepo.findOne({
    where: { customerId },
    relations: ['customer'],
  });
}

export async function getDepositAccountSummary(
  accountRepo: Repository<DepositAccount>,
): Promise<DepositAccountSummary> {
  const result = await accountRepo
    .createQueryBuilder('da')
    .select('COUNT(*)', 'totalAccounts')
    .addSelect('COALESCE(SUM(da.balance), 0)', 'totalBalance')
    .addSelect('COUNT(CASE WHEN da.balance > 0 THEN 1 END)', 'activeAccounts')
    .getRawOne<DepositAccountSummary>();

  return result ?? EMPTY_DEPOSIT_ACCOUNT_SUMMARY;
}

export async function findDepositTransactions(
  txnRepo: Repository<DepositTransaction>,
  query: QueryDepositTransactionDto,
): Promise<PaginatedResult<DepositTransactionListItem>> {
  const {
    page = 1,
    pageSize = 20,
    keyword,
    sortBy,
    sortOrder = 'DESC',
  } = query;

  const qb = txnRepo
    .createQueryBuilder('dt')
    .leftJoinAndSelect('dt.depositAccount', 'da')
    .leftJoinAndSelect('da.customer', 'customer')
    .leftJoinAndSelect('dt.relatedInvoice', 'invoice');

  if (keyword) {
    qb.andWhere(
      new Brackets((sub) => {
        sub
          .where('customer.customerName ILIKE :kw', { kw: `%${keyword}%` })
          .orWhere('invoice.invoiceNo ILIKE :kw', { kw: `%${keyword}%` })
          .orWhere('dt.remark ILIKE :kw', { kw: `%${keyword}%` });
      }),
    );
  }

  if (query.depositAccountId) {
    qb.andWhere('dt.depositAccountId = :depositAccountId', {
      depositAccountId: query.depositAccountId,
    });
  }

  if (query.customerId) {
    qb.andWhere('da.customerId = :customerId', {
      customerId: query.customerId,
    });
  }

  if (query.transactionType) {
    qb.andWhere('dt.transactionType = :transactionType', {
      transactionType: query.transactionType,
    });
  }

  if (query.relatedInvoiceId) {
    qb.andWhere('dt.relatedInvoiceId = :relatedInvoiceId', {
      relatedInvoiceId: query.relatedInvoiceId,
    });
  }

  if (query.createdFrom) {
    qb.andWhere('dt.createdAt >= :createdFrom', {
      createdFrom: query.createdFrom,
    });
  }

  if (query.createdTo) {
    qb.andWhere('dt.createdAt <= :createdTo', { createdTo: query.createdTo });
  }

  const allowedSortFields = ['amount', 'balanceAfter', 'createdAt'];
  const orderField =
    sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  qb.orderBy(`dt.${orderField}`, sortOrder);

  qb.skip((page - 1) * pageSize).take(pageSize);

  const [items, total] = await qb.getManyAndCount();

  return {
    items: items.map(toTransactionListDto),
    total,
    page,
    pageSize,
  };
}

export async function findDepositTransactionById(
  txnRepo: Repository<DepositTransaction>,
  id: string,
): Promise<DepositTransaction> {
  const txn = await txnRepo.findOne({
    where: { id },
    relations: ['depositAccount', 'depositAccount.customer', 'relatedInvoice'],
  });

  if (!txn) {
    throw new NotFoundException('取引が見つかりません');
  }

  return txn;
}
