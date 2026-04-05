import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  CustomerStatus,
  CustomerType,
  ServiceType,
  VisaDataScope,
  VisaReminderType,
} from '../../common/constants/enums';
import { FileEntity } from '../file/entities/file.entity';
import { VisaCase } from '../visa-case/entities/visa-case.entity';
import { VisaCaseDataScopeService } from '../visa-case/visa-case-data-scope.service';
import { VisaCaseReminderService } from '../visa-case/visa-case-reminder.service';
import { CustomerService } from './customer.service';
import { registerCreateTests } from './customer.service.spec.create';
import { registerFindAllPrimaryFallbackTests } from './customer.service.spec.findall-primary-fallback';
import { registerFindOneTests } from './customer.service.spec.findone';
import {
  createFindAllQueryBuilder,
  createMockCustomer,
  createMockPersonalCustomer,
  type CustomerServiceTestContext,
} from './customer.service.spec.mocks';
import { CustomerCodeService } from './customer-code.service';
import { CustomerListPrimaryVisaCaseService } from './customer-list-primary-visa-case.service';
import { CustomerProfileService } from './customer-profile.service';
import { CustomerVisaDerivedRiskService } from './customer-visa-derived-risk.service';
import { CompanyInfo } from './entities/company-info.entity';
import { Customer } from './entities/customer.entity';
import { PersonInfo } from './entities/person-info.entity';

function registerFindAllTests(context: CustomerServiceTestContext): void {
  describe('findAll', () => {
    it('should return paginated results', async () => {
      const mockCustomers = [createMockCustomer()];
      const qb = createFindAllQueryBuilder([mockCustomers, 1]);
      context.getCustomerRepo().createQueryBuilder.mockReturnValue(qb);

      const result = await context
        .getService()
        .findAll({ page: 1, pageSize: 20 }, 'user-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].visaDerivedRisk).toBeNull();
      expect(result.items[0].listPrimaryVisaCase).toBeNull();
      expect(result.items[0].listPrimaryVisaCaseSource).toBeNull();
      expect(result.items[0].primaryCustomerIdForListFallback).toBeNull();
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should apply keyword filter', async () => {
      const qb = createFindAllQueryBuilder([[], 0]);
      context.getCustomerRepo().createQueryBuilder.mockReturnValue(qb);

      await context.getService().findAll(
        {
          keyword: 'テスト',
          page: 1,
          pageSize: 20,
        },
        'user-1',
      );

      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should apply type/service/status filters', async () => {
      const qb = createFindAllQueryBuilder([[], 0]);
      context.getCustomerRepo().createQueryBuilder.mockReturnValue(qb);

      await context.getService().findAll(
        {
          customerType: CustomerType.COMPANY,
          serviceType: ServiceType.TAX,
          status: CustomerStatus.ACTIVE,
          page: 1,
          pageSize: 10,
        },
        'user-1',
      );

      expect(qb.andWhere).toHaveBeenCalledTimes(3);
    });

    it('should apply visaReminderBucket filter via EXISTS and merge derived risk', async () => {
      const mockCustomers = [createMockCustomer()];
      const qb = createFindAllQueryBuilder([mockCustomers, 1]);
      context.getCustomerRepo().createQueryBuilder.mockReturnValue(qb);

      const visaQb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ customerId: 'cust-1', minRank: '2' }]),
      };
      context.getVisaCaseRepo().createQueryBuilder.mockReturnValue(visaQb);

      const result = await context.getService().findAll(
        {
          page: 1,
          pageSize: 20,
          visaReminderBucket: VisaReminderType.EXPIRING_7_DAYS,
        },
        'user-1',
      );

      expect(qb.andWhere).toHaveBeenCalled();
      expect(result.items[0].visaDerivedRisk).toBe(
        VisaReminderType.EXPIRING_7_DAYS,
      );
    });
  });
}

