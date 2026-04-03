import { DataSource, type Repository, type SelectQueryBuilder } from 'typeorm';

import {
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  PaymentStatus,
} from '../../common/constants/enums';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Invoice } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import type { PaymentSummaryRow } from './finance.types';
import { PaymentService } from './payment.service';

export type MockQueryBuilder<TEntity, TRaw = unknown> = {
  leftJoinAndSelect: jest.Mock<
    MockQueryBuilder<TEntity, TRaw>,
    [string, string]
  >;
  innerJoin: jest.Mock<MockQueryBuilder<TEntity, TRaw>, [string, string]>;
  loadRelationCountAndMap: jest.Mock<
    MockQueryBuilder<TEntity, TRaw>,
    [string, string]
  >;
  andWhere: jest.Mock<MockQueryBuilder<TEntity, TRaw>, [unknown, unknown?]>;
  where: jest.Mock<MockQueryBuilder<TEntity, TRaw>, [string, object?]>;
  orWhere: jest.Mock<MockQueryBuilder<TEntity, TRaw>, [string, object?]>;
  orderBy: jest.Mock<MockQueryBuilder<TEntity, TRaw>, [string, 'ASC' | 'DESC']>;
  skip: jest.Mock<MockQueryBuilder<TEntity, TRaw>, [number]>;
  take: jest.Mock<MockQueryBuilder<TEntity, TRaw>, [number]>;
  select: jest.Mock<MockQueryBuilder<TEntity, TRaw>, [string, string?]>;
  addSelect: jest.Mock<MockQueryBuilder<TEntity, TRaw>, [string, string?]>;
  groupBy: jest.Mock<MockQueryBuilder<TEntity, TRaw>, [string]>;
  getManyAndCount: jest.Mock<Promise<[TEntity[], number]>, []>;
  getOne: jest.Mock<Promise<TEntity | null>, []>;
  getRawOne: jest.Mock<Promise<TRaw | null>, []>;
  getRawMany: jest.Mock<Promise<TRaw[]>, []>;
};

export type MockEntityRepository<TEntity> = {
  createQueryBuilder: jest.Mock<SelectQueryBuilder<TEntity>, [string?]>;
};

export type MockManager = {
  find: jest.Mock<Promise<Invoice[]>, [typeof Invoice, object]>;
  findOne: jest.Mock<
    Promise<Invoice | Payment | null>,
    [typeof Invoice | typeof Payment, object]
  >;
  create: jest.Mock<
    Record<string, unknown>,
    [unknown, Record<string, unknown>]
  >;
  save: jest.Mock<
    Promise<Record<string, unknown>>,
    [unknown, Record<string, unknown>]
  >;
  remove: jest.Mock<Promise<void>, [unknown, PaymentAllocation[]]>;
  getRepository: jest.Mock<MockEntityRepository<Payment>, [unknown]>;
};

export type MockQueryRunner = {
  connect: jest.Mock<Promise<void>, []>;
  startTransaction: jest.Mock<Promise<void>, []>;
  commitTransaction: jest.Mock<Promise<void>, []>;
  rollbackTransaction: jest.Mock<Promise<void>, []>;
  release: jest.Mock<Promise<void>, []>;
  manager: MockManager;
};

export type PaymentRepositoryMock = {
  findOne: jest.Mock<Promise<Payment | null>, [object]>;
  createQueryBuilder: jest.Mock<SelectQueryBuilder<Payment>, [string?]>;
};

export type AllocationRepositoryMock = {
  find: jest.Mock<Promise<PaymentAllocation[]>, [object]>;
};
export type ServiceContext = {
  service: PaymentService;
  paymentRepo: PaymentRepositoryMock;
  allocationRepo: AllocationRepositoryMock;
  mockManager: MockManager;
  mockQueryRunner: MockQueryRunner;
};

export const MOCK_USER_ID = 'user-uuid-001';
export const MOCK_CUSTOMER_ID = 'cust-uuid-001';
export const FROZEN_DATE = new Date('2026-03-20T00:00:00.000Z');
export const INVALID_ALLOCATABLE_STATUSES = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.PAID,
  InvoiceStatus.VOID,
] as const;

export function buildInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-uuid-001',
    customerId: 'cust-uuid-001',
    invoiceNo: 'INV-20260320-00001',
    invoiceType: InvoiceType.ADMIN,
    totalAmount: 10000,
    status: InvoiceStatus.SENT,
    paymentAllocations: [],
    ...overrides,
  } as Invoice;
}

export function buildPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-uuid-001',
    customerId: 'cust-uuid-001',
    paymentNo: 'PAY-20260320-00001',
    paymentDate: new Date('2026-03-20T00:00:00.000Z'),
    paymentAmount: 10000,
    paymentMethod: PaymentMethod.BANK,
    status: PaymentStatus.REGISTERED,
    remark: null,
    createdBy: MOCK_USER_ID,
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
    createdAt: FROZEN_DATE,
    updatedAt: FROZEN_DATE,
    customer: { customerName: 'テスト顧客' } as Payment['customer'],
    allocations: [],
    ...overrides,
  } as Payment;
}

export function buildAllocation(
  overrides: Partial<PaymentAllocation> = {},
): PaymentAllocation {
  return {
    id: 'alloc-001',
    paymentId: 'pay-uuid-001',
    invoiceId: 'inv-uuid-001',
    allocatedAmount: 10000,
    createdAt: FROZEN_DATE,
    createdBy: MOCK_USER_ID,
    ...overrides,
  } as PaymentAllocation;
}

