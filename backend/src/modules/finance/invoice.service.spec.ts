import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DeleteResult, Repository, SelectQueryBuilder } from 'typeorm';

import { InvoiceStatus, InvoiceType } from '../../common/constants/enums';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoiceService } from './invoice.service';
import {
  createMockQueryBuilder,
  FROZEN_DATE,
  MOCK_CUSTOMER_ID,
  MOCK_USER_ID,
  type MockQueryBuilder,
  toSelectQueryBuilder,
} from './payment.service.spec-helpers';

type InvoiceRepositoryMock = {
  create: jest.Mock<Invoice, [Partial<Invoice>]>;
  save: jest.Mock<Promise<Invoice>, [Invoice]>;
  findOne: jest.Mock<Promise<Invoice | null>, [object]>;
  softRemove: jest.Mock<Promise<Invoice>, [Invoice]>;
  createQueryBuilder: jest.Mock<SelectQueryBuilder<Invoice>, [string?]>;
};

type ItemRepositoryMock = {
  create: jest.Mock<InvoiceItem, [Partial<InvoiceItem>]>;
  save: jest.Mock<Promise<InvoiceItem[]>, [InvoiceItem[]]>;
  delete: jest.Mock<Promise<DeleteResult>, [object]>;
};

type InvoiceServiceContext = {
  service: InvoiceService;
  invoiceRepo: InvoiceRepositoryMock;
  itemRepo: ItemRepositoryMock;
  invoiceNumberQb: MockQueryBuilder<Invoice>;
};

function buildInvoiceItem(overrides: Partial<InvoiceItem> = {}): InvoiceItem {
  return {
    id: 'item-uuid-001',
    invoiceId: 'inv-uuid-001',
    description: 'テスト項目',
    quantity: 2,
    unitPrice: 5000,
    amount: 10000,
    sortOrder: 0,
    createdAt: FROZEN_DATE,
    updatedAt: FROZEN_DATE,
    ...overrides,
  } as InvoiceItem;
}

function buildInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-uuid-001',
    customerId: MOCK_CUSTOMER_ID,
    invoiceNo: 'INV-20260320-00001',
    invoiceType: InvoiceType.ADMIN,
    totalAmount: 10000,
    currency: 'JPY',
    status: InvoiceStatus.DRAFT,
    dueDate: new Date('2026-04-30T00:00:00.000Z'),
    issuedAt: null,
    relatedId: null,
    relatedType: null,
    remark: null,
    createdBy: MOCK_USER_ID,
    updatedBy: MOCK_USER_ID,
    voidReason: null,
    voidedAt: null,
    voidedBy: null,
    createdAt: FROZEN_DATE,
    updatedAt: FROZEN_DATE,
    deletedAt: null,
    customer: { customerName: 'テスト顧客' } as Invoice['customer'],
    items: [buildInvoiceItem()],
    paymentAllocations: [],
    ...overrides,
  } as Invoice;
}

function createDeleteResult(): DeleteResult {
  return { raw: [], affected: 1 } as DeleteResult;
}

function createContext(): InvoiceServiceContext {
  const invoiceNumberQb = createMockQueryBuilder<Invoice>();
  const invoiceRepo: InvoiceRepositoryMock = {
    create: jest
      .fn<Invoice, [Partial<Invoice>]>()
      .mockImplementation((data) => data as Invoice),
    save: jest.fn<Promise<Invoice>, [Invoice]>().mockImplementation((invoice) =>
      Promise.resolve({
        ...invoice,
        id: invoice.id || 'inv-generated-001',
      }),
    ),
    findOne: jest.fn<Promise<Invoice | null>, [object]>(),
    softRemove: jest
      .fn<Promise<Invoice>, [Invoice]>()
      .mockImplementation((invoice) => Promise.resolve(invoice)),
    createQueryBuilder: jest
      .fn<SelectQueryBuilder<Invoice>, [string?]>()
      .mockReturnValue(toSelectQueryBuilder(invoiceNumberQb)),
  };
  const itemRepo: ItemRepositoryMock = {
    create: jest
      .fn<InvoiceItem, [Partial<InvoiceItem>]>()
      .mockImplementation((data) => data as InvoiceItem),
    save: jest
      .fn<Promise<InvoiceItem[]>, [InvoiceItem[]]>()
      .mockImplementation((items) => Promise.resolve(items)),
    delete: jest
      .fn<Promise<DeleteResult>, [object]>()
      .mockResolvedValue(createDeleteResult()),
  };

  return {
    service: new InvoiceService(
      invoiceRepo as unknown as Repository<Invoice>,
      itemRepo as unknown as Repository<InvoiceItem>,
    ),
    invoiceRepo,
    itemRepo,
    invoiceNumberQb,
  };
}

