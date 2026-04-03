import { DataSource, type Repository, type SelectQueryBuilder } from 'typeorm';

import {
  DepositTransactionType,
  InvoiceStatus,
  InvoiceType,
} from '../../common/constants/enums';
import { DepositService } from './deposit.service';
import type { CreateDepositAdjustmentDto } from './dto/create-deposit-adjustment.dto';
import type { CreateDepositOffsetDto } from './dto/create-deposit-offset.dto';
import type { CreateDepositRechargeDto } from './dto/create-deposit-recharge.dto';
import type { CreateDepositRefundDto } from './dto/create-deposit-refund.dto';
import { DepositAccount } from './entities/deposit-account.entity';
import { DepositTransaction } from './entities/deposit-transaction.entity';
import { Invoice } from './entities/invoice.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import {
  createMockQueryBuilder,
  FROZEN_DATE,
  MOCK_CUSTOMER_ID,
  MOCK_USER_ID,
  type MockQueryBuilder,
  toSelectQueryBuilder,
} from './payment.service.spec-helpers';

export type DepositAccountRepositoryMock = {
  findOne: jest.Mock<Promise<DepositAccount | null>, [object]>;
  createQueryBuilder: jest.Mock<SelectQueryBuilder<DepositAccount>, [string?]>;
};

export type DepositTransactionRepositoryMock = {
  findOne: jest.Mock<Promise<DepositTransaction | null>, [object]>;
  createQueryBuilder: jest.Mock<
    SelectQueryBuilder<DepositTransaction>,
    [string?]
  >;
};

export type DepositMockManager = {
  findOne: jest.Mock<
    Promise<DepositAccount | Invoice | null>,
    [typeof DepositAccount | typeof Invoice, object]
  >;
  create: jest.Mock<object, [unknown, object]>;
  save: jest.Mock<Promise<object>, [unknown, object]>;
  createQueryBuilder: jest.Mock<
    SelectQueryBuilder<DepositTransaction>,
    [typeof DepositTransaction, string]
  >;
};

export type DepositMockQueryRunner = {
  connect: jest.Mock<Promise<void>, []>;
  startTransaction: jest.Mock<Promise<void>, []>;
  commitTransaction: jest.Mock<Promise<void>, []>;
  rollbackTransaction: jest.Mock<Promise<void>, []>;
  release: jest.Mock<Promise<void>, []>;
  manager: DepositMockManager;
};

export type DepositServiceContext = {
  service: DepositService;
  accountRepo: DepositAccountRepositoryMock;
  txnRepo: DepositTransactionRepositoryMock;
  mockManager: DepositMockManager;
  mockQueryRunner: DepositMockQueryRunner;
  offsetQb: MockQueryBuilder<DepositTransaction, { total: string }>;
};

export const INVALID_OFFSET_STATUSES = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.PAID,
  InvoiceStatus.VOID,
] as const;

export function buildDepositAccount(
  overrides: Partial<DepositAccount> = {},
): DepositAccount {
  return {
    id: 'da-uuid-001',
    customerId: MOCK_CUSTOMER_ID,
    balance: 50000,
    createdAt: FROZEN_DATE,
    updatedAt: FROZEN_DATE,
    customer: {
      id: MOCK_CUSTOMER_ID,
      customerName: 'テスト顧客',
      customerCode: 'C-001',
    } as DepositAccount['customer'],
    transactions: [],
    ...overrides,
  } as DepositAccount;
}

export function buildDepositPaymentAllocation(
  overrides: Partial<PaymentAllocation> = {},
): PaymentAllocation {
  return {
    id: 'alloc-uuid-001',
    paymentId: 'pay-uuid-001',
    invoiceId: 'inv-uuid-001',
    allocatedAmount: 10000,
    createdAt: FROZEN_DATE,
    createdBy: MOCK_USER_ID,
    ...overrides,
  } as PaymentAllocation;
}

export function buildDepositInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-uuid-001',
    customerId: MOCK_CUSTOMER_ID,
    invoiceNo: 'INV-20260320-00001',
    invoiceType: InvoiceType.ADMIN,
    totalAmount: 30000,
    status: InvoiceStatus.SENT,
    paymentAllocations: [],
    ...overrides,
  } as Invoice;
}