export function buildCreatePaymentDto(
  overrides: Partial<CreatePaymentDto> = {},
): CreatePaymentDto {
  return {
    customerId: 'cust-uuid-001',
    paymentDate: '2026-03-20',
    paymentAmount: 10000,
    paymentMethod: PaymentMethod.BANK,
    allocations: [{ invoiceId: 'inv-uuid-001', allocatedAmount: 10000 }],
    ...overrides,
  };
}

export function createMockQueryBuilder<TEntity, TRaw = unknown>(options?: {
  items?: TEntity[];
  count?: number;
  entity?: TEntity | null;
  rawRow?: TRaw | null;
  rawRows?: TRaw[];
}): MockQueryBuilder<TEntity, TRaw> {
  const items = options?.items ?? [];
  const count = options?.count ?? items.length;
  const entity = options?.entity ?? null;
  const rawRow = options?.rawRow ?? null;
  const rawRows = options?.rawRows ?? [];
  const qb = {} as MockQueryBuilder<TEntity, TRaw>;
  const chain = <Args extends unknown[]>(): jest.Mock<
    MockQueryBuilder<TEntity, TRaw>,
    Args
  > => jest.fn<MockQueryBuilder<TEntity, TRaw>, Args>().mockReturnValue(qb);

  qb.leftJoinAndSelect = chain<[string, string]>();
  qb.innerJoin = chain<[string, string]>();
  qb.loadRelationCountAndMap = chain<[string, string]>();
  qb.andWhere = chain<[unknown, unknown?]>();
  qb.where = chain<[string, object?]>();
  qb.orWhere = chain<[string, object?]>();
  qb.orderBy = chain<[string, 'ASC' | 'DESC']>();
  qb.skip = chain<[number]>();
  qb.take = chain<[number]>();
  qb.select = chain<[string, string?]>();
  qb.addSelect = chain<[string, string?]>();
  qb.groupBy = chain<[string]>();
  qb.getManyAndCount = jest
    .fn<Promise<[TEntity[], number]>, []>()
    .mockResolvedValue([items, count]);
  qb.getOne = jest.fn<Promise<TEntity | null>, []>().mockResolvedValue(entity);
  qb.getRawOne = jest.fn<Promise<TRaw | null>, []>().mockResolvedValue(rawRow);
  qb.getRawMany = jest.fn<Promise<TRaw[]>, []>().mockResolvedValue(rawRows);

  return qb;
}

export function toSelectQueryBuilder<TEntity>(
  qb: MockQueryBuilder<TEntity>,
): SelectQueryBuilder<TEntity> {
  return qb as unknown as SelectQueryBuilder<TEntity>;
}

export function createContext(): ServiceContext {
  const paymentNumberQb = createMockQueryBuilder<Payment>();
  const mockManager: MockManager = {
    find: jest.fn<Promise<Invoice[]>, [typeof Invoice, object]>(),
    findOne: jest.fn<
      Promise<Invoice | Payment | null>,
      [typeof Invoice | typeof Payment, object]
    >(),
    create: jest
      .fn<Record<string, unknown>, [unknown, Record<string, unknown>]>()
      .mockImplementation((_entity, data) => data),
    save: jest
      .fn<
        Promise<Record<string, unknown>>,
        [unknown, Record<string, unknown>]
      >()
      .mockImplementation((_entity, data) =>
        Promise.resolve({
          ...data,
          id: typeof data.id === 'string' ? data.id : 'generated-uuid',
        }),
      ),
    remove: jest
      .fn<Promise<void>, [unknown, PaymentAllocation[]]>()
      .mockResolvedValue(undefined),
    getRepository: jest.fn(() => ({
      createQueryBuilder: jest
        .fn<SelectQueryBuilder<Payment>, [string?]>()
        .mockReturnValue(toSelectQueryBuilder(paymentNumberQb)),
    })),
  };

  const mockQueryRunner: MockQueryRunner = {
    connect: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    startTransaction: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    commitTransaction: jest
      .fn<Promise<void>, []>()
      .mockResolvedValue(undefined),
    rollbackTransaction: jest
      .fn<Promise<void>, []>()
      .mockResolvedValue(undefined),
    release: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    manager: mockManager,
  };

  const paymentRepo: PaymentRepositoryMock = {
    findOne: jest.fn<Promise<Payment | null>, [object]>(),
    createQueryBuilder: jest.fn<SelectQueryBuilder<Payment>, [string?]>(),
  };
  const allocationRepo: AllocationRepositoryMock = {
    find: jest.fn<Promise<PaymentAllocation[]>, [object]>(),
  };
  const dataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  } as unknown as DataSource;

  return {
    service: new PaymentService(
      paymentRepo as unknown as Repository<Payment>,
      allocationRepo as unknown as Repository<PaymentAllocation>,
      dataSource,
    ),
    paymentRepo,
    allocationRepo,
    mockManager,
    mockQueryRunner,
  };
}

export function mockReloadedPayment(
  paymentRepo: PaymentRepositoryMock,
  overrides: Partial<Payment> = {},
): void {
  paymentRepo.findOne.mockResolvedValue(buildPayment(overrides));
}

export type { PaymentSummaryRow };
