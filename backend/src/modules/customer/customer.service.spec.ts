import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  CustomerStatus,
  CustomerType,
  ServiceType,
} from '../../common/constants/enums';
import { CustomerService } from './customer.service';
import { registerCreateTests } from './customer.service.spec.create';
import {
  createFindAllQueryBuilder,
  createMockCustomer,
  createMockPersonalCustomer,
  type CustomerServiceTestContext,
} from './customer.service.spec.mocks';
import { CompanyInfo } from './entities/company-info.entity';
import { Customer } from './entities/customer.entity';
import { PersonInfo } from './entities/person-info.entity';

function registerFindOneTests(context: CustomerServiceTestContext): void {
  describe('findOne', () => {
    it('should return customer with relations', async () => {
      const mockCustomer = createMockCustomer();
      context.getCustomerRepo().findOne.mockResolvedValue(mockCustomer);

      const result = await context.getService().findOne('cust-1');

      expect(result.id).toBe('cust-1');
      expect(context.getCustomerRepo().findOne).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        relations: [
          'companyInfo',
          'personInfo',
          'owner',
          'staffRelations',
          'staffRelations.user',
        ],
      });
    });

    it('should throw NotFoundException for non-existent customer', async () => {
      context.getCustomerRepo().findOne.mockResolvedValue(null);

      await expect(context.getService().findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
}

function registerFindAllTests(context: CustomerServiceTestContext): void {
  describe('findAll', () => {
    it('should return paginated results', async () => {
      const mockCustomers = [createMockCustomer()];
      const qb = createFindAllQueryBuilder([mockCustomers, 1]);
      context.getCustomerRepo().createQueryBuilder.mockReturnValue(qb);

      const result = await context
        .getService()
        .findAll({ page: 1, pageSize: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should apply keyword filter', async () => {
      const qb = createFindAllQueryBuilder([[], 0]);
      context.getCustomerRepo().createQueryBuilder.mockReturnValue(qb);

      await context.getService().findAll({
        keyword: 'テスト',
        page: 1,
        pageSize: 20,
      });

      expect(qb.andWhere).toHaveBeenCalled();
    });

    it('should apply type/service/status filters', async () => {
      const qb = createFindAllQueryBuilder([[], 0]);
      context.getCustomerRepo().createQueryBuilder.mockReturnValue(qb);

      await context.getService().findAll({
        customerType: CustomerType.COMPANY,
        serviceType: ServiceType.TAX,
        status: CustomerStatus.ACTIVE,
        page: 1,
        pageSize: 10,
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(3);
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

function registerResidenceReminderTests(
  context: CustomerServiceTestContext,
): void {
  describe('findResidenceExpiryReminders', () => {
    it('filters non-null expire dates and applies local-calendar 90-day cutoff', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));

      const qb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      context.getPersonInfoRepo().createQueryBuilder = jest
        .fn()
        .mockReturnValue(qb);

      await context.getService().findResidenceExpiryReminders(1, 20);

      expect(qb.where).toHaveBeenCalledWith(
        'pi.residenceExpireDate IS NOT NULL',
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'pi.residenceExpireDate <= :cutoff',
        { cutoff: '2026-09-13' },
      );

      jest.useRealTimers();
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

describe('CustomerService', () => {
  let service: CustomerService;
  let customerRepo: Record<string, jest.Mock>;
  let companyInfoRepo: Record<string, jest.Mock>;
  let personInfoRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    customerRepo = {
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
      count: jest.fn().mockResolvedValue(0),
      softRemove: jest.fn().mockResolvedValue(undefined),
      recover: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };

    companyInfoRepo = {
      create: jest
        .fn()
        .mockImplementation(
          (data: Partial<CompanyInfo>): Partial<CompanyInfo> => data,
        ),
      save: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    personInfoRepo = {
      create: jest
        .fn()
        .mockImplementation(
          (data: Partial<PersonInfo>): Partial<PersonInfo> => data,
        ),
      save: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(CompanyInfo), useValue: companyInfoRepo },
        { provide: getRepositoryToken(PersonInfo), useValue: personInfoRepo },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
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
    setupCodeGenQueryBuilder,
    setupFindOneAfterCreate,
  };

  registerCreateTests(context);
  registerFindOneTests(context);
  registerFindAllTests(context);
  registerResidenceReminderTests(context);
  registerUpdateTests(context);
  registerRemoveTests(context);
  registerRestoreTests(context);
});
