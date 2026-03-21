import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository, DataSource, SelectQueryBuilder } from 'typeorm'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { DepositService } from './deposit.service'
import { DepositAccount } from './entities/deposit-account.entity'
import { DepositTransaction } from './entities/deposit-transaction.entity'
import { Invoice } from './entities/invoice.entity'
import { PaymentAllocation } from './entities/payment-allocation.entity'
import {
  DepositTransactionType,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
} from '../../common/constants/enums'

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
    getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    getRawMany: jest.fn().mockResolvedValue([]),
  }
  return qb
}

describe('DepositService', () => {
  let service: DepositService
  let accountRepo: jest.Mocked<Repository<DepositAccount>>
  let txnRepo: jest.Mocked<Repository<DepositTransaction>>

  const mockUserId = 'user-uuid-001'
  const mockCustomerId = 'cust-uuid-001'

  const mockAccount: Partial<DepositAccount> = {
    id: 'da-uuid-001',
    customerId: mockCustomerId,
    balance: 50000,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      id: mockCustomerId,
      customerName: 'テスト顧客',
      customerCode: 'C-001',
    } as any,
    transactions: [],
  }

  const mockInvoice: Partial<Invoice> = {
    id: 'inv-uuid-001',
    customerId: mockCustomerId,
    invoiceNo: 'INV-20260320-00001',
    invoiceType: InvoiceType.ADMIN,
    totalAmount: 30000,
    status: InvoiceStatus.SENT,
    paymentAllocations: [],
  }

  const mockTransaction: Partial<DepositTransaction> = {
    id: 'dt-uuid-001',
    depositAccountId: 'da-uuid-001',
    transactionType: DepositTransactionType.RECHARGE,
    amount: 10000,
    balanceAfter: 60000,
    relatedInvoiceId: null,
    remark: null,
    createdBy: mockUserId,
    createdAt: new Date(),
    depositAccount: mockAccount as DepositAccount,
    relatedInvoice: null,
  }

  let mockQueryRunner: any
  let mockManager: any

  beforeEach(async () => {
    const offsetQb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    }

    mockManager = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((_Entity: any, data: any) => data),
      save: jest.fn().mockImplementation((_Entity: any, data: any) => ({
        ...data,
        id: data.id ?? 'generated-uuid',
      })),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(offsetQb),
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
        DepositService,
        {
          provide: getRepositoryToken(DepositAccount),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DepositTransaction),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Invoice),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PaymentAllocation),
          useValue: {},
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile()

    service = module.get<DepositService>(DepositService)
    accountRepo = module.get(getRepositoryToken(DepositAccount))
    txnRepo = module.get(getRepositoryToken(DepositTransaction))
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  /* ──── recharge ──── */

  describe('recharge', () => {
    it('should create account if not exists and add recharge transaction', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(null) // getOrCreateAccount: account not found
      mockManager.save
        .mockResolvedValueOnce({ ...mockAccount, balance: 0, id: 'da-new' }) // save new account
        .mockResolvedValueOnce({ ...mockAccount, id: 'da-new', balance: 10000 }) // save updated account
        .mockResolvedValueOnce({ ...mockTransaction, id: 'dt-new' }) // save transaction

      txnRepo.findOne.mockResolvedValue({
        ...mockTransaction,
        id: 'dt-new',
      } as DepositTransaction)

      const result = await service.recharge(
        { customerId: mockCustomerId, amount: 10000, paymentMethod: PaymentMethod.BANK },
        mockUserId,
      )

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled()
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should recharge existing account and increase balance', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...mockAccount,
        balance: 50000,
      })

      txnRepo.findOne.mockResolvedValue({
        ...mockTransaction,
        amount: 20000,
        balanceAfter: 70000,
      } as DepositTransaction)

      await service.recharge(
        { customerId: mockCustomerId, amount: 20000 },
        mockUserId,
      )

      expect(mockManager.save).toHaveBeenCalledWith(
        DepositAccount,
        expect.objectContaining({ balance: 70000 }),
      )
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled()
    })

    it('should include payment method in remark', async () => {
      mockManager.findOne.mockResolvedValueOnce({ ...mockAccount })

      txnRepo.findOne.mockResolvedValue(mockTransaction as DepositTransaction)

      await service.recharge(
        {
          customerId: mockCustomerId,
          amount: 5000,
          paymentMethod: PaymentMethod.CASH,
          remark: 'テスト入金',
        },
        mockUserId,
      )

      expect(mockManager.create).toHaveBeenCalledWith(
        DepositTransaction,
        expect.objectContaining({
          remark: 'CASH | テスト入金',
          transactionType: DepositTransactionType.RECHARGE,
        }),
      )
    })

    it('should handle decimal precision correctly', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...mockAccount,
        balance: 100.33,
      })

      txnRepo.findOne.mockResolvedValue(mockTransaction as DepositTransaction)

      await service.recharge(
        { customerId: mockCustomerId, amount: 99.67 },
        mockUserId,
      )

      expect(mockManager.save).toHaveBeenCalledWith(
        DepositAccount,
        expect.objectContaining({ balance: 200 }),
      )
    })
  })

  /* ──── offset ──── */

  describe('offset', () => {
    it('should offset against an invoice and update invoice status', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...mockAccount, balance: 50000 }) // lock account
        .mockResolvedValueOnce({
          ...mockInvoice,
          paymentAllocations: [],
        }) // lock invoice
        .mockResolvedValueOnce({
          ...mockInvoice,
          paymentAllocations: [],
        }) // recalc invoice

      txnRepo.findOne.mockResolvedValue({
        ...mockTransaction,
        transactionType: DepositTransactionType.OFFSET,
        amount: 30000,
        balanceAfter: 20000,
        relatedInvoiceId: 'inv-uuid-001',
      } as DepositTransaction)

      const result = await service.offset(
        {
          customerId: mockCustomerId,
          invoiceId: 'inv-uuid-001',
          amount: 30000,
        },
        mockUserId,
      )

      expect(mockManager.save).toHaveBeenCalledWith(
        DepositAccount,
        expect.objectContaining({ balance: 20000 }),
      )
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should reject when balance is insufficient', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...mockAccount,
        balance: 5000,
      })

      await expect(
        service.offset(
          {
            customerId: mockCustomerId,
            invoiceId: 'inv-uuid-001',
            amount: 10000,
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled()
    })

    it('should reject when deposit account not found', async () => {
      mockManager.findOne.mockResolvedValueOnce(null)

      await expect(
        service.offset(
          {
            customerId: mockCustomerId,
            invoiceId: 'inv-uuid-001',
            amount: 1000,
          },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException)
    })

    it('should reject when invoice not found', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...mockAccount, balance: 50000 })
        .mockResolvedValueOnce(null)

      await expect(
        service.offset(
          {
            customerId: mockCustomerId,
            invoiceId: 'nonexistent',
            amount: 1000,
          },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException)
    })

    it('should reject when invoice belongs to different customer', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...mockAccount, balance: 50000 })
        .mockResolvedValueOnce({
          ...mockInvoice,
          customerId: 'other-customer',
        })

      await expect(
        service.offset(
          {
            customerId: mockCustomerId,
            invoiceId: 'inv-uuid-001',
            amount: 1000,
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject when invoice status is DRAFT', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...mockAccount, balance: 50000 })
        .mockResolvedValueOnce({
          ...mockInvoice,
          status: InvoiceStatus.DRAFT,
          paymentAllocations: [],
        })

      await expect(
        service.offset(
          {
            customerId: mockCustomerId,
            invoiceId: 'inv-uuid-001',
            amount: 1000,
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject when invoice status is PAID', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...mockAccount, balance: 50000 })
        .mockResolvedValueOnce({
          ...mockInvoice,
          status: InvoiceStatus.PAID,
          paymentAllocations: [],
        })

      await expect(
        service.offset(
          {
            customerId: mockCustomerId,
            invoiceId: 'inv-uuid-001',
            amount: 1000,
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject when invoice status is VOID', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...mockAccount, balance: 50000 })
        .mockResolvedValueOnce({
          ...mockInvoice,
          status: InvoiceStatus.VOID,
          paymentAllocations: [],
        })

      await expect(
        service.offset(
          {
            customerId: mockCustomerId,
            invoiceId: 'inv-uuid-001',
            amount: 1000,
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject when offset exceeds invoice remaining', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...mockAccount, balance: 50000 })
        .mockResolvedValueOnce({
          ...mockInvoice,
          totalAmount: 10000,
          paymentAllocations: [{ allocatedAmount: 8000 }],
        })

      await expect(
        service.offset(
          {
            customerId: mockCustomerId,
            invoiceId: 'inv-uuid-001',
            amount: 5000,
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })

  /* ──── refund ──── */

  describe('refund', () => {
    it('should refund and decrease balance', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...mockAccount,
        balance: 30000,
      })

      txnRepo.findOne.mockResolvedValue({
        ...mockTransaction,
        transactionType: DepositTransactionType.REFUND,
        amount: 10000,
        balanceAfter: 20000,
      } as DepositTransaction)

      await service.refund(
        {
          customerId: mockCustomerId,
          amount: 10000,
          reason: '顧客都合による返金',
        },
        mockUserId,
      )

      expect(mockManager.save).toHaveBeenCalledWith(
        DepositAccount,
        expect.objectContaining({ balance: 20000 }),
      )
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled()
    })

    it('should combine reason and remark', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...mockAccount,
        balance: 30000,
      })

      txnRepo.findOne.mockResolvedValue(mockTransaction as DepositTransaction)

      await service.refund(
        {
          customerId: mockCustomerId,
          amount: 5000,
          reason: '契約解除',
          remark: '追加メモ',
        },
        mockUserId,
      )

      expect(mockManager.create).toHaveBeenCalledWith(
        DepositTransaction,
        expect.objectContaining({ remark: '契約解除 | 追加メモ' }),
      )
    })

    it('should reject when balance is insufficient', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...mockAccount,
        balance: 3000,
      })

      await expect(
        service.refund(
          {
            customerId: mockCustomerId,
            amount: 10000,
            reason: 'テスト',
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject when account not found', async () => {
      mockManager.findOne.mockResolvedValueOnce(null)

      await expect(
        service.refund(
          {
            customerId: mockCustomerId,
            amount: 1000,
            reason: 'テスト',
          },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException)
    })
  })

  /* ──── adjustment ──── */

  describe('adjustment', () => {
    it('should increase balance with positive adjustment', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...mockAccount,
        balance: 10000,
      })

      txnRepo.findOne.mockResolvedValue({
        ...mockTransaction,
        transactionType: DepositTransactionType.ADJUSTMENT,
        amount: 5000,
        balanceAfter: 15000,
      } as DepositTransaction)

      await service.adjustment(
        {
          customerId: mockCustomerId,
          amount: 5000,
          reason: 'システム補正',
        },
        mockUserId,
      )

      expect(mockManager.save).toHaveBeenCalledWith(
        DepositAccount,
        expect.objectContaining({ balance: 15000 }),
      )
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled()
    })

    it('should decrease balance with negative adjustment', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...mockAccount,
        balance: 10000,
      })

      txnRepo.findOne.mockResolvedValue(mockTransaction as DepositTransaction)

      await service.adjustment(
        {
          customerId: mockCustomerId,
          amount: -3000,
          reason: '過剰チャージ修正',
        },
        mockUserId,
      )

      expect(mockManager.save).toHaveBeenCalledWith(
        DepositAccount,
        expect.objectContaining({ balance: 7000 }),
      )
    })

    it('should reject zero adjustment', async () => {
      await expect(
        service.adjustment(
          {
            customerId: mockCustomerId,
            amount: 0,
            reason: 'テスト',
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })

    it('should reject adjustment that would make balance negative', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...mockAccount,
        balance: 5000,
      })

      await expect(
        service.adjustment(
          {
            customerId: mockCustomerId,
            amount: -10000,
            reason: 'テスト',
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException)
    })
  })

  /* ──── findAllAccounts ──── */

  describe('findAllAccounts', () => {
    it('should return paginated results', async () => {
      const qb = createMockQueryBuilder([mockAccount as DepositAccount], 1)
      accountRepo.createQueryBuilder.mockReturnValue(qb as any)

      const result = await service.findAllAccounts({ page: 1, pageSize: 20 })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
    })

    it('should apply keyword filter', async () => {
      const qb = createMockQueryBuilder([], 0)
      accountRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAllAccounts({ keyword: 'テスト' })

      expect(qb.andWhere).toHaveBeenCalled()
    })

    it('should apply hasBalance filter', async () => {
      const qb = createMockQueryBuilder([], 0)
      accountRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAllAccounts({ hasBalance: true })

      expect(qb.andWhere).toHaveBeenCalledWith('da.balance > 0')
    })

    it('should apply customerId filter', async () => {
      const qb = createMockQueryBuilder([], 0)
      accountRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAllAccounts({ customerId: mockCustomerId })

      expect(qb.andWhere).toHaveBeenCalledWith(
        'da.customerId = :customerId',
        { customerId: mockCustomerId },
      )
    })
  })

  /* ──── findAllTransactions ──── */

  describe('findAllTransactions', () => {
    it('should return paginated transactions', async () => {
      const qb = createMockQueryBuilder(
        [mockTransaction as DepositTransaction],
        1,
      )
      txnRepo.createQueryBuilder.mockReturnValue(qb as any)

      const result = await service.findAllTransactions({
        page: 1,
        pageSize: 20,
      })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('should filter by transactionType', async () => {
      const qb = createMockQueryBuilder([], 0)
      txnRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAllTransactions({
        transactionType: DepositTransactionType.RECHARGE,
      })

      expect(qb.andWhere).toHaveBeenCalledWith(
        'dt.transactionType = :transactionType',
        { transactionType: DepositTransactionType.RECHARGE },
      )
    })

    it('should filter by date range', async () => {
      const qb = createMockQueryBuilder([], 0)
      txnRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAllTransactions({
        createdFrom: '2026-01-01',
        createdTo: '2026-12-31',
      })

      expect(qb.andWhere).toHaveBeenCalledWith(
        'dt.createdAt >= :createdFrom',
        { createdFrom: '2026-01-01' },
      )
      expect(qb.andWhere).toHaveBeenCalledWith(
        'dt.createdAt <= :createdTo',
        { createdTo: '2026-12-31' },
      )
    })

    it('should filter by keyword', async () => {
      const qb = createMockQueryBuilder([], 0)
      txnRepo.createQueryBuilder.mockReturnValue(qb as any)

      await service.findAllTransactions({ keyword: 'INV' })

      expect(qb.andWhere).toHaveBeenCalled()
    })
  })

  /* ──── findAccountById ──── */

  describe('findAccountById', () => {
    it('should return account with customer relation', async () => {
      accountRepo.findOne.mockResolvedValue(mockAccount as DepositAccount)

      const result = await service.findAccountById('da-uuid-001')
      expect(result.customerId).toBe(mockCustomerId)
    })

    it('should throw NotFoundException if not found', async () => {
      accountRepo.findOne.mockResolvedValue(null)

      await expect(service.findAccountById('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  /* ──── findAccountByCustomer ──── */

  describe('findAccountByCustomer', () => {
    it('should return account for customer', async () => {
      accountRepo.findOne.mockResolvedValue(mockAccount as DepositAccount)

      const result = await service.findAccountByCustomer(mockCustomerId)
      expect(result).toBeDefined()
      expect(result!.customerId).toBe(mockCustomerId)
    })

    it('should return null if no account exists', async () => {
      accountRepo.findOne.mockResolvedValue(null)

      const result = await service.findAccountByCustomer('nonexistent')
      expect(result).toBeNull()
    })
  })

  /* ──── getAccountSummary ──── */

  describe('getAccountSummary', () => {
    it('should return aggregated summary', async () => {
      const qb = createMockQueryBuilder()
      ;(qb as any).getRawOne = jest.fn().mockResolvedValue({
        totalAccounts: '10',
        totalBalance: '500000',
        activeAccounts: '7',
      })
      accountRepo.createQueryBuilder.mockReturnValue(qb as any)

      const result = await service.getAccountSummary()

      expect(result.totalAccounts).toBe('10')
      expect(result.totalBalance).toBe('500000')
      expect(result.activeAccounts).toBe('7')
    })
  })

  /* ──── Amount precision edge cases ──── */

  describe('amount precision', () => {
    it('should handle floating point rounding in recharge (0.1 + 0.2)', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...mockAccount,
        balance: 0.1,
      })

      txnRepo.findOne.mockResolvedValue(mockTransaction as DepositTransaction)

      await service.recharge(
        { customerId: mockCustomerId, amount: 0.2 },
        mockUserId,
      )

      expect(mockManager.save).toHaveBeenCalledWith(
        DepositAccount,
        expect.objectContaining({ balance: 0.3 }),
      )
    })

    it('should handle large amounts correctly', async () => {
      mockManager.findOne.mockResolvedValueOnce({
        ...mockAccount,
        balance: 999999999.99,
      })

      txnRepo.findOne.mockResolvedValue(mockTransaction as DepositTransaction)

      await service.recharge(
        { customerId: mockCustomerId, amount: 0.01 },
        mockUserId,
      )

      expect(mockManager.save).toHaveBeenCalledWith(
        DepositAccount,
        expect.objectContaining({ balance: 1000000000 }),
      )
    })
  })

  /* ──── Transaction rollback ──── */

  describe('transaction safety', () => {
    it('should rollback on recharge error', async () => {
      mockManager.findOne.mockResolvedValueOnce({ ...mockAccount })
      mockManager.save.mockRejectedValueOnce(new Error('DB error'))

      await expect(
        service.recharge(
          { customerId: mockCustomerId, amount: 1000 },
          mockUserId,
        ),
      ).rejects.toThrow('DB error')

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled()
      expect(mockQueryRunner.release).toHaveBeenCalled()
    })

    it('should rollback on offset error', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ ...mockAccount, balance: 50000 })
        .mockResolvedValueOnce({ ...mockInvoice, paymentAllocations: [] })
      mockManager.save
        .mockResolvedValueOnce({ ...mockAccount }) // save account
        .mockRejectedValueOnce(new Error('DB error')) // save transaction fails

      await expect(
        service.offset(
          {
            customerId: mockCustomerId,
            invoiceId: 'inv-uuid-001',
            amount: 1000,
          },
          mockUserId,
        ),
      ).rejects.toThrow('DB error')

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled()
      expect(mockQueryRunner.release).toHaveBeenCalled()
    })

    it('should always release query runner even on error', async () => {
      mockManager.findOne.mockRejectedValueOnce(new Error('Connection lost'))

      await expect(
        service.refund(
          {
            customerId: mockCustomerId,
            amount: 1000,
            reason: 'テスト',
          },
          mockUserId,
        ),
      ).rejects.toThrow()

      expect(mockQueryRunner.release).toHaveBeenCalled()
    })
  })
})
