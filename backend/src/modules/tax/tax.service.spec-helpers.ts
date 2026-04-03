import type { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

import {
  BillingCycle,
  MaterialStatus,
  MonthlyStatus,
  TaxContractStatus,
} from '../../common/constants/enums';
import type {
  TaxContract,
  TaxMonthlyDocument,
  TaxMonthlyWorkItem,
  TaxPeriod,
} from './entities';
import { TaxService } from './tax.service';

type MockCreateInput = Record<string, unknown>;

export type MockCustomer = TaxContract['customer'];
export type MockOwner = NonNullable<TaxContract['owner']>;
export type MockCompletedByUser = NonNullable<
  TaxMonthlyWorkItem['completedByUser']
>;

export type TaxRepositoryMock<TEntity extends ObjectLiteral> = {
  create: jest.Mock<TEntity, [MockCreateInput]>;
  save: jest.Mock<Promise<TEntity | TEntity[]>, [TEntity | TEntity[]]>;
  findOne: jest.Mock<Promise<TEntity | null>, [object]>;
  find: jest.Mock<Promise<TEntity[]>, [object?]>;
  softRemove: jest.Mock<Promise<void>, [TEntity]>;
  delete: jest.Mock<Promise<void>, [object]>;
  remove: jest.Mock<Promise<void>, [TEntity]>;
  recover: jest.Mock<Promise<void>, [TEntity]>;
  createQueryBuilder: jest.Mock<SelectQueryBuilder<TEntity>, [string?]>;
};

export type TaxQueryBuilderMock<TEntity> = {
  leftJoinAndSelect: jest.Mock<TaxQueryBuilderMock<TEntity>, [string, string]>;
  where: jest.Mock<TaxQueryBuilderMock<TEntity>, [string, object?]>;
  andWhere: jest.Mock<TaxQueryBuilderMock<TEntity>, [unknown, object?]>;
  orderBy: jest.Mock<TaxQueryBuilderMock<TEntity>, [string, string]>;
  skip: jest.Mock<TaxQueryBuilderMock<TEntity>, [number]>;
  take: jest.Mock<TaxQueryBuilderMock<TEntity>, [number]>;
  getManyAndCount: jest.Mock<Promise<[TEntity[], number]>, []>;
};

export type TaxServiceTestContext = {
  service: TaxService;
  contractRepo: TaxRepositoryMock<TaxContract>;
  periodRepo: TaxRepositoryMock<TaxPeriod>;
  documentRepo: TaxRepositoryMock<TaxMonthlyDocument>;
  workItemRepo: TaxRepositoryMock<TaxMonthlyWorkItem>;
};

function createRepositoryMock<TEntity extends ObjectLiteral>(
  generatedId: string,
): TaxRepositoryMock<TEntity> {
  return {
    create: jest.fn<TEntity, [MockCreateInput]>().mockImplementation(
      (data: MockCreateInput) =>
        ({
          ...data,
          id: generatedId,
        }) as unknown as TEntity,
    ),
    save: jest
      .fn<Promise<TEntity | TEntity[]>, [TEntity | TEntity[]]>()
      .mockImplementation((entity: TEntity | TEntity[]) =>
        Promise.resolve(entity),
      ),
    findOne: jest.fn<Promise<TEntity | null>, [object]>(),
    find: jest.fn<Promise<TEntity[]>, [object?]>().mockResolvedValue([]),
    softRemove: jest
      .fn<Promise<void>, [TEntity]>()
      .mockResolvedValue(undefined),
    delete: jest.fn<Promise<void>, [object]>().mockResolvedValue(undefined),
    remove: jest.fn<Promise<void>, [TEntity]>().mockResolvedValue(undefined),
    recover: jest.fn<Promise<void>, [TEntity]>().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn<SelectQueryBuilder<TEntity>, [string?]>(),
  };
}

export function createTaxQueryBuilderMock<TEntity>(
  items: TEntity[] = [],
  total = items.length,
): TaxQueryBuilderMock<TEntity> {
  const leftJoinAndSelect = jest.fn<
    TaxQueryBuilderMock<TEntity>,
    [string, string]
  >();
  const where = jest.fn<TaxQueryBuilderMock<TEntity>, [string, object?]>();
  const andWhere = jest.fn<TaxQueryBuilderMock<TEntity>, [unknown, object?]>();
  const orderBy = jest.fn<TaxQueryBuilderMock<TEntity>, [string, string]>();
  const skip = jest.fn<TaxQueryBuilderMock<TEntity>, [number]>();
  const take = jest.fn<TaxQueryBuilderMock<TEntity>, [number]>();
  const getManyAndCount = jest.fn<Promise<[TEntity[], number]>, []>();
  const qb: TaxQueryBuilderMock<TEntity> = {
    leftJoinAndSelect,
    where,
    andWhere,
    orderBy,
    skip,
    take,
    getManyAndCount,
  };

  qb.leftJoinAndSelect.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.skip.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  qb.getManyAndCount.mockResolvedValue([items, total]);

  return qb;
}

export function createMockContract(
  overrides: Partial<TaxContract> = {},
): TaxContract {
  return {
    id: 'contract-1',
    customerId: 'customer-1',
    contractName: 'テスト契約',
    contractStatus: TaxContractStatus.ACTIVE,
    billingCycle: BillingCycle.MONTHLY,
    startDate: new Date('2026-04-01'),
    endDate: new Date('2027-03-31'),
    monthlyFee: 50000,
    ownerUserId: 'user-1',
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    customer: {
      id: 'customer-1',
      customerName: 'テスト顧客',
    } as MockCustomer,
    owner: { id: 'user-1', displayName: '担当者A' } as MockOwner,
    periods: [],
    ...overrides,
  } as TaxContract;
}

export function createMockPeriod(
  overrides: Partial<TaxPeriod> = {},
): TaxPeriod {
  return {
    id: 'period-1',
    taxContractId: 'contract-1',
    customerId: 'customer-1',
    periodYm: '2026-04',
    declarationDeadline: new Date('2026-05-10'),
    monthlyStatus: MonthlyStatus.NOT_STARTED,
    materialStatus: MaterialStatus.NOT_RECEIVED,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    taxContract: { id: 'contract-1' } as TaxContract,
    customer: { id: 'customer-1' } as MockCustomer,
    documents: [],
    workItems: [],
    ...overrides,
  } as TaxPeriod;
}

export function createMockDocument(
  overrides: Partial<TaxMonthlyDocument> = {},
): TaxMonthlyDocument {
  return {
    id: 'doc-1',
    taxPeriodId: 'period-1',
    documentName: '元帳',
    fileId: null,
    received: false,
    receivedAt: null,
    remark: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    taxPeriod: { id: 'period-1' } as TaxPeriod,
    file: null,
    ...overrides,
  } as TaxMonthlyDocument;
}

export function createMockWorkItem(
  overrides: Partial<TaxMonthlyWorkItem> = {},
): TaxMonthlyWorkItem {
  return {
    id: 'item-1',
    taxPeriodId: 'period-1',
    itemName: '仕訳入力',
    completed: false,
    completedAt: null,
    completedBy: null,
    remark: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    taxPeriod: { id: 'period-1' } as TaxPeriod,
    completedByUser: null,
    ...overrides,
  } as TaxMonthlyWorkItem;
}

export function createTaxServiceContext(): TaxServiceTestContext {
  const contractRepo = createRepositoryMock<TaxContract>('contract-new');
  const periodRepo = createRepositoryMock<TaxPeriod>('period-new');
  const documentRepo = createRepositoryMock<TaxMonthlyDocument>('doc-new');
  const workItemRepo = createRepositoryMock<TaxMonthlyWorkItem>('item-new');

  return {
    service: new TaxService(
      contractRepo as unknown as Repository<TaxContract>,
      periodRepo as unknown as Repository<TaxPeriod>,
      documentRepo as unknown as Repository<TaxMonthlyDocument>,
      workItemRepo as unknown as Repository<TaxMonthlyWorkItem>,
    ),
    contractRepo,
    periodRepo,
    documentRepo,
    workItemRepo,
  };
}