function mockReloadedInvoice(
  repo: InvoiceRepositoryMock,
  overrides: Partial<Invoice> = {},
): void {
  repo.findOne.mockResolvedValue(buildInvoice(overrides));
}

function getCreatedInvoice(repo: InvoiceRepositoryMock): Partial<Invoice> {
  const created = repo.create.mock.calls[0]?.[0];
  if (!created) {
    throw new Error('Expected invoiceRepo.create to be called');
  }
  return created;
}

function getSavedInvoice(repo: InvoiceRepositoryMock): Invoice {
  const saved = repo.save.mock.calls[0]?.[0];
  if (!saved) {
    throw new Error('Expected invoiceRepo.save to be called');
  }
  return saved;
}

let service: InvoiceService;
let invoiceRepo: InvoiceRepositoryMock;
let itemRepo: ItemRepositoryMock;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(FROZEN_DATE);
  ({ service, invoiceRepo, itemRepo } = createContext());
});

afterEach(() => {
  jest.useRealTimers();
});

describe('InvoiceService setup', () => {
  it('creates the service instance', () => {
    expect(service).toBeDefined();
  });
});

describe('InvoiceService create', () => {
  it('creates an invoice with items and auto-calculates total', async () => {
    const createdItems = [
      buildInvoiceItem({
        description: 'サービスA',
        quantity: 2,
        amount: 10000,
      }),
      buildInvoiceItem({
        id: 'item-uuid-002',
        description: 'サービスB',
        quantity: 1,
        unitPrice: 3000,
        amount: 3000,
      }),
    ];
    mockReloadedInvoice(invoiceRepo, {
      id: 'inv-uuid-new',
      totalAmount: 13000,
      items: createdItems,
    });

    const result = await service.create(
      {
        customerId: MOCK_CUSTOMER_ID,
        invoiceType: InvoiceType.ADMIN,
        dueDate: '2026-04-30',
        items: [
          { description: 'サービスA', quantity: 2, unitPrice: 5000 },
          { description: 'サービスB', unitPrice: 3000 },
        ],
      },
      MOCK_USER_ID,
    );

    expect(invoiceRepo.create.mock.calls).toHaveLength(1);
    expect(invoiceRepo.save.mock.calls).toHaveLength(1);
    expect(result.totalAmount).toBe(13000);
    expect(result.items).toHaveLength(2);

    const created = getCreatedInvoice(invoiceRepo);
    expect(created.status).toBe(InvoiceStatus.DRAFT);
    expect(created.totalAmount).toBe(13000);
    expect(created.items).toHaveLength(2);
  });
});

