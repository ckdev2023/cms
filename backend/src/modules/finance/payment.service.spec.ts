import { BadRequestException, NotFoundException } from '@nestjs/common';

import { InvoiceStatus, PaymentStatus } from '../../common/constants/enums';
import { Invoice } from './entities/invoice.entity';
import type { Payment } from './entities/payment.entity';
import {
  buildAllocation,
  buildCreatePaymentDto,
  buildInvoice,
  buildPayment,
  createContext,
  createMockQueryBuilder,
  FROZEN_DATE,
  INVALID_ALLOCATABLE_STATUSES,
  MOCK_USER_ID,
  mockReloadedPayment,
  type PaymentSummaryRow,
  toSelectQueryBuilder,
} from './payment.service.spec-helpers';

beforeEach(() => jest.useFakeTimers().setSystemTime(FROZEN_DATE));
afterEach(() => jest.useRealTimers());

describe('PaymentService setup', () => {
  it('creates the service instance', () => {
    expect(createContext().service).toBeDefined();
  });
});

describe('PaymentService create validation', () => {
  it('rejects mismatched allocation totals', async () => {
    const { service } = createContext();

    await expect(
      service.create(
        buildCreatePaymentDto({
          allocations: [{ invoiceId: 'inv-uuid-001', allocatedAmount: 5000 }],
        }),
        MOCK_USER_ID,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects missing invoices', async () => {
    const { service, mockManager } = createContext();
    mockManager.find.mockResolvedValue([]);

    await expect(
      service.create(buildCreatePaymentDto(), MOCK_USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invoices from another customer', async () => {
    const { service, mockManager } = createContext();
    mockManager.find.mockResolvedValue([
      buildInvoice({ customerId: 'other-customer' }),
    ]);

    await expect(
      service.create(buildCreatePaymentDto(), MOCK_USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it.each(INVALID_ALLOCATABLE_STATUSES)(
    'rejects non-allocatable invoice status %s',
    async (status) => {
      const { service, mockManager } = createContext();
      mockManager.find.mockResolvedValue([buildInvoice({ status })]);

      await expect(
        service.create(buildCreatePaymentDto(), MOCK_USER_ID),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('rejects allocations above the remaining invoice amount', async () => {
    const { service, mockManager } = createContext();
    mockManager.find.mockResolvedValue([
      buildInvoice({
        paymentAllocations: [buildAllocation({ allocatedAmount: 8000 })],
      }),
    ]);

    await expect(
      service.create(buildCreatePaymentDto(), MOCK_USER_ID),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('PaymentService create single-invoice success', () => {
  it('creates a payment and recalculates the target invoice', async () => {
    const { service, paymentRepo, mockManager, mockQueryRunner } =
      createContext();
    mockManager.find.mockResolvedValue([buildInvoice()]);
    mockManager.findOne.mockResolvedValueOnce(
      buildInvoice({
        paymentAllocations: [buildAllocation({ allocatedAmount: 10000 })],
        status: InvoiceStatus.SENT,
      }),
    );
    mockReloadedPayment(paymentRepo, {
      allocations: [buildAllocation({ invoice: buildInvoice() })],
    });
    const result = await service.create(buildCreatePaymentDto(), MOCK_USER_ID);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(result.paymentNo).toBe('PAY-20260320-00001');
  });

  it('marks the invoice as PARTIAL when allocation is incomplete', async () => {
    const { service, paymentRepo, mockManager, mockQueryRunner } =
      createContext();
    mockManager.find.mockResolvedValue([buildInvoice()]);
    mockManager.findOne.mockResolvedValueOnce(
      buildInvoice({
        paymentAllocations: [buildAllocation({ allocatedAmount: 5000 })],
      }),
    );
    mockReloadedPayment(paymentRepo, {
      paymentAmount: 5000,
      allocations: [buildAllocation({ allocatedAmount: 5000 })],
    });
    await service.create(
      buildCreatePaymentDto({
        paymentAmount: 5000,
        allocations: [{ invoiceId: 'inv-uuid-001', allocatedAmount: 5000 }],
      }),
      MOCK_USER_ID,
    );

    expect(mockManager.save).toHaveBeenCalledWith(
      Invoice,
      expect.objectContaining({ status: InvoiceStatus.PARTIAL }),
    );
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });
});

describe('PaymentService create multi-invoice success', () => {
  it('supports allocations across multiple invoices', async () => {
    const { service, paymentRepo, mockManager, mockQueryRunner } =
      createContext();
    const invoice1 = buildInvoice({ id: 'inv-uuid-001', totalAmount: 6000 });
    const invoice2 = buildInvoice({
      id: 'inv-uuid-002',
      invoiceNo: 'INV-20260320-00002',
      totalAmount: 8000,
    });

    mockManager.find.mockResolvedValue([invoice1, invoice2]);
    mockManager.findOne
      .mockResolvedValueOnce(
        buildInvoice({
          ...invoice1,
          paymentAllocations: [buildAllocation({ allocatedAmount: 6000 })],
        }),
      )
      .mockResolvedValueOnce(
        buildInvoice({
          ...invoice2,
          paymentAllocations: [buildAllocation({ allocatedAmount: 4000 })],
        }),
      );
    mockReloadedPayment(paymentRepo, {
      allocations: [
        buildAllocation({ allocatedAmount: 6000 }),
        buildAllocation({
          id: 'alloc-002',
          invoiceId: 'inv-uuid-002',
          allocatedAmount: 4000,
        }),
      ],
    });

    await service.create(
      buildCreatePaymentDto({
        allocations: [
          { invoiceId: 'inv-uuid-001', allocatedAmount: 6000 },
          { invoiceId: 'inv-uuid-002', allocatedAmount: 4000 },
        ],
      }),
      MOCK_USER_ID,
    );

    expect(mockManager.findOne).toHaveBeenCalledTimes(2);
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
  });
});

describe('PaymentService findAll', () => {
  it('returns paginated results', async () => {
    const { service, paymentRepo } = createContext();
    const qb = createMockQueryBuilder<Payment>({ items: [buildPayment()] });
    paymentRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    const result = await service.findAll({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('applies keyword and status filters', async () => {
    const { service, paymentRepo } = createContext();
    const qb = createMockQueryBuilder<Payment>();
    paymentRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    await service.findAll({
      keyword: 'テスト',
      status: PaymentStatus.REGISTERED,
    });

    expect(qb.andWhere).toHaveBeenCalledWith('p.status = :status', {
      status: PaymentStatus.REGISTERED,
    });
    expect(qb.andWhere).toHaveBeenCalled();
  });

  it('applies invoice and date filters', async () => {
    const { service, paymentRepo } = createContext();
    const qb = createMockQueryBuilder<Payment>();
    paymentRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    await service.findAll({
      invoiceId: 'inv-uuid-001',
      paymentDateFrom: '2026-01-01',
      paymentDateTo: '2026-12-31',
    });

    expect(qb.innerJoin).toHaveBeenCalledWith('p.allocations', 'alloc');
    expect(qb.andWhere).toHaveBeenCalledWith('alloc.invoiceId = :invoiceId', {
      invoiceId: 'inv-uuid-001',
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'p.paymentDate >= :paymentDateFrom',
      { paymentDateFrom: '2026-01-01' },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      'p.paymentDate <= :paymentDateTo',
      { paymentDateTo: '2026-12-31' },
    );
  });
});

describe('PaymentService findOne', () => {
  it('returns the matching payment', async () => {
    const { service, paymentRepo } = createContext();
    paymentRepo.findOne.mockResolvedValue(buildPayment());

    await expect(service.findOne('pay-uuid-001')).resolves.toMatchObject({
      paymentNo: 'PAY-20260320-00001',
    });
  });

  it('throws when the payment does not exist', async () => {
    const { service, paymentRepo } = createContext();
    paymentRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('PaymentService reverse', () => {
  it('reverses a registered payment and recalculates invoices', async () => {
    const { service, paymentRepo, mockManager, mockQueryRunner } =
      createContext();

    mockManager.findOne
      .mockResolvedValueOnce(
        buildPayment({
          allocations: [buildAllocation()],
          status: PaymentStatus.REGISTERED,
        }),
      )
      .mockResolvedValueOnce(
        buildInvoice({ status: InvoiceStatus.PAID, paymentAllocations: [] }),
      );
    mockReloadedPayment(paymentRepo, {
      status: PaymentStatus.REVERSED,
      allocations: [],
    });

    const result = await service.reverse(
      'pay-uuid-001',
      { reversalReason: '誤入金' },
      MOCK_USER_ID,
    );

    expect(mockManager.remove).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(result.status).toBe(PaymentStatus.REVERSED);
  });

  it('rejects already reversed payments', async () => {
    const { service, mockManager } = createContext();
    mockManager.findOne.mockResolvedValue(
      buildPayment({ status: PaymentStatus.REVERSED }),
    );

    await expect(
      service.reverse(
        'pay-uuid-001',
        { reversalReason: '再取消' },
        MOCK_USER_ID,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when reversing a missing payment', async () => {
    const { service, mockManager } = createContext();
    mockManager.findOne.mockResolvedValue(null);

    await expect(
      service.reverse('missing', { reversalReason: 'テスト' }, MOCK_USER_ID),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('PaymentService findByInvoice', () => {
  it('returns allocations linked to the invoice', async () => {
    const { service, allocationRepo } = createContext();
    allocationRepo.find.mockResolvedValue([
      buildAllocation({ payment: buildPayment(), invoice: buildInvoice() }),
    ]);

    const result = await service.findByInvoice('inv-uuid-001');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      paymentNo: 'PAY-20260320-00001',
      allocatedAmount: 10000,
    });
  });

  it('returns an empty array when no allocations exist', async () => {
    const { service, allocationRepo } = createContext();
    allocationRepo.find.mockResolvedValue([]);

    await expect(service.findByInvoice('inv-uuid-999')).resolves.toEqual([]);
  });
});

describe('PaymentService getSummary', () => {
  it('returns summary rows grouped by status', async () => {
    const { service, paymentRepo } = createContext();
    const qb = createMockQueryBuilder<Payment, PaymentSummaryRow>({
      rawRows: [
        { status: PaymentStatus.REGISTERED, count: '5', totalAmount: '50000' },
        { status: PaymentStatus.REVERSED, count: '1', totalAmount: '10000' },
      ],
    });
    paymentRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    await expect(service.getSummary()).resolves.toHaveLength(2);
  });

  it('filters summary rows by customerId', async () => {
    const { service, paymentRepo } = createContext();
    const qb = createMockQueryBuilder<Payment, PaymentSummaryRow>();
    paymentRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    await service.getSummary('cust-uuid-001');

    expect(qb.where).toHaveBeenCalledWith('p.customerId = :customerId', {
      customerId: 'cust-uuid-001',
    });
  });
});
