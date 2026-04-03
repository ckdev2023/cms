import { BadRequestException, ConflictException } from '@nestjs/common';

import { CustomerType, ServiceType } from '../../common/constants/enums';
import type { CustomerServiceTestContext } from './customer.service.spec.mocks';
import {
  createMockCustomer,
  createMockPersonalCustomer,
} from './customer.service.spec.mocks';
import { Customer } from './entities/customer.entity';
import { PersonInfo } from './entities/person-info.entity';

function registerCreateBasicSuccessTests(
  context: CustomerServiceTestContext,
): void {
  it('should create a company customer with companyInfo', async () => {
    const mockCreated = createMockCustomer();
    context.setupCodeGenQueryBuilder(null);
    context.setupFindOneAfterCreate(mockCreated);

    const result = await context.getService().create(
      {
        customerType: CustomerType.COMPANY,
        customerName: 'テスト株式会社',
        serviceType: ServiceType.BOTH,
        companyInfo: {
          corporationNumber: '1234567890123',
          fiscalMonth: 3,
          representativeName: '代表太郎',
        },
      },
      'user-1',
    );

    expect(context.getCustomerRepo().create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerType: CustomerType.COMPANY,
        customerName: 'テスト株式会社',
        customerCode: 'C00001',
      }),
    );
    expect(context.getCustomerRepo().save).toHaveBeenCalled();
    expect(context.getCompanyInfoRepo().create).toHaveBeenCalledWith(
      expect.objectContaining({
        corporationNumber: '1234567890123',
        fiscalMonth: 3,
      }),
    );
    expect(context.getCompanyInfoRepo().save).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should create a personal customer with personInfo', async () => {
    const mockCreated = createMockPersonalCustomer();
    context.setupCodeGenQueryBuilder(null);
    context.setupFindOneAfterCreate(mockCreated);

    const result = await context.getService().create(
      {
        customerType: CustomerType.PERSONAL,
        customerName: '田中一郎',
        serviceType: ServiceType.ADMIN,
        personInfo: {
          nationality: '日本',
          residenceStatus: '永住者',
          residenceExpireDate: '2028-12-31',
        },
      },
      'user-1',
    );

    expect(context.getCustomerRepo().create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerType: CustomerType.PERSONAL,
        customerCode: 'P00001',
      }),
    );
    expect(context.getPersonInfoRepo().create).toHaveBeenCalledWith(
      expect.objectContaining({
        nationality: '日本',
      }),
    );
    expect(result).toBeDefined();
  });
}