describe('InvoiceService findAll', () => {
  it('returns paginated results', async () => {
    const qb = createMockQueryBuilder<Invoice>({
      items: [buildInvoice()],
      count: 1,
    });
    invoiceRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    const result = await service.findAll({ page: 1, pageSize: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it('applies the status filter', async () => {
    const qb = createMockQueryBuilder<Invoice>();
    invoiceRepo.createQueryBuilder.mockReturnValue(toSelectQueryBuilder(qb));

    await service.findAll({ status: InvoiceStatus.DRAFT });

    expect(qb.andWhere).toHaveBeenCalledWith('inv.status = :status', {
      status: InvoiceStatus.DRAFT,
    });
  });
});

describe('InvoiceService findOne', () => {
  it('returns an invoice with relations', async () => {
    invoiceRepo.findOne.mockResolvedValue(buildInvoice());

    await expect(service.findOne('inv-uuid-001')).resolves.toMatchObject({
      invoiceNo: 'INV-20260320-00001',
    });
  });

  it('throws when the invoice does not exist', async () => {
    invoiceRepo.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });
});

describe('InvoiceService update', () => {
  it('updates a draft invoice', async () => {
    invoiceRepo.findOne
      .mockResolvedValueOnce(buildInvoice())
      .mockResolvedValueOnce(buildInvoice({ remark: '更新済み' }));

    await service.update('inv-uuid-001', { remark: '更新済み' }, MOCK_USER_ID);

    expect(invoiceRepo.save.mock.calls).toHaveLength(1);
  });

  it('rejects updates on non-draft invoices', async () => {
    invoiceRepo.findOne.mockResolvedValue(
      buildInvoice({ status: InvoiceStatus.SENT }),
    );

    await expect(
      service.update('inv-uuid-001', { remark: '更新' }, MOCK_USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('recalculates total when items are replaced', async () => {
    invoiceRepo.findOne
      .mockResolvedValueOnce(buildInvoice())
      .mockResolvedValueOnce(
        buildInvoice({
          totalAmount: 6000,
          items: [
            buildInvoiceItem({
              description: '新項目',
              quantity: 3,
              unitPrice: 2000,
              amount: 6000,
            }),
          ],
        }),
      );

    await service.update(
      'inv-uuid-001',
      {
        items: [{ description: '新項目', quantity: 3, unitPrice: 2000 }],
      },
      MOCK_USER_ID,
    );

    const saved = getSavedInvoice(invoiceRepo);
    expect(saved.totalAmount).toBe(6000);
    expect(itemRepo.delete.mock.calls).toHaveLength(1);
  });
});

describe('InvoiceService updateStatus', () => {
  it('transitions DRAFT to SENT and stamps issuedAt', async () => {
    invoiceRepo.findOne
      .mockResolvedValueOnce(buildInvoice())
      .mockResolvedValueOnce(
        buildInvoice({
          status: InvoiceStatus.SENT,
          issuedAt: new Date(FROZEN_DATE),
        }),
      );

    await service.updateStatus(
      'inv-uuid-001',
      InvoiceStatus.SENT,
      MOCK_USER_ID,
    );

    const saved = getSavedInvoice(invoiceRepo);
    expect(saved.status).toBe(InvoiceStatus.SENT);
    expect(saved.issuedAt).toBeInstanceOf(Date);
  });

  it('rejects invalid transition DRAFT to PAID', async () => {
    invoiceRepo.findOne.mockResolvedValue(buildInvoice());

    await expect(
      service.updateStatus('inv-uuid-001', InvoiceStatus.PAID, MOCK_USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects transitions from terminal PAID state', async () => {
    invoiceRepo.findOne.mockResolvedValue(
      buildInvoice({ status: InvoiceStatus.PAID }),
    );

    await expect(
      service.updateStatus('inv-uuid-001', InvoiceStatus.SENT, MOCK_USER_ID),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects transitions from terminal VOID state', async () => {
    invoiceRepo.findOne.mockResolvedValue(
      buildInvoice({ status: InvoiceStatus.VOID }),
    );

    await expect(
      service.updateStatus('inv-uuid-001', InvoiceStatus.DRAFT, MOCK_USER_ID),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('InvoiceService voidInvoice', () => {
  it('voids a draft invoice', async () => {
    invoiceRepo.findOne
      .mockResolvedValueOnce(buildInvoice({ paymentAllocations: [] }))
      .mockResolvedValueOnce(
        buildInvoice({
          status: InvoiceStatus.VOID,
          paymentAllocations: [],
          voidReason: '顧客キャンセル',
          voidedAt: new Date(FROZEN_DATE),
          voidedBy: MOCK_USER_ID,
        }),
      );

    await service.voidInvoice(
      'inv-uuid-001',
      { voidReason: '顧客キャンセル' },
      MOCK_USER_ID,
    );

    const saved = getSavedInvoice(invoiceRepo);
    expect(saved.status).toBe(InvoiceStatus.VOID);
    expect(saved.voidReason).toBe('顧客キャンセル');
    expect(saved.voidedAt).toBeInstanceOf(Date);
    expect(saved.voidedBy).toBe(MOCK_USER_ID);
  });

  it('voids a sent invoice without payments', async () => {
    invoiceRepo.findOne
      .mockResolvedValueOnce(
        buildInvoice({
          status: InvoiceStatus.SENT,
          paymentAllocations: [],
        }),
      )
      .mockResolvedValueOnce(
        buildInvoice({
          status: InvoiceStatus.VOID,
          paymentAllocations: [],
        }),
      );

    await service.voidInvoice(
      'inv-uuid-001',
      { voidReason: '誤発行' },
      MOCK_USER_ID,
    );

    expect(getSavedInvoice(invoiceRepo).status).toBe(InvoiceStatus.VOID);
  });

  it('rejects voiding a partial invoice with payments', async () => {
    invoiceRepo.findOne.mockResolvedValue(
      buildInvoice({
        status: InvoiceStatus.PARTIAL,
        paymentAllocations: [{ id: 'pa-001', allocatedAmount: 5000 } as never],
      }),
    );

    await expect(
      service.voidInvoice(
        'inv-uuid-001',
        { voidReason: '取り消し' },
        MOCK_USER_ID,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects voiding a paid invoice', async () => {
    invoiceRepo.findOne.mockResolvedValue(
      buildInvoice({
        status: InvoiceStatus.PAID,
        paymentAllocations: [],
      }),
    );

    await expect(
      service.voidInvoice(
        'inv-uuid-001',
        { voidReason: '取り消し' },
        MOCK_USER_ID,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('InvoiceService remove', () => {
  it('soft deletes a draft invoice', async () => {
    invoiceRepo.findOne.mockResolvedValue(buildInvoice());

    await service.remove('inv-uuid-001');

    expect(invoiceRepo.softRemove.mock.calls).toHaveLength(1);
  });

  it('rejects deleting non-draft invoices', async () => {
    invoiceRepo.findOne.mockResolvedValue(
      buildInvoice({ status: InvoiceStatus.SENT }),
    );

    await expect(service.remove('inv-uuid-001')).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('InvoiceService getAvailableTransitions', () => {
  it('returns SENT and VOID for DRAFT', () => {
    const transitions = service.getAvailableTransitions(InvoiceStatus.DRAFT);

    expect(transitions).toContain(InvoiceStatus.SENT);
    expect(transitions).toContain(InvoiceStatus.VOID);
    expect(transitions).not.toContain(InvoiceStatus.PAID);
  });

  it('returns no transitions for PAID', () => {
    expect(service.getAvailableTransitions(InvoiceStatus.PAID)).toHaveLength(0);
  });

  it('returns no transitions for VOID', () => {
    expect(service.getAvailableTransitions(InvoiceStatus.VOID)).toHaveLength(0);
  });

  it('returns PARTIAL, PAID, and VOID for SENT', () => {
    const transitions = service.getAvailableTransitions(InvoiceStatus.SENT);

    expect(transitions).toContain(InvoiceStatus.PARTIAL);
    expect(transitions).toContain(InvoiceStatus.PAID);
    expect(transitions).toContain(InvoiceStatus.VOID);
  });
});