function registerUpdateTests(context: CustomerServiceTestContext): void {
  describe('update', () => {
    it('should update basic customer fields', async () => {
      const mockCustomer = createMockCustomer();
      context.getCustomerRepo().findOne.mockResolvedValue(mockCustomer);

      await context
        .getService()
        .update('cust-1', { customerName: '更新テスト' }, 'user-2');

      expect(context.getCustomerRepo().save).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: '更新テスト',
          updatedBy: 'user-2',
        }),
      );
    });

    it('should update companyInfo for company type', async () => {
      const mockCustomer = createMockCustomer();
      context.getCustomerRepo().findOne.mockResolvedValue(mockCustomer);

      await context
        .getService()
        .update('cust-1', { companyInfo: { fiscalMonth: 12 } }, 'user-2');

      expect(context.getCompanyInfoRepo().save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when updating non-existent customer', async () => {
      context.getCustomerRepo().findOne.mockResolvedValue(null);

      await expect(
        context
          .getService()
          .update('nonexistent', { customerName: 'テスト' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle type change from company to personal', async () => {
      const mockCustomer = createMockCustomer();
      context.getCustomerRepo().findOne.mockResolvedValue(mockCustomer);

      await context.getService().update(
        'cust-1',
        {
          customerType: CustomerType.PERSONAL,
          personInfo: { nationality: '日本' },
        },
        'user-1',
      );

      expect(context.getCompanyInfoRepo().remove).toHaveBeenCalledWith(
        mockCustomer.companyInfo,
      );
      expect(context.getPersonInfoRepo().create).toHaveBeenCalledWith(
        expect.objectContaining({ nationality: '日本' }),
      );
    });

    it('should reject update when primaryCustomerId equals current customer id', async () => {
      const mockCustomer = createMockPersonalCustomer();
      context.getCustomerRepo().findOne.mockResolvedValue(mockCustomer);

      await expect(
        context
          .getService()
          .update(
            'cust-2',
            { personInfo: { primaryCustomerId: 'cust-2' } },
            'user-1',
          ),
      ).rejects.toThrow(BadRequestException);
    });
  });
}

function registerRemoveTests(context: CustomerServiceTestContext): void {
  describe('remove', () => {
    it('should soft-delete a customer', async () => {
      const mockCustomer = createMockCustomer();
      context.getCustomerRepo().findOne.mockResolvedValue(mockCustomer);

      await context.getService().remove('cust-1');

      expect(context.getCustomerRepo().softRemove).toHaveBeenCalledWith(
        mockCustomer,
      );
    });

    it('should throw NotFoundException for non-existent customer', async () => {
      context.getCustomerRepo().findOne.mockResolvedValue(null);

      await expect(context.getService().remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
}

function registerRestoreTests(context: CustomerServiceTestContext): void {
  describe('restore', () => {
    it('should recover a soft-deleted customer', async () => {
      const deletedCustomer = createMockCustomer({
        deletedAt: new Date('2026-01-01'),
      });
      const restoredCustomer = createMockCustomer({ deletedAt: null });
      context
        .getCustomerRepo()
        .findOne.mockResolvedValueOnce(deletedCustomer)
        .mockResolvedValueOnce(restoredCustomer);

      const result = await context.getService().restore('cust-1');

      expect(context.getCustomerRepo().recover).toHaveBeenCalledWith(
        deletedCustomer,
      );
      expect(result).toEqual(restoredCustomer);
    });

    it('should throw NotFoundException when restoring a non-existent customer', async () => {
      context.getCustomerRepo().findOne.mockResolvedValue(null);

      await expect(context.getService().restore('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when the customer is not deleted', async () => {
      context
        .getCustomerRepo()
        .findOne.mockResolvedValue(createMockCustomer({ deletedAt: null }));

      await expect(context.getService().restore('cust-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(context.getCustomerRepo().recover).not.toHaveBeenCalled();
    });
  });
}

function createCustomerServiceCustomerRepoMock(): Record<string, jest.Mock> {
  return {
    create: jest
      .fn()
      .mockImplementation((data: Partial<Customer>): Customer => {
        return { ...data, id: 'cust-new' } as Customer;
      }),
    save: jest
      .fn()
      .mockImplementation(
        (customer: Customer): Promise<Customer> => Promise.resolve(customer),
      ),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    softRemove: jest.fn().mockResolvedValue(undefined),
    recover: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };
}

function createCustomerServiceCompanyInfoRepoMock(): Record<string, jest.Mock> {
  return {
    create: jest
      .fn()
      .mockImplementation(
        (data: Partial<CompanyInfo>): Partial<CompanyInfo> => data,
      ),
    save: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

function createCustomerServicePersonInfoRepoMock(): Record<string, jest.Mock> {
  return {
    create: jest
      .fn()
      .mockImplementation(
        (data: Partial<PersonInfo>): Partial<PersonInfo> => data,
      ),
    save: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };
}

function createCustomerServiceFileRepoMock(): Record<string, jest.Mock> {
  return {
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

function createCustomerServiceVisaCaseRepoMock(): Record<string, jest.Mock> {
  return {
    query: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    }),
  };
}

type CustomerServiceF1bCohesionDeps = {
  service: CustomerService;
  customerRepo: Record<string, jest.Mock>;
  visaCaseDataScopeService: { resolve: jest.Mock };
};

/**
 * 断言 `findAll` 在 TEAM+补件桶下仅解析一次 scope 且派生风险拉取收到同一 `resolved`。
 *
 * @param deps - 当前用例中的服务与 mock
 * @returns 异步断言完成的 Promise
 */
async function runFindAllF1bVisaDataScopeCohesionCase(
  deps: CustomerServiceF1bCohesionDeps,
): Promise<void> {
  const { service, customerRepo, visaCaseDataScopeService } = deps;
  const resolvedTeam = {
    mode: 'team' as const,
    currentUserId: 'user-1',
    teamAssigneeIds: ['user-1', 'peer-2'],
  };
  visaCaseDataScopeService.resolve.mockReset();
  visaCaseDataScopeService.resolve.mockResolvedValue(resolvedTeam);

  const mockCustomers = [createMockCustomer()];
  const qb = createFindAllQueryBuilder([mockCustomers, 1]);
  customerRepo.createQueryBuilder.mockReturnValue(qb);

  const fetchSpy = jest
    .spyOn(
      CustomerVisaDerivedRiskService.prototype,
      'fetchCustomerVisaDerivedRiskMap',
    )
    .mockResolvedValue(new Map());

  const primarySpy = jest
    .spyOn(
      CustomerListPrimaryVisaCaseService.prototype,
      'fetchCustomerListPrimaryVisaCaseMap',
    )
    .mockResolvedValue(new Map());

  await service.findAll(
    {
      page: 1,
      pageSize: 20,
      dataScope: VisaDataScope.TEAM,
      visaReminderBucket: VisaReminderType.SUPPLEMENT,
    },
    'user-1',
  );

  expect(visaCaseDataScopeService.resolve).toHaveBeenCalledTimes(1);
  expect(visaCaseDataScopeService.resolve).toHaveBeenCalledWith(
    'user-1',
    VisaDataScope.TEAM,
  );
  expect(fetchSpy).toHaveBeenCalledWith(
    ['cust-1'],
    expect.any(String),
    [],
    resolvedTeam,
  );
  expect(primarySpy).toHaveBeenCalledWith(['cust-1'], resolvedTeam);
  expect(qb.setParameter).toHaveBeenCalledWith('clexVdsUid', 'user-1');
  expect(qb.setParameter).toHaveBeenCalledWith('clexVdsTeam', [
    'user-1',
    'peer-2',
  ]);

  fetchSpy.mockRestore();
  primarySpy.mockRestore();
}

type CustomerServiceTestBed = {
  service: CustomerService;
  customerRepo: Record<string, jest.Mock>;
  companyInfoRepo: Record<string, jest.Mock>;
  personInfoRepo: Record<string, jest.Mock>;
  visaCaseRepo: Record<string, jest.Mock>;
  fileRepo: Record<string, jest.Mock>;
  visaCaseReminderService: { getSupplementLogCaseIds: jest.Mock };
  visaCaseDataScopeService: { resolve: jest.Mock };
};

/**
 * 组装 CustomerService 单测用 Nest TestingModule 与仓储 mock。
 *
 * @returns 可解构的 service 与各 repo mock
 */
async function setupCustomerServiceTestBed(): Promise<CustomerServiceTestBed> {
  const customerRepo = createCustomerServiceCustomerRepoMock();
  const companyInfoRepo = createCustomerServiceCompanyInfoRepoMock();
  const personInfoRepo = createCustomerServicePersonInfoRepoMock();
  const visaCaseRepo = createCustomerServiceVisaCaseRepoMock();
  const fileRepo = createCustomerServiceFileRepoMock();
  const visaCaseReminderService = {
    getSupplementLogCaseIds: jest.fn().mockResolvedValue([]),
  };
  const visaCaseDataScopeService = {
    resolve: jest.fn().mockResolvedValue({ mode: 'all' }),
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CustomerCodeService,
      CustomerProfileService,
      CustomerVisaDerivedRiskService,
      CustomerListPrimaryVisaCaseService,
      CustomerService,
      { provide: getRepositoryToken(Customer), useValue: customerRepo },
      { provide: getRepositoryToken(CompanyInfo), useValue: companyInfoRepo },
      { provide: getRepositoryToken(PersonInfo), useValue: personInfoRepo },
      { provide: getRepositoryToken(FileEntity), useValue: fileRepo },
      { provide: getRepositoryToken(VisaCase), useValue: visaCaseRepo },
      { provide: VisaCaseReminderService, useValue: visaCaseReminderService },
      { provide: VisaCaseDataScopeService, useValue: visaCaseDataScopeService },
    ],
  }).compile();

  return {
    service: module.get<CustomerService>(CustomerService),
    customerRepo,
    companyInfoRepo,
    personInfoRepo,
    visaCaseRepo,
    fileRepo,
    visaCaseReminderService,
    visaCaseDataScopeService,
  };
}

describe('CustomerService', () => {
  let service: CustomerService;
  let customerRepo: Record<string, jest.Mock>;
  let companyInfoRepo: Record<string, jest.Mock>;
  let personInfoRepo: Record<string, jest.Mock>;
  let visaCaseRepo: Record<string, jest.Mock>;
  let fileRepo: Record<string, jest.Mock>;
  let _visaCaseReminderService: { getSupplementLogCaseIds: jest.Mock };
  let visaCaseDataScopeService: { resolve: jest.Mock };

  beforeEach(async () => {
    const bed = await setupCustomerServiceTestBed();
    service = bed.service;
    customerRepo = bed.customerRepo;
    companyInfoRepo = bed.companyInfoRepo;
    personInfoRepo = bed.personInfoRepo;
    visaCaseRepo = bed.visaCaseRepo;
    fileRepo = bed.fileRepo;
    _visaCaseReminderService = bed.visaCaseReminderService;
    visaCaseDataScopeService = bed.visaCaseDataScopeService;
  });

  function setupCodeGenQueryBuilder(lastCustomer: Customer | null) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(lastCustomer),
    };
    customerRepo.createQueryBuilder.mockReturnValue(qb);
    return qb;
  }

  function setupFindOneAfterCreate(customer: Customer) {
    customerRepo.findOne.mockResolvedValue(customer);
  }

  const context: CustomerServiceTestContext = {
    getService: () => service,
    getCustomerRepo: () => customerRepo,
    getCompanyInfoRepo: () => companyInfoRepo,
    getPersonInfoRepo: () => personInfoRepo,
    getFileRepo: () => fileRepo,
    getVisaCaseRepo: () => visaCaseRepo,
    setupCodeGenQueryBuilder,
    setupFindOneAfterCreate,
  };

  registerCreateTests(context);
  registerFindOneTests(context, () => visaCaseDataScopeService);
  registerFindAllTests(context);
  registerFindAllPrimaryFallbackTests(context);

  describe('findAll F1b visa dataScope cohesion', () => {
    /**
     * 单次 `resolve` 结果同时驱动 `visaReminderBucket` EXISTS 与页内派生风险聚合，与登记册/提醒同源 scope。
     */
    it('calls resolve once and passes identical resolved scope to fetchCustomerVisaDerivedRiskMap', () =>
      runFindAllF1bVisaDataScopeCohesionCase({
        service,
        customerRepo,
        visaCaseDataScopeService,
      }));
  });

  registerUpdateTests(context);
  registerRemoveTests(context);
  registerRestoreTests(context);
});