function registerCreatePrimaryCustomerTests(
  context: CustomerServiceTestContext,
): void {
  it('should reject create when primaryCustomerId equals new customer id', async () => {
    context.setupCodeGenQueryBuilder(null);

    await expect(
      context.getService().create(
        {
          customerType: CustomerType.PERSONAL,
          customerName: '本人参照テスト',
          serviceType: ServiceType.ADMIN,
          personInfo: {
            nationality: '日本',
            primaryCustomerId: 'cust-new',
          },
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(context.getPersonInfoRepo().save).not.toHaveBeenCalled();
  });

  it('should reject create when primaryCustomerId does not exist', async () => {
    context.setupCodeGenQueryBuilder(null);
    context.getCustomerRepo().findOne.mockResolvedValueOnce(null);

    await expect(
      context.getService().create(
        {
          customerType: CustomerType.PERSONAL,
          customerName: '主顧客なし',
          serviceType: ServiceType.ADMIN,
          personInfo: {
            nationality: '日本',
            primaryCustomerId: '00000000-0000-4000-8000-000000000099',
          },
        },
        'user-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create personal customer when primaryCustomerId references an existing customer', async () => {
    const mockCreated = createMockPersonalCustomer({
      id: 'cust-new',
      personInfo: {
        id: 'pi-1',
        customerId: 'cust-new',
        nationality: '日本',
        primaryCustomerId: 'other-cust',
      } as PersonInfo,
    });
    context.setupCodeGenQueryBuilder(null);
    context
      .getCustomerRepo()
      .findOne.mockResolvedValueOnce({ id: 'other-cust' } as Customer)
      .mockResolvedValue(mockCreated);

    await context.getService().create(
      {
        customerType: CustomerType.PERSONAL,
        customerName: '家族テスト',
        serviceType: ServiceType.ADMIN,
        personInfo: {
          nationality: '日本',
          primaryCustomerId: 'other-cust',
        },
      },
      'user-1',
    );

    expect(context.getPersonInfoRepo().create).toHaveBeenCalledWith(
      expect.objectContaining({ primaryCustomerId: 'other-cust' }),
    );
  });
}

function registerCreateCodeGuardTests(
  context: CustomerServiceTestContext,
): void {
  it('should auto-generate customer code with incrementing numbers', async () => {
    const lastCust = createMockCustomer({ customerCode: 'C00005' });
    context.setupCodeGenQueryBuilder(lastCust);
    context.setupFindOneAfterCreate(
      createMockCustomer({ customerCode: 'C00006' }),
    );

    await context.getService().create(
      {
        customerType: CustomerType.COMPANY,
        customerName: 'テスト2',
        serviceType: ServiceType.TAX,
      },
      'user-1',
    );

    expect(context.getCustomerRepo().create).toHaveBeenCalledWith(
      expect.objectContaining({ customerCode: 'C00006' }),
    );
  });

  it('should throw ConflictException for duplicate customer code', async () => {
    context.setupCodeGenQueryBuilder(null);
    context.getCustomerRepo().count.mockResolvedValue(1);

    await expect(
      context.getService().create(
        {
          customerType: CustomerType.COMPANY,
          customerName: '重複テスト',
          serviceType: ServiceType.ADMIN,
        },
        'user-1',
      ),
    ).rejects.toThrow(ConflictException);
  });
}

function registerCreateRelationPayloadTests(
  context: CustomerServiceTestContext,
): void {
  it('should create companyInfo when company payload has content even if customerType is personal', async () => {
    context.setupCodeGenQueryBuilder(null);
    context.setupFindOneAfterCreate(createMockPersonalCustomer());

    await context.getService().create(
      {
        customerType: CustomerType.PERSONAL,
        customerName: '個人テスト',
        serviceType: ServiceType.ADMIN,
        companyInfo: { corporationNumber: '1234567890123' },
      },
      'user-1',
    );

    expect(context.getCompanyInfoRepo().create).toHaveBeenCalledWith(
      expect.objectContaining({
        corporationNumber: '1234567890123',
      }),
    );
    expect(context.getCompanyInfoRepo().save).toHaveBeenCalled();
  });

  it('should create both companyInfo and personInfo when both payloads have content', async () => {
    const mockCreated = createMockCustomer({
      personInfo: { id: 'pi-2', customerId: 'cust-new' } as PersonInfo,
    });
    context.setupCodeGenQueryBuilder(null);
    context.setupFindOneAfterCreate(mockCreated);

    await context.getService().create(
      {
        customerType: CustomerType.COMPANY,
        customerName: '代表兼法人',
        serviceType: ServiceType.BOTH,
        companyInfo: {
          corporationNumber: '1234567890123',
          fiscalMonth: 3,
          representativeName: '代表太郎',
        },
        personInfo: {
          nationality: '中国',
          residenceStatus: '技術・人文知識・国際業務',
          residenceExpireDate: '2030-01-01',
        },
      },
      'user-1',
    );

    expect(context.getCompanyInfoRepo().create).toHaveBeenCalled();
    expect(context.getCompanyInfoRepo().save).toHaveBeenCalled();
    expect(context.getPersonInfoRepo().create).toHaveBeenCalledWith(
      expect.objectContaining({
        nationality: '中国',
      }),
    );
    expect(context.getPersonInfoRepo().save).toHaveBeenCalled();
  });
}

function registerCreateGuardTests(context: CustomerServiceTestContext): void {
  registerCreateCodeGuardTests(context);
  registerCreateRelationPayloadTests(context);
}

function registerCreateSuccessTests(context: CustomerServiceTestContext): void {
  registerCreateBasicSuccessTests(context);
  registerCreatePrimaryCustomerTests(context);
}

export function registerCreateTests(context: CustomerServiceTestContext): void {
  describe('create', () => {
    registerCreateSuccessTests(context);
    registerCreateGuardTests(context);
  });
}
