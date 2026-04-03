import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  BillingCycle,
  MaterialStatus,
  MonthlyStatus,
  TaxContractStatus,
} from '../../common/constants/enums';
import {
  TaxContract,
  TaxMonthlyDocument,
  TaxMonthlyWorkItem,
  TaxPeriod,
} from './entities';
import { TaxService } from './tax.service';

type MockCustomer = TaxContract['customer'];
type MockOwner = NonNullable<TaxContract['owner']>;
type MockCompletedByUser = NonNullable<TaxMonthlyWorkItem['completedByUser']>;
type MockCreateInput = Record<string, unknown>;

function createMockContract(overrides: Partial<TaxContract> = {}): TaxContract {
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

function createMockPeriod(overrides: Partial<TaxPeriod> = {}): TaxPeriod {
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

function createMockDocument(
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

function createMockWorkItem(
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

describe('TaxService', () => {
  let service: TaxService;
  let contractRepo: Record<string, jest.Mock>;
  let periodRepo: Record<string, jest.Mock>;
  let documentRepo: Record<string, jest.Mock>;
  let workItemRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    contractRepo = {
      create: jest.fn().mockImplementation(
        (d: MockCreateInput): MockCreateInput => ({
          ...d,
          id: 'contract-new',
        }),
      ),
      save: jest
        .fn()
        .mockImplementation(
          (c: TaxContract): Promise<TaxContract> => Promise.resolve(c),
        ),
      findOne: jest.fn(),
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };

    periodRepo = {
      create: jest.fn().mockImplementation(
        (d: MockCreateInput): MockCreateInput => ({
          ...d,
          id: 'period-new',
        }),
      ),
      save: jest
        .fn()
        .mockImplementation(
          (
            items: TaxPeriod | TaxPeriod[],
          ): Promise<TaxPeriod | TaxPeriod[]> => {
            if (Array.isArray(items)) {
              return Promise.resolve(items);
            }

            return Promise.resolve(items);
          },
        ),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      softRemove: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };

    documentRepo = {
      create: jest.fn().mockImplementation(
        (d: MockCreateInput): MockCreateInput => ({
          ...d,
          id: 'doc-new',
        }),
      ),
      save: jest
        .fn()
        .mockImplementation(
          (c: TaxMonthlyDocument): Promise<TaxMonthlyDocument> =>
            Promise.resolve(c),
        ),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    workItemRepo = {
      create: jest.fn().mockImplementation(
        (d: MockCreateInput): MockCreateInput => ({
          ...d,
          id: 'item-new',
        }),
      ),
      save: jest
        .fn()
        .mockImplementation(
          (c: TaxMonthlyWorkItem): Promise<TaxMonthlyWorkItem> =>
            Promise.resolve(c),
        ),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxService,
        {
          provide: getRepositoryToken(TaxContract),
          useValue: contractRepo,
        },
        {
          provide: getRepositoryToken(TaxPeriod),
          useValue: periodRepo,
        },
        {
          provide: getRepositoryToken(TaxMonthlyDocument),
          useValue: documentRepo,
        },
        {
          provide: getRepositoryToken(TaxMonthlyWorkItem),
          useValue: workItemRepo,
        },
      ],
    }).compile();

    service = module.get<TaxService>(TaxService);
  });

  // ── Contract CRUD ───────────────────────────────────────

  describe('create', () => {
    it('should create a contract with default ACTIVE status', async () => {
      const mockContract = createMockContract({ id: 'contract-new' });
      contractRepo.save.mockResolvedValue(mockContract);
      contractRepo.findOne.mockResolvedValue(mockContract);

      const result = await service.create(
        {
          customerId: 'customer-1',
          contractName: 'テスト契約',
          startDate: '2026-04-01',
        },
        'user-1',
      );

      expect(contractRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'customer-1',
          contractName: 'テスト契約',
          contractStatus: TaxContractStatus.ACTIVE,
          createdBy: 'user-1',
        }),
      );
      expect(result).toBeDefined();
      expect(result.id).toBe('contract-new');
    });

    it('should create a contract with explicit status', async () => {
      const mockContract = createMockContract({
        id: 'contract-new',
        contractStatus: TaxContractStatus.EXPIRED,
      });
      contractRepo.save.mockResolvedValue(mockContract);
      contractRepo.findOne.mockResolvedValue(mockContract);

      await service.create(
        {
          customerId: 'customer-1',
          contractName: 'テスト契約',
          startDate: '2026-04-01',
          contractStatus: TaxContractStatus.EXPIRED,
        },
        'user-1',
      );

      expect(contractRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contractStatus: TaxContractStatus.EXPIRED,
        }),
      );
    });

    it('should create a contract with monthly fee', async () => {
      const mockContract = createMockContract({
        id: 'contract-new',
        monthlyFee: 80000,
      });
      contractRepo.save.mockResolvedValue(mockContract);
      contractRepo.findOne.mockResolvedValue(mockContract);

      await service.create(
        {
          customerId: 'customer-1',
          contractName: 'テスト契約',
          startDate: '2026-04-01',
          monthlyFee: 80000,
        },
        'user-1',
      );

      expect(contractRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ monthlyFee: 80000 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return contract with relations', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);

      const result = await service.findOne('contract-1');
      expect(result.id).toBe('contract-1');
      expect(contractRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
        relations: ['customer', 'owner', 'periods'],
      });
    });

    it('should throw NotFoundException for non-existent contract', async () => {
      contractRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update contract fields', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);

      const updated = { ...mockContract, contractName: '更新契約' };
      contractRepo.save.mockResolvedValue(updated);
      contractRepo.findOne
        .mockResolvedValueOnce(mockContract)
        .mockResolvedValueOnce(updated);

      const result = await service.update(
        'contract-1',
        { contractName: '更新契約' },
        'user-2',
      );

      expect(result.contractName).toBe('更新契約');
    });

    it('should update monthly fee to zero', async () => {
      const mockContract = createMockContract({ monthlyFee: 50000 });
      contractRepo.findOne.mockResolvedValue(mockContract);

      const updated = { ...mockContract, monthlyFee: 0 };
      contractRepo.save.mockResolvedValue(updated);
      contractRepo.findOne
        .mockResolvedValueOnce(mockContract)
        .mockResolvedValueOnce(updated);

      await service.update('contract-1', { monthlyFee: 0 }, 'user-1');

      expect(contractRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ monthlyFee: 0 }),
      );
    });

    it('should clear end date when set to null', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);

      const updated = { ...mockContract, endDate: null };
      contractRepo.save.mockResolvedValue(updated);
      contractRepo.findOne
        .mockResolvedValueOnce(mockContract)
        .mockResolvedValueOnce(updated);

      await service.update('contract-1', { endDate: undefined }, 'user-1');
    });
  });

  describe('remove', () => {
    it('should soft-delete a contract', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);

      await service.remove('contract-1');
      expect(contractRepo.softRemove).toHaveBeenCalledWith(mockContract);
    });

    it('should throw for non-existent contract', async () => {
      contractRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── Status Transitions ──────────────────────────────────

  describe('updateStatus', () => {
    it('should transition ACTIVE → EXPIRED', async () => {
      const mockContract = createMockContract({
        contractStatus: TaxContractStatus.ACTIVE,
      });
      contractRepo.findOne.mockResolvedValue(mockContract);
      contractRepo.save.mockResolvedValue({
        ...mockContract,
        contractStatus: TaxContractStatus.EXPIRED,
      });

      await service.updateStatus(
        'contract-1',
        TaxContractStatus.EXPIRED,
        'user-1',
      );

      expect(contractRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          contractStatus: TaxContractStatus.EXPIRED,
        }),
      );
    });

    it('should transition ACTIVE → TERMINATED', async () => {
      const mockContract = createMockContract({
        contractStatus: TaxContractStatus.ACTIVE,
      });
      contractRepo.findOne.mockResolvedValue(mockContract);

      await service.updateStatus(
        'contract-1',
        TaxContractStatus.TERMINATED,
        'user-1',
      );

      expect(contractRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          contractStatus: TaxContractStatus.TERMINATED,
        }),
      );
    });

    it('should transition EXPIRED → ACTIVE (renewal)', async () => {
      const mockContract = createMockContract({
        contractStatus: TaxContractStatus.EXPIRED,
      });
      contractRepo.findOne.mockResolvedValue(mockContract);

      await service.updateStatus(
        'contract-1',
        TaxContractStatus.ACTIVE,
        'user-1',
      );

      expect(contractRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          contractStatus: TaxContractStatus.ACTIVE,
        }),
      );
    });

    it('should reject transition from terminal TERMINATED', async () => {
      const mockContract = createMockContract({
        contractStatus: TaxContractStatus.TERMINATED,
      });
      contractRepo.findOne.mockResolvedValue(mockContract);

      await expect(
        service.updateStatus('contract-1', TaxContractStatus.ACTIVE, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid transition ACTIVE → ACTIVE', async () => {
      const mockContract = createMockContract({
        contractStatus: TaxContractStatus.ACTIVE,
      });
      contractRepo.findOne.mockResolvedValue(mockContract);

      await expect(
        service.updateStatus('contract-1', TaxContractStatus.ACTIVE, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return valid transitions for ACTIVE', () => {
      const result = service.getAvailableTransitions(TaxContractStatus.ACTIVE);
      expect(result).toEqual([
        TaxContractStatus.EXPIRED,
        TaxContractStatus.TERMINATED,
      ]);
    });

    it('should return valid transitions for EXPIRED', () => {
      const result = service.getAvailableTransitions(TaxContractStatus.EXPIRED);
      expect(result).toEqual([
        TaxContractStatus.ACTIVE,
        TaxContractStatus.TERMINATED,
      ]);
    });

    it('should return empty for TERMINATED', () => {
      const result = service.getAvailableTransitions(
        TaxContractStatus.TERMINATED,
      );
      expect(result).toEqual([]);
    });
  });

  // ── findAll query builder ──────────────────────────────

  describe('findAll', () => {
    it('should build query with pagination defaults', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      contractRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAll({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });

    it('should apply keyword filter', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      contractRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll({ keyword: 'テスト' });

      expect(mockQb.andWhere).toHaveBeenCalled();
    });

    it('should apply status filter', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      contractRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.findAll({
        contractStatus: TaxContractStatus.ACTIVE,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tc.contractStatus = :contractStatus',
        { contractStatus: TaxContractStatus.ACTIVE },
      );
    });

    it('should map items through toContractListDto', async () => {
      const mockContract = createMockContract();
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockContract], 1]),
      };
      contractRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 'contract-1',
        customerName: 'テスト顧客',
        contractName: 'テスト契約',
        ownerName: '担当者A',
      });
    });
  });

  describe('findByCustomer', () => {
    it('should delegate to findAll with customerId', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      contractRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.findByCustomer('customer-1', { page: 1 });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tc.customerId = :customerId',
        { customerId: 'customer-1' },
      );
    });
  });

  // ── Period CRUD ─────────────────────────────────────────

  describe('createPeriod', () => {
    it('should create a period for a contract', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);
      periodRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createMockPeriod({ id: 'period-new' }));
      periodRepo.save.mockResolvedValue(createMockPeriod({ id: 'period-new' }));

      const result = await service.createPeriod(
        'contract-1',
        { periodYm: '2026-04' },
        'user-1',
      );

      expect(periodRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          taxContractId: 'contract-1',
          customerId: 'customer-1',
          periodYm: '2026-04',
          monthlyStatus: MonthlyStatus.NOT_STARTED,
          materialStatus: MaterialStatus.NOT_RECEIVED,
        }),
      );
      expect(result).toBeDefined();
    });

    it('should throw ConflictException for duplicate period', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);
      periodRepo.findOne.mockResolvedValue(createMockPeriod());

      await expect(
        service.createPeriod('contract-1', { periodYm: '2026-04' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create a period with declaration deadline', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);
      periodRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createMockPeriod({ id: 'period-new' }));
      periodRepo.save.mockResolvedValue(createMockPeriod({ id: 'period-new' }));

      await service.createPeriod(
        'contract-1',
        { periodYm: '2026-04', declarationDeadline: '2026-05-10' },
        'user-1',
      );

      expect(periodRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          declarationDeadline: new Date('2026-05-10'),
        }),
      );
    });
  });

  describe('findPeriods', () => {
    it('should list periods with pagination', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[createMockPeriod()], 1]),
      };
      periodRepo.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findPeriods('contract-1', {
        page: 1,
        pageSize: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockQb.where).toHaveBeenCalledWith(
        'tp.taxContractId = :contractId',
        { contractId: 'contract-1' },
      );
    });

    it('should filter by monthlyStatus', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      periodRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.findPeriods('contract-1', {
        monthlyStatus: MonthlyStatus.IN_PROGRESS,
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tp.monthlyStatus = :monthlyStatus',
        { monthlyStatus: MonthlyStatus.IN_PROGRESS },
      );
    });

    it('should filter by period range', async () => {
      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      periodRepo.createQueryBuilder.mockReturnValue(mockQb);

      await service.findPeriods('contract-1', {
        periodYmFrom: '2026-04',
        periodYmTo: '2026-12',
      });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tp.periodYm >= :periodYmFrom',
        { periodYmFrom: '2026-04' },
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'tp.periodYm <= :periodYmTo',
        { periodYmTo: '2026-12' },
      );
    });
  });

  describe('findOnePeriod', () => {
    it('should return period with documents and work items', async () => {
      const mockPeriod = createMockPeriod({
        documents: [createMockDocument()],
        workItems: [createMockWorkItem()],
      });
      periodRepo.findOne.mockResolvedValue(mockPeriod);

      const result = await service.findOnePeriod('period-1');
      expect(result.id).toBe('period-1');
      expect(result.documents).toHaveLength(1);
      expect(result.workItems).toHaveLength(1);
    });

    it('should throw NotFoundException for non-existent period', async () => {
      periodRepo.findOne.mockResolvedValue(null);

      await expect(service.findOnePeriod('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updatePeriodStatus', () => {
    it('should update monthly status', async () => {
      const mockPeriod = createMockPeriod();
      periodRepo.findOne.mockResolvedValue(mockPeriod);
      periodRepo.save.mockResolvedValue({
        ...mockPeriod,
        monthlyStatus: MonthlyStatus.IN_PROGRESS,
      });

      await service.updatePeriodStatus(
        'period-1',
        MonthlyStatus.IN_PROGRESS,
        'user-1',
      );

      expect(periodRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          monthlyStatus: MonthlyStatus.IN_PROGRESS,
        }),
      );
    });
  });

  describe('removePeriod', () => {
    it('should soft-delete period and remove children', async () => {
      const mockPeriod = createMockPeriod();
      periodRepo.findOne.mockResolvedValue(mockPeriod);

      await service.removePeriod('period-1');

      expect(documentRepo.delete).toHaveBeenCalledWith({
        taxPeriodId: 'period-1',
      });
      expect(workItemRepo.delete).toHaveBeenCalledWith({
        taxPeriodId: 'period-1',
      });
      expect(periodRepo.softRemove).toHaveBeenCalledWith(mockPeriod);
    });
  });

  describe('generatePeriods', () => {
    it('should generate periods for a contract', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);
      periodRepo.find.mockResolvedValue([]);
      periodRepo.save.mockImplementation((items) => Promise.resolve(items));

      const result = await service.generatePeriods(
        'contract-1',
        { startYm: '2026-04', endYm: '2026-06' },
        'user-1',
      );

      expect(result).toHaveLength(3);
      expect(periodRepo.create).toHaveBeenCalledTimes(3);
    });

    it('should skip existing periods', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);
      periodRepo.find.mockResolvedValue([
        { periodYm: '2026-04' },
        { periodYm: '2026-05' },
      ]);
      periodRepo.save.mockImplementation((items) => Promise.resolve(items));

      const result = await service.generatePeriods(
        'contract-1',
        { startYm: '2026-04', endYm: '2026-06' },
        'user-1',
      );

      expect(result).toHaveLength(1);
      expect(periodRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ periodYm: '2026-06' }),
      );
    });

    it('should reject when start > end', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);

      await expect(
        service.generatePeriods(
          'contract-1',
          { startYm: '2027-01', endYm: '2026-01' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when range exceeds 36 months', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);

      await expect(
        service.generatePeriods(
          'contract-1',
          { startYm: '2026-01', endYm: '2029-12' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set deadline when deadlineDay is specified', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);
      periodRepo.find.mockResolvedValue([]);
      periodRepo.save.mockImplementation((items) => Promise.resolve(items));

      await service.generatePeriods(
        'contract-1',
        { startYm: '2026-04', endYm: '2026-04', deadlineDay: 10 },
        'user-1',
      );

      expect(periodRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          declarationDeadline: new Date(2026, 4, 10),
        }),
      );
    });

    it('should return empty array when all periods exist', async () => {
      const mockContract = createMockContract();
      contractRepo.findOne.mockResolvedValue(mockContract);
      periodRepo.find.mockResolvedValue([
        { periodYm: '2026-04' },
        { periodYm: '2026-05' },
      ]);

      const result = await service.generatePeriods(
        'contract-1',
        { startYm: '2026-04', endYm: '2026-05' },
        'user-1',
      );

      expect(result).toEqual([]);
      expect(periodRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── Documents ──────────────────────────────────────────

  describe('createDocument', () => {
    it('should create a document for a period', async () => {
      const mockPeriod = createMockPeriod();
      periodRepo.findOne.mockResolvedValue(mockPeriod);
      documentRepo.save.mockResolvedValue(
        createMockDocument({ id: 'doc-new' }),
      );
      documentRepo.find.mockResolvedValue([
        createMockDocument({ id: 'doc-new' }),
      ]);

      const result = await service.createDocument('period-1', {
        documentName: '元帳',
      });

      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          taxPeriodId: 'period-1',
          documentName: '元帳',
          received: false,
        }),
      );
      expect(result).toBeDefined();
    });

    it('should set receivedAt when received is true', async () => {
      const mockPeriod = createMockPeriod();
      periodRepo.findOne.mockResolvedValue(mockPeriod);
      documentRepo.save.mockResolvedValue(
        createMockDocument({ id: 'doc-new', received: true }),
      );
      documentRepo.find.mockResolvedValue([
        createMockDocument({ received: true }),
      ]);

      await service.createDocument('period-1', {
        documentName: '元帳',
        received: true,
      });

      const createdDocument = (
        documentRepo.create.mock.calls as Array<
          [{ received: boolean; receivedAt: Date | null }]
        >
      )[0][0];

      expect(documentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          received: true,
        }),
      );
      expect(createdDocument.receivedAt).toBeInstanceOf(Date);
    });
  });

  describe('updateDocument', () => {
    it('should update a document', async () => {
      const mockDoc = createMockDocument();
      documentRepo.findOne.mockResolvedValue(mockDoc);
      documentRepo.save.mockResolvedValue({
        ...mockDoc,
        documentName: '更新資料',
      });
      documentRepo.find.mockResolvedValue([mockDoc]);
      periodRepo.findOne.mockResolvedValue(createMockPeriod());
      periodRepo.save.mockResolvedValue(createMockPeriod());

      const result = await service.updateDocument('doc-1', {
        documentName: '更新資料',
      });

      expect(result.documentName).toBe('更新資料');
    });

    it('should toggle received status and set receivedAt', async () => {
      const mockDoc = createMockDocument({ received: false });
      documentRepo.findOne.mockResolvedValue(mockDoc);
      documentRepo.save.mockResolvedValue({
        ...mockDoc,
        received: true,
        receivedAt: new Date(),
      });
      documentRepo.find.mockResolvedValue([{ ...mockDoc, received: true }]);
      periodRepo.findOne.mockResolvedValue(createMockPeriod());
      periodRepo.save.mockResolvedValue(createMockPeriod());

      await service.updateDocument('doc-1', { received: true });

      const savedDocument = (
        documentRepo.save.mock.calls as Array<[TaxMonthlyDocument]>
      )[0][0];

      expect(documentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          received: true,
        }),
      );
      expect(savedDocument.receivedAt).toBeInstanceOf(Date);
    });

    it('should clear receivedAt when unmarking as received', async () => {
      const mockDoc = createMockDocument({
        received: true,
        receivedAt: new Date(),
      });
      documentRepo.findOne.mockResolvedValue(mockDoc);
      documentRepo.save.mockResolvedValue({
        ...mockDoc,
        received: false,
        receivedAt: null,
      });
      documentRepo.find.mockResolvedValue([{ ...mockDoc, received: false }]);
      periodRepo.findOne.mockResolvedValue(createMockPeriod());
      periodRepo.save.mockResolvedValue(createMockPeriod());

      await service.updateDocument('doc-1', { received: false });

      expect(documentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          received: false,
          receivedAt: null,
        }),
      );
    });

    it('should throw for non-existent document', async () => {
      documentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateDocument('nonexistent', { documentName: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeDocument', () => {
    it('should remove a document and recalc material status', async () => {
      const mockDoc = createMockDocument();
      documentRepo.findOne.mockResolvedValue(mockDoc);
      documentRepo.find.mockResolvedValue([]);
      periodRepo.findOne.mockResolvedValue(createMockPeriod());
      periodRepo.save.mockResolvedValue(createMockPeriod());

      await service.removeDocument('doc-1');

      expect(documentRepo.remove).toHaveBeenCalledWith(mockDoc);
    });
  });

  // ── Work Items ─────────────────────────────────────────

  describe('createWorkItem', () => {
    it('should create a work item for a period', async () => {
      const mockPeriod = createMockPeriod();
      periodRepo.findOne.mockResolvedValue(mockPeriod);
      workItemRepo.save.mockResolvedValue(
        createMockWorkItem({ id: 'item-new' }),
      );

      const result = await service.createWorkItem('period-1', {
        itemName: '仕訳入力',
      });

      expect(workItemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          taxPeriodId: 'period-1',
          itemName: '仕訳入力',
          completed: false,
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('updateWorkItem', () => {
    it('should toggle completed and set completedAt/completedBy', async () => {
      const mockItem = createMockWorkItem({ completed: false });
      workItemRepo.findOne.mockResolvedValue(mockItem);
      workItemRepo.save.mockResolvedValue({
        ...mockItem,
        completed: true,
        completedAt: new Date(),
        completedBy: 'user-1',
      });

      await service.updateWorkItem('item-1', { completed: true }, 'user-1');

      const savedWorkItem = (
        workItemRepo.save.mock.calls as Array<[TaxMonthlyWorkItem]>
      )[0][0];

      expect(workItemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          completed: true,
          completedBy: 'user-1',
        }),
      );
      expect(savedWorkItem.completedAt).toBeInstanceOf(Date);
    });

    it('should clear completedAt/completedBy when unmarking', async () => {
      const mockItem = createMockWorkItem({
        completed: true,
        completedAt: new Date(),
        completedBy: 'user-1',
      });
      workItemRepo.findOne.mockResolvedValue(mockItem);
      workItemRepo.save.mockResolvedValue({
        ...mockItem,
        completed: false,
        completedAt: null,
        completedBy: null,
      });

      await service.updateWorkItem('item-1', { completed: false }, 'user-1');

      expect(workItemRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          completed: false,
          completedAt: null,
          completedBy: null,
        }),
      );
    });

    it('should throw for non-existent work item', async () => {
      workItemRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateWorkItem('nonexistent', { itemName: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeWorkItem', () => {
    it('should remove a work item', async () => {
      const mockItem = createMockWorkItem();
      workItemRepo.findOne.mockResolvedValue(mockItem);

      await service.removeWorkItem('item-1');

      expect(workItemRepo.remove).toHaveBeenCalledWith(mockItem);
    });

    it('should throw for non-existent work item', async () => {
      workItemRepo.findOne.mockResolvedValue(null);

      await expect(service.removeWorkItem('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── Response Mappers ───────────────────────────────────

  describe('toPeriodListDto', () => {
    it('should include document and work item counts', () => {
      const period = createMockPeriod({
        documents: [
          createMockDocument({ received: true }),
          createMockDocument({ id: 'doc-2', received: false }),
          createMockDocument({ id: 'doc-3', received: true }),
        ],
        workItems: [
          createMockWorkItem({ completed: true }),
          createMockWorkItem({ id: 'item-2', completed: false }),
        ],
      });

      const dto = service.toPeriodListDto(period);

      expect(dto.documentCount).toBe(3);
      expect(dto.documentReceivedCount).toBe(2);
      expect(dto.workItemCount).toBe(2);
      expect(dto.workItemCompletedCount).toBe(1);
    });

    it('should handle empty documents and work items', () => {
      const period = createMockPeriod({
        documents: [],
        workItems: [],
      });

      const dto = service.toPeriodListDto(period);

      expect(dto.documentCount).toBe(0);
      expect(dto.documentReceivedCount).toBe(0);
      expect(dto.workItemCount).toBe(0);
      expect(dto.workItemCompletedCount).toBe(0);
    });
  });

  describe('toPeriodDetailDto', () => {
    it('should map documents and work items', () => {
      const period = createMockPeriod({
        documents: [createMockDocument({ documentName: '元帳' })],
        workItems: [
          createMockWorkItem({
            itemName: '仕訳入力',
            completedByUser: {
              displayName: '担当者B',
            } as MockCompletedByUser,
          }),
        ],
      });

      const dto = service.toPeriodDetailDto(period);

      expect(dto.documents).toHaveLength(1);
      expect(dto.documents[0].documentName).toBe('元帳');
      expect(dto.workItems).toHaveLength(1);
      expect(dto.workItems[0].itemName).toBe('仕訳入力');
      expect(dto.workItems[0].completedByName).toBe('担当者B');
    });
  });
});
