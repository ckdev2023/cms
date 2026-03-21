import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import {
  Repository,
  DataSource,
  SelectQueryBuilder,
  EntityManager,
} from 'typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { PaymentService } from './payment.service'
import { Payment } from './entities/payment.entity'
import { PaymentAllocation } from './entities/payment-allocation.entity'
import { Invoice } from './entities/invoice.entity'
import {
  PaymentStatus,
  PaymentMethod,
  InvoiceStatus,
  InvoiceType,
} from '../../common/constants/enums'

function createMockQueryBuilder(
  result: any[] = [],
  count = 0,
): Partial<SelectQueryBuilder<any>> {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
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

describe('PaymentService', () => {
  let service: PaymentService
  let paymentRepo: jest.Mocked<Repository<Payment>>
  let allocationRepo: jest.Mocked<Repository<PaymentAllocation>>
  let invoiceRepo: jest.Mocked<Repository<Invoice>>

  const mockUserId = 'user-uuid-001'

  const mockInvoice: Partial<Invoice> = {
    id: 'inv-uuid-001',
    customerId: 'cust-uuid-001',
    invoiceNo: 'INV-20260320-00001',
    invoiceType: InvoiceType.ADMIN,
    totalAmount: 10000,
    status: InvoiceStatus.SENT,
    paymentAllocations: [],
  }

  const mockPayment: Partial<Payment> = {
    id: 'pay-uuid-001',
    customerId: 'cust-uuid-001',
    paymentNo: 'PAY-20260320-00001',
    paymentDate: new Date('2026-03-20'),
    paymentAmount: 10000,
    paymentMethod: PaymentMethod.BANK,
    status: PaymentStatus.REGISTERED,
    remark: null,
    createdBy: mockUserId,
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    customer: { customerName: 'テスト顧客' } as any,
    allocations: [],
  }

  let mockQueryRunner: any
  let mockManager: any

  beforeEach(async () => {
    mockManager = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((_Entity: any, data: any) => data),
      save: jest.fn().mockImplementation((_Entity: any, data: any) => ({
        ...data,
        id: data.id ?? 'generated-uuid',
      })),
      remove: jest.fn(),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(
          createMockQueryBuilder(),
        ),
      }),
    }

    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockManager,
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PaymentAllocation),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile()

    service = module.get<PaymentService>(PaymentService)
    paymentRepo = module.get(getRepositoryToken(Payment))
    allocationRepo = module.get(getRepositoryToken(PaymentAllocation))
    invoiceRepo = module.get(getRepositoryToken(Invoice))
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('create', () => {
    const validDto = {
      customerId: 'cust-uuid-001',
      paymentDate: '2026-03-20',
      paymentAmount: 10000,
      paymentMethod: PaymentMethod.BANK,
      allocations: [{ invoiceId: 'inv-uuid-001', allocatedAmount: 10000 }],
    }

    it('should create a payment with allocations and update invoice status', async () => {
      const invoiceWithAllocs = {
        ...mockInvoice,
        status: InvoiceStatus.SENT,
        paymentAllocations: [],
      }
      mockManager.find.mockResolvedValue([invoiceWithAllocs])
      mockManager.findOne.mockResolvedValue({
        ...invoiceWithAllocs,
        paymentAllocations: [{ allocatedAmount: 10000 }],
      })

      paymentRepo.findOne.mockResolvedValue({
        ...mockPayment,
        allocations: [
          {
            id: 'alloc-001',
            invoiceId: 'inv-uuid-001',
            allocatedAmount: 10000,
            invoice: mockInvoice,
          },
        ],
      } as any)

      const result = await service.create(validDto, mockUserId)

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled()
      expect(result).toBeDefined()
      expect(result.paymentNo).toBe('PAY-20260320-00001')
    })

    it('should reject when allocation total does not match payment amount', async () => {
      await expect(
        service.create(
          {
            ...validDto,
            allocations: [
              { invoiceId: 'inv-uuid-001', allocatedAmount: 5000 },
            ],
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject when invoice not found', async () => {
      mockManager.find.mockResolvedValue([])

      await expect(service.create(validDto, mockUserId)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should reject when invoice belongs to different customer', async () => {
      mockManager.find.mockResolvedValue([
        { ...mockInvoice, customerId: 'other-customer' },
      ])

      await expect(service.create(validDto, mockUserId)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should reject when invoice status is not allocatable (DRAFT)', async () => {
      mockManager.find.mockResolvedValue([
        { ...mockInvoice, status: InvoiceStatus.DRAFT },
      ])

      await expect(service.create(validDto, mockUserId)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should reject when invoice status is not allocatable (PAID)', async () => {
      mockManager.find.mockResolvedValue([
        { ...mockInvoice, status: InvoiceStatus.PAID },
      ])

      await expect(service.create(validDto, mockUserId)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should reject when invoice status is not allocatable (VOID)', async () => {
      mockManager.find.mockResolvedValue([
        { ...mockInvoice, status: InvoiceStatus.VOID },
      ])

      await expect(service.create(validDto, mockUserId)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('should reject when allocation exceeds invoice remaining amount', async () => {
      mockManager.find.mockResolvedValue([
        {
          ...mockInvoice,
          totalAmount: 10000,
          paymentAllocations: [{ allocatedAmount: 8000 }],
        },
      ])

      await expect(
        service.create(
          {
            ...validDto,
            paymentAmount: 10000,
            allocations: [
              { invoiceId: 'inv-uuid-001', allocatedAmount: 10000 },
            ],
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should handle partial payment creating PARTIAL invoice status', async () => {
      const invoiceWithAllocs = {
        ...mockInvoice,
        totalAmount: 10000,
        paymentAllocations: [],
      }
      mockManager.find.mockResolvedValue([invoiceWithAllocs])
      mockManager.findOne
        .mockResolvedValueOnce({
          ...invoiceWithAllocs,
          paymentAllocations: [{ allocatedAmount: 5000 }],
        })

      paymentRepo.findOne.mockResolvedValue({
        ...mockPayment,
        paymentAmount: 5000,
        allocations: [
          {
            id: 'alloc-001',
            invoiceId: 'inv-uuid-001',
            allocatedAmount: 5000,
            invoice: mockInvoice,
          },
        ],
      } as any)

      const result = await service.create(
        {
          ...validDto,
          paymentAmount: 5000,
          allocations: [
            { invoiceId: 'inv-uuid-001', allocatedAmount: 5000 },
          ],
        },
        mockUserId,
      )

      expect(mockManager.save).toHaveBeenCalled()
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled()
    })

    it('should handle multiple allocations to different invoices', async () => {
      const invoice1 = {
        ...mockInvoice,
        id: 'inv-uuid-001',
        totalAmount: 6000,
        paymentAllocations: [],
      }
      const invoice2 = {
        ...mockInvoice,
        id: 'inv-uuid-002',
        invoiceNo: 'INV-20260320-00002',
        totalAmount: 8000,
        paymentAllocations: [],
      }

      mockManager.find.mockResolvedValue([invoice1, invoice2])
      mockManager.findOne
        .mockResolvedValueOnce({
          ...invoice1,
          paymentAllocations: [{ allocatedAmount: 6000 }],
        })
        .mockResolvedValueOnce({
          ...invoice2,
          paymentAllocations: [{ allocatedAmount: 4000 }],
        })

      paymentRepo.findOne.mockResolvedValue({
        ...mockPayment,
        paymentAmount: 10000,
        allocations: [
          { id: 'alloc-001', invoiceId: 'inv-uuid-001', allocatedAmount: 6000 },
          { id: 'alloc-002', invoiceId: 'inv-uuid-002', allocatedAmount: 4000 },
        ],
      } as any)

      await service.create(
        {
          ...validDto,
          paymentAmount: 10000,
          allocations: [
            { invoiceId: 'inv-uuid-001', allocatedAmount: 6000 },
            { invoiceId: 'inv-uuid-002', allocatedAmount: 4000 },
          ],
        },
        mockUserId,
      )

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled()
    })
  })

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const qb = createMockQueryBuilder([mockPayment as Payment], 1)
      paymentRepo.createQueryBuilder.mockReturnValue(qb as any)

      const result = await service.findAll({ page: 1, pageSize: 20 })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
    })

    it('should apply status filter', async () => {
      const qb = createMockQueryBuilder([], 0)
      paymentRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAll({ status: PaymentStatus.REGISTERED })

      expect(qb.andWhere).toHaveBeenCalledWith('p.status = :status', {
        status: PaymentStatus.REGISTERED,
      })
    })

    it('should apply keyword filter', async () => {
      const qb = createMockQueryBuilder([], 0)
      paymentRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAll({ keyword: 'テスト' })

      expect(qb.andWhere).toHaveBeenCalled()
    })

    it('should apply payment method filter', async () => {
      const qb = createMockQueryBuilder([], 0)
      paymentRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAll({ paymentMethod: PaymentMethod.BANK })

      expect(qb.andWhere).toHaveBeenCalledWith(
        'p.paymentMethod = :paymentMethod',
        { paymentMethod: PaymentMethod.BANK },
      )
    })

    it('should filter by invoiceId via inner join', async () => {
      const qb = createMockQueryBuilder([], 0)
      paymentRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAll({ invoiceId: 'inv-uuid-001' })

      expect(qb.innerJoin).toHaveBeenCalled()
      expect(qb.andWhere).toHaveBeenCalledWith(
        'alloc.invoiceId = :invoiceId',
        { invoiceId: 'inv-uuid-001' },
      )
    })

    it('should apply date range filters', async () => {
      const qb = createMockQueryBuilder([], 0)
      paymentRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAll({
        paymentDateFrom: '2026-01-01',
        paymentDateTo: '2026-12-31',
      })

      expect(qb.andWhere).toHaveBeenCalledWith(
        'p.paymentDate >= :paymentDateFrom',
        { paymentDateFrom: '2026-01-01' },
      )
      expect(qb.andWhere).toHaveBeenCalledWith(
        'p.paymentDate <= :paymentDateTo',
        { paymentDateTo: '2026-12-31' },
      )
    })
  })

  describe('findOne', () => {
    it('should return payment with relations', async () => {
      paymentRepo.findOne.mockResolvedValue(mockPayment as Payment)

      const result = await service.findOne('pay-uuid-001')
      expect(result.paymentNo).toBe('PAY-20260320-00001')
    })

    it('should throw NotFoundException if not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null)

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('reverse', () => {
    it('should reverse a registered payment and recalculate invoice status', async () => {
      const paymentWithAllocs = {
        ...mockPayment,
        status: PaymentStatus.REGISTERED,
        allocations: [
          {
            id: 'alloc-001',
            paymentId: 'pay-uuid-001',
            invoiceId: 'inv-uuid-001',
            allocatedAmount: 10000,
          },
        ],
      }

      mockManager.findOne
        .mockResolvedValueOnce(paymentWithAllocs)
        .mockResolvedValueOnce({
          ...mockInvoice,
          status: InvoiceStatus.PAID,
          paymentAllocations: [],
        })

      paymentRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REVERSED,
        allocations: [],
      } as any)

      const result = await service.reverse(
        'pay-uuid-001',
        { reversalReason: '誤入金' },
        mockUserId,
      )

      expect(mockManager.remove).toHaveBeenCalled()
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled()
      expect(result.status).toBe(PaymentStatus.REVERSED)
    })

    it('should reject reversing an already reversed payment', async () => {
      mockManager.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.REVERSED,
        allocations: [],
      })

      await expect(
        service.reverse(
          'pay-uuid-001',
          { reversalReason: '再取消' },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should throw NotFoundException for non-existent payment', async () => {
      mockManager.findOne.mockResolvedValue(null)

      await expect(
        service.reverse(
          'nonexistent',
          { reversalReason: 'テスト' },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('findByInvoice', () => {
    it('should return allocations for a given invoice', async () => {
      allocationRepo.find.mockResolvedValue([
        {
          id: 'alloc-001',
          paymentId: 'pay-uuid-001',
          invoiceId: 'inv-uuid-001',
          allocatedAmount: 10000,
          createdAt: new Date(),
          createdBy: mockUserId,
          payment: mockPayment as Payment,
          invoice: mockInvoice as Invoice,
        },
      ])

      const result = await service.findByInvoice('inv-uuid-001')

      expect(result).toHaveLength(1)
      expect(result[0].paymentNo).toBe('PAY-20260320-00001')
      expect(result[0].allocatedAmount).toBe(10000)
    })

    it('should return empty array when no allocations exist', async () => {
      allocationRepo.find.mockResolvedValue([])

      const result = await service.findByInvoice('inv-uuid-999')
      expect(result).toHaveLength(0)
    })
  })

  describe('getSummary', () => {
    it('should return summary grouped by status', async () => {
      const qb = createMockQueryBuilder()
      ;(qb as any).getRawMany.mockResolvedValue([
        { status: PaymentStatus.REGISTERED, count: '5', totalAmount: '50000' },
        { status: PaymentStatus.REVERSED, count: '1', totalAmount: '10000' },
      ])
      paymentRepo.createQueryBuilder.mockReturnValue(qb as any)

      const result = await service.getSummary()

      expect(result).toHaveLength(2)
    })

    it('should filter summary by customerId', async () => {
      const qb = createMockQueryBuilder()
      ;(qb as any).getRawMany.mockResolvedValue([])
      paymentRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.getSummary('cust-uuid-001')

      expect(qb.where).toHaveBeenCalledWith(
        'p.customerId = :customerId',
        { customerId: 'cust-uuid-001' },
      )
    })
  })
})
