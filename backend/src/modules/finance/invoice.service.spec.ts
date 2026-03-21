import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { InvoiceService } from './invoice.service'
import { Invoice } from './entities/invoice.entity'
import { InvoiceItem } from './entities/invoice-item.entity'
import { InvoiceStatus, InvoiceType } from '../../common/constants/enums'

function createMockQueryBuilder(
  result: any[] = [],
  count = 0,
): Partial<SelectQueryBuilder<any>> {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    loadRelationCountAndMap: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([result, count]),
    getOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
  }
  return qb
}

describe('InvoiceService', () => {
  let service: InvoiceService
  let invoiceRepo: jest.Mocked<Repository<Invoice>>
  let itemRepo: jest.Mocked<Repository<InvoiceItem>>

  const mockUserId = 'user-uuid-001'

  const mockInvoice: Partial<Invoice> = {
    id: 'inv-uuid-001',
    customerId: 'cust-uuid-001',
    invoiceNo: 'INV-20260319-00001',
    invoiceType: InvoiceType.ADMIN,
    totalAmount: 10000,
    currency: 'JPY',
    status: InvoiceStatus.DRAFT,
    dueDate: new Date('2026-04-30'),
    issuedAt: null,
    relatedId: null,
    relatedType: null,
    remark: null,
    createdBy: mockUserId,
    updatedBy: mockUserId,
    voidReason: null,
    voidedAt: null,
    voidedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    customer: { customerName: 'テスト顧客' } as any,
    items: [
      {
        id: 'item-uuid-001',
        invoiceId: 'inv-uuid-001',
        description: 'テスト項目',
        quantity: 2,
        unitPrice: 5000,
        amount: 10000,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as InvoiceItem,
    ],
    paymentAllocations: [],
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: getRepositoryToken(Invoice),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            softRemove: jest.fn(),
            createQueryBuilder: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InvoiceItem),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn(),
          },
        },
      ],
    }).compile()

    service = module.get<InvoiceService>(InvoiceService)
    invoiceRepo = module.get(getRepositoryToken(Invoice))
    itemRepo = module.get(getRepositoryToken(InvoiceItem))
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('create', () => {
    it('should create an invoice with items and auto-calculate total', async () => {
      const qb = createMockQueryBuilder()
      invoiceRepo.createQueryBuilder.mockReturnValue(qb as any)

      const createdInvoice = { ...mockInvoice, id: 'inv-uuid-new' }
      invoiceRepo.create.mockReturnValue(createdInvoice as Invoice)
      invoiceRepo.save.mockResolvedValue(createdInvoice as Invoice)
      invoiceRepo.findOne.mockResolvedValue(createdInvoice as Invoice)

      itemRepo.create.mockImplementation((data) => data as InvoiceItem)

      const result = await service.create(
        {
          customerId: 'cust-uuid-001',
          invoiceType: InvoiceType.ADMIN,
          dueDate: '2026-04-30',
          items: [
            { description: 'サービスA', quantity: 2, unitPrice: 5000 },
            { description: 'サービスB', unitPrice: 3000 },
          ],
        },
        mockUserId,
      )

      expect(invoiceRepo.create).toHaveBeenCalled()
      expect(invoiceRepo.save).toHaveBeenCalled()

      const createCall = invoiceRepo.create.mock.calls[0][0] as any
      expect(createCall.status).toBe(InvoiceStatus.DRAFT)
      expect(createCall.totalAmount).toBe(13000)
      expect(createCall.items).toHaveLength(2)
    })
  })

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const qb = createMockQueryBuilder([mockInvoice as Invoice], 1)
      invoiceRepo.createQueryBuilder.mockReturnValue(qb as any)

      const result = await service.findAll({ page: 1, pageSize: 20 })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
    })

    it('should apply status filter', async () => {
      const qb = createMockQueryBuilder([], 0)
      invoiceRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAll({ status: InvoiceStatus.DRAFT })

      expect(qb.andWhere).toHaveBeenCalledWith(
        'inv.status = :status',
        { status: InvoiceStatus.DRAFT },
      )
    })
  })

  describe('findOne', () => {
    it('should return invoice with relations', async () => {
      invoiceRepo.findOne.mockResolvedValue(mockInvoice as Invoice)

      const result = await service.findOne('inv-uuid-001')
      expect(result.invoiceNo).toBe('INV-20260319-00001')
    })

    it('should throw NotFoundException if not found', async () => {
      invoiceRepo.findOne.mockResolvedValue(null)

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('update', () => {
    it('should update draft invoice', async () => {
      const draftInvoice = { ...mockInvoice, status: InvoiceStatus.DRAFT }
      invoiceRepo.findOne.mockResolvedValue(draftInvoice as Invoice)
      invoiceRepo.save.mockResolvedValue(draftInvoice as Invoice)

      await service.update('inv-uuid-001', { remark: '更新済み' }, mockUserId)

      expect(invoiceRepo.save).toHaveBeenCalled()
    })

    it('should reject update on non-draft invoice', async () => {
      const sentInvoice = { ...mockInvoice, status: InvoiceStatus.SENT }
      invoiceRepo.findOne.mockResolvedValue(sentInvoice as Invoice)

      await expect(
        service.update('inv-uuid-001', { remark: '更新' }, mockUserId),
      ).rejects.toThrow(BadRequestException)
    })

    it('should recalculate total when items are updated', async () => {
      const draftInvoice = { ...mockInvoice, status: InvoiceStatus.DRAFT }
      invoiceRepo.findOne.mockResolvedValue(draftInvoice as Invoice)
      invoiceRepo.save.mockImplementation(async (entity: any) => entity)
      itemRepo.delete.mockResolvedValue({ affected: 1 } as any)
      itemRepo.create.mockImplementation((data) => data as InvoiceItem)
      itemRepo.save.mockImplementation(async (entities) => entities as any)

      await service.update(
        'inv-uuid-001',
        {
          items: [{ description: '新項目', quantity: 3, unitPrice: 2000 }],
        },
        mockUserId,
      )

      const savedInvoice = invoiceRepo.save.mock.calls[0][0] as any
      expect(savedInvoice.totalAmount).toBe(6000)
    })
  })

  describe('updateStatus', () => {
    it('should transition DRAFT → SENT', async () => {
      const draftInvoice = { ...mockInvoice, status: InvoiceStatus.DRAFT }
      invoiceRepo.findOne.mockResolvedValue(draftInvoice as Invoice)
      invoiceRepo.save.mockImplementation(async (entity: any) => entity)

      await service.updateStatus('inv-uuid-001', InvoiceStatus.SENT, mockUserId)

      const saved = invoiceRepo.save.mock.calls[0][0] as any
      expect(saved.status).toBe(InvoiceStatus.SENT)
      expect(saved.issuedAt).toBeInstanceOf(Date)
    })

    it('should reject invalid transition DRAFT → PAID', async () => {
      const draftInvoice = { ...mockInvoice, status: InvoiceStatus.DRAFT }
      invoiceRepo.findOne.mockResolvedValue(draftInvoice as Invoice)

      await expect(
        service.updateStatus('inv-uuid-001', InvoiceStatus.PAID, mockUserId),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject transition from terminal state PAID', async () => {
      const paidInvoice = { ...mockInvoice, status: InvoiceStatus.PAID }
      invoiceRepo.findOne.mockResolvedValue(paidInvoice as Invoice)

      await expect(
        service.updateStatus('inv-uuid-001', InvoiceStatus.SENT, mockUserId),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject transition from terminal state VOID', async () => {
      const voidInvoice = { ...mockInvoice, status: InvoiceStatus.VOID }
      invoiceRepo.findOne.mockResolvedValue(voidInvoice as Invoice)

      await expect(
        service.updateStatus('inv-uuid-001', InvoiceStatus.DRAFT, mockUserId),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('voidInvoice', () => {
    it('should void a draft invoice', async () => {
      const draftInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.DRAFT,
        paymentAllocations: [],
      }
      invoiceRepo.findOne.mockResolvedValue(draftInvoice as Invoice)
      invoiceRepo.save.mockImplementation(async (entity: any) => entity)

      await service.voidInvoice(
        'inv-uuid-001',
        { voidReason: '顧客キャンセル' },
        mockUserId,
      )

      const saved = invoiceRepo.save.mock.calls[0][0] as any
      expect(saved.status).toBe(InvoiceStatus.VOID)
      expect(saved.voidReason).toBe('顧客キャンセル')
      expect(saved.voidedAt).toBeInstanceOf(Date)
      expect(saved.voidedBy).toBe(mockUserId)
    })

    it('should void a sent invoice without payments', async () => {
      const sentInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
        paymentAllocations: [],
      }
      invoiceRepo.findOne.mockResolvedValue(sentInvoice as Invoice)
      invoiceRepo.save.mockImplementation(async (entity: any) => entity)

      await service.voidInvoice(
        'inv-uuid-001',
        { voidReason: '誤発行' },
        mockUserId,
      )

      const saved = invoiceRepo.save.mock.calls[0][0] as any
      expect(saved.status).toBe(InvoiceStatus.VOID)
    })

    it('should reject voiding a partial invoice with payments', async () => {
      const partialInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PARTIAL,
        paymentAllocations: [{ id: 'pa-001', allocatedAmount: 5000 }],
      }
      invoiceRepo.findOne.mockResolvedValue(partialInvoice as Invoice)

      await expect(
        service.voidInvoice(
          'inv-uuid-001',
          { voidReason: '取り消し' },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject voiding a paid invoice', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        paymentAllocations: [],
      }
      invoiceRepo.findOne.mockResolvedValue(paidInvoice as Invoice)

      await expect(
        service.voidInvoice(
          'inv-uuid-001',
          { voidReason: '取り消し' },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('remove', () => {
    it('should soft delete a draft invoice', async () => {
      const draftInvoice = { ...mockInvoice, status: InvoiceStatus.DRAFT }
      invoiceRepo.findOne.mockResolvedValue(draftInvoice as Invoice)
      invoiceRepo.softRemove.mockResolvedValue(draftInvoice as Invoice)

      await service.remove('inv-uuid-001')
      expect(invoiceRepo.softRemove).toHaveBeenCalled()
    })

    it('should reject deleting non-draft invoice', async () => {
      const sentInvoice = { ...mockInvoice, status: InvoiceStatus.SENT }
      invoiceRepo.findOne.mockResolvedValue(sentInvoice as Invoice)

      await expect(service.remove('inv-uuid-001')).rejects.toThrow(
        BadRequestException,
      )
    })
  })

  describe('getAvailableTransitions', () => {
    it('should return correct transitions for DRAFT', () => {
      const transitions = service.getAvailableTransitions(InvoiceStatus.DRAFT)
      expect(transitions).toContain(InvoiceStatus.SENT)
      expect(transitions).toContain(InvoiceStatus.VOID)
      expect(transitions).not.toContain(InvoiceStatus.PAID)
    })

    it('should return empty for PAID (terminal state)', () => {
      const transitions = service.getAvailableTransitions(InvoiceStatus.PAID)
      expect(transitions).toHaveLength(0)
    })

    it('should return empty for VOID (terminal state)', () => {
      const transitions = service.getAvailableTransitions(InvoiceStatus.VOID)
      expect(transitions).toHaveLength(0)
    })

    it('should allow SENT → PARTIAL, PAID, VOID', () => {
      const transitions = service.getAvailableTransitions(InvoiceStatus.SENT)
      expect(transitions).toContain(InvoiceStatus.PARTIAL)
      expect(transitions).toContain(InvoiceStatus.PAID)
      expect(transitions).toContain(InvoiceStatus.VOID)
    })
  })
})
