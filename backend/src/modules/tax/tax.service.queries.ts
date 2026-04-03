import { Brackets, type Repository } from 'typeorm';

import type { QueryTaxContractDto, QueryTaxPeriodDto } from './dto';
import type { TaxContract, TaxPeriod } from './entities';
import { toContractListDto, toPeriodListDto } from './tax.service.helpers';
import type {
  PaginatedResponse,
  TaxContractListDto,
  TaxPeriodListDto,
} from './tax.service.types';

export async function findTaxContracts(
  contractRepo: Repository<TaxContract>,
  query: QueryTaxContractDto,
): Promise<PaginatedResponse<TaxContractListDto>> {
  const {
    page = 1,
    pageSize = 20,
    keyword,
    sortBy,
    sortOrder = 'DESC',
  } = query;

  const qb = contractRepo
    .createQueryBuilder('tc')
    .leftJoinAndSelect('tc.customer', 'customer')
    .leftJoinAndSelect('tc.owner', 'owner');

  if (keyword) {
    qb.andWhere(
      new Brackets((sub) => {
        sub
          .where('tc.contractName ILIKE :kw', { kw: `%${keyword}%` })
          .orWhere('customer.customerName ILIKE :kw', {
            kw: `%${keyword}%`,
          });
      }),
    );
  }

  if (query.contractStatus) {
    qb.andWhere('tc.contractStatus = :contractStatus', {
      contractStatus: query.contractStatus,
    });
  }

  if (query.billingCycle) {
    qb.andWhere('tc.billingCycle = :billingCycle', {
      billingCycle: query.billingCycle,
    });
  }

  if (query.customerId) {
    qb.andWhere('tc.customerId = :customerId', {
      customerId: query.customerId,
    });
  }

  if (query.ownerUserId) {
    qb.andWhere('tc.ownerUserId = :ownerUserId', {
      ownerUserId: query.ownerUserId,
    });
  }

  if (query.startDateFrom) {
    qb.andWhere('tc.startDate >= :from', { from: query.startDateFrom });
  }

  if (query.startDateTo) {
    qb.andWhere('tc.startDate <= :to', { to: query.startDateTo });
  }

  const allowedSortFields = [
    'contractName',
    'contractStatus',
    'startDate',
    'endDate',
    'monthlyFee',
    'createdAt',
    'updatedAt',
  ];
  const orderField =
    sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
  qb.orderBy(`tc.${orderField}`, sortOrder);
  qb.skip((page - 1) * pageSize).take(pageSize);

  const [items, total] = await qb.getManyAndCount();

  return {
    items: items.map(toContractListDto),
    total,
    page,
    pageSize,
  };
}

export async function findTaxPeriods(
  periodRepo: Repository<TaxPeriod>,
  contractId: string,
  query: QueryTaxPeriodDto,
): Promise<PaginatedResponse<TaxPeriodListDto>> {
  const { page = 1, pageSize = 20, sortBy, sortOrder = 'ASC' } = query;

  const qb = periodRepo
    .createQueryBuilder('tp')
    .leftJoinAndSelect('tp.documents', 'doc')
    .leftJoinAndSelect('tp.workItems', 'wi')
    .where('tp.taxContractId = :contractId', { contractId });

  if (query.monthlyStatus) {
    qb.andWhere('tp.monthlyStatus = :monthlyStatus', {
      monthlyStatus: query.monthlyStatus,
    });
  }

  if (query.materialStatus) {
    qb.andWhere('tp.materialStatus = :materialStatus', {
      materialStatus: query.materialStatus,
    });
  }

  if (query.periodYmFrom) {
    qb.andWhere('tp.periodYm >= :periodYmFrom', {
      periodYmFrom: query.periodYmFrom,
    });
  }

  if (query.periodYmTo) {
    qb.andWhere('tp.periodYm <= :periodYmTo', {
      periodYmTo: query.periodYmTo,
    });
  }

  if (query.deadlineFrom) {
    qb.andWhere('tp.declarationDeadline >= :deadlineFrom', {
      deadlineFrom: query.deadlineFrom,
    });
  }

  if (query.deadlineTo) {
    qb.andWhere('tp.declarationDeadline <= :deadlineTo', {
      deadlineTo: query.deadlineTo,
    });
  }

  const allowedSortFields = [
    'periodYm',
    'declarationDeadline',
    'monthlyStatus',
    'materialStatus',
    'createdAt',
  ];
  const orderField =
    sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'periodYm';
  qb.orderBy(`tp.${orderField}`, sortOrder);
  qb.skip((page - 1) * pageSize).take(pageSize);

  const [items, total] = await qb.getManyAndCount();

  return {
    items: items.map(toPeriodListDto),
    total,
    page,
    pageSize,
  };
}