export function buildDepositTransaction(
  overrides: Partial<DepositTransaction> = {},
): DepositTransaction {
  return {
    id: 'dt-uuid-001',
    depositAccountId: 'da-uuid-001',
    transactionType: DepositTransactionType.RECHARGE,
    amount: 10000,
    balanceAfter: 60000,
    relatedInvoiceId: null,
    remark: null,
    createdBy: MOCK_USER_ID,
    createdAt: FROZEN_DATE,
    depositAccount: buildDepositAccount(),
    relatedInvoice: null,
    ...overrides,
  } as DepositTransaction;
}

export function createDepositContext(): DepositServiceContext {
  const offsetQb = createMockQueryBuilder<
    DepositTransaction,
    { total: string }
  >({
    rawRow: { total: '0' },
  });
  const mockManager: DepositMockManager = {
    findOne: jest.fn<
      Promise<DepositAccount | Invoice | null>,
      [typeof DepositAccount | typeof Invoice, object]
    >(),
    create: jest
      .fn<object, [unknown, object]>()
      .mockImplementation((_entity, data) => data),
    save: jest
      .fn<Promise<object>, [unknown, object]>()
      .mockImplementation((_entity, data) => {
        const entityRecord = data as Record<string, unknown>;

        return Promise.resolve({
          ...entityRecord,
          id:
            typeof entityRecord.id === 'string'
              ? entityRecord.id
              : 'generated-uuid',
        });
      }),
    createQueryBuilder: jest
      .fn<
        SelectQueryBuilder<DepositTransaction>,
        [typeof DepositTransaction, string]
      >()
      .mockReturnValue(toSelectQueryBuilder(offsetQb)),
  };
  const mockQueryRunner: DepositMockQueryRunner = {
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
  const accountRepo: DepositAccountRepositoryMock = {
    findOne: jest.fn<Promise<DepositAccount | null>, [object]>(),
    createQueryBuilder: jest.fn<
      SelectQueryBuilder<DepositAccount>,
      [string?]
    >(),
  };
  const txnRepo: DepositTransactionRepositoryMock = {
    findOne: jest.fn<Promise<DepositTransaction | null>, [object]>(),
    createQueryBuilder: jest.fn<
      SelectQueryBuilder<DepositTransaction>,
      [string?]
    >(),
  };
  const invoiceRepo = {
    findOne: jest.fn<Promise<Invoice | null>, [object]>(),
  };
  const dataSource = {
    createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
  } as unknown as DataSource;

  return {
    service: new DepositService(
      accountRepo as unknown as Repository<DepositAccount>,
      txnRepo as unknown as Repository<DepositTransaction>,
      invoiceRepo as unknown as Repository<Invoice>,
      dataSource,
    ),
    accountRepo,
    txnRepo,
    mockManager,
    mockQueryRunner,
    offsetQb,
  };
}

export function mockReloadedTransaction(
  txnRepo: DepositTransactionRepositoryMock,
  overrides: Partial<DepositTransaction> = {},
): void {
  txnRepo.findOne.mockResolvedValue(buildDepositTransaction(overrides));
}

export function rechargeDeposit(
  service: DepositService,
  overrides: Partial<CreateDepositRechargeDto> = {},
): Promise<DepositTransaction> {
  return service.recharge(
    { customerId: MOCK_CUSTOMER_ID, amount: 10000, ...overrides },
    MOCK_USER_ID,
  );
}

export function offsetDeposit(
  service: DepositService,
  overrides: Partial<CreateDepositOffsetDto> = {},
): Promise<DepositTransaction> {
  return service.offset(
    {
      customerId: MOCK_CUSTOMER_ID,
      invoiceId: 'inv-uuid-001',
      amount: 10000,
      ...overrides,
    },
    MOCK_USER_ID,
  );
}

export function refundDeposit(
  service: DepositService,
  overrides: Partial<CreateDepositRefundDto> = {},
): Promise<DepositTransaction> {
  return service.refund(
    {
      customerId: MOCK_CUSTOMER_ID,
      amount: 10000,
      reason: 'テスト',
      ...overrides,
    },
    MOCK_USER_ID,
  );
}

export function adjustDeposit(
  service: DepositService,
  overrides: Partial<CreateDepositAdjustmentDto> = {},
): Promise<DepositTransaction> {
  return service.adjustment(
    {
      customerId: MOCK_CUSTOMER_ID,
      amount: 1000,
      reason: 'テスト',
      ...overrides,
    },
    MOCK_USER_ID,
  );
}
