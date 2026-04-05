import {
  CustomerStatus,
  CustomerType,
  ServiceType,
} from '../../common/constants/enums';
import type { CustomerService } from './customer.service';
import { CompanyInfo } from './entities/company-info.entity';
import { Customer } from './entities/customer.entity';
import { PersonInfo } from './entities/person-info.entity';

export function createMockCustomer(
  overrides: Partial<Customer> = {},
): Customer {
  return {
    id: 'cust-1',
    customerCode: 'C00001',
    customerType: CustomerType.COMPANY,
    customerName: 'テスト株式会社',
    phone: '03-1234-5678',
    email: 'test@example.com',
    wechatId: null,
    lineId: null,
    address: '東京都千代田区',
    serviceType: ServiceType.BOTH,
    ownerUserId: 'user-1',
    status: CustomerStatus.ACTIVE,
    photoFileId: null,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    owner: {
      id: 'user-1',
      displayName: 'テスト太郎',
    } as Customer['owner'],
    companyInfo: {
      id: 'ci-1',
      customerId: 'cust-1',
      corporationNumber: '1234567890123',
      fiscalMonth: 3,
      representativeName: '代表太郎',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CompanyInfo,
    personInfo: null,
    notes: [],
    staffRelations: [],
    ...overrides,
  } as Customer;
}

export function createMockPersonalCustomer(
  overrides: Partial<Customer> = {},
): Customer {
  return createMockCustomer({
    id: 'cust-2',
    customerCode: 'P00001',
    customerType: CustomerType.PERSONAL,
    customerName: '田中一郎',
    companyInfo: null,
    personInfo: {
      id: 'pi-1',
      customerId: 'cust-2',
      nationality: '日本',
      residenceStatus: '永住者',
      passportNumber: null,
      residenceExpireDate: new Date('2028-12-31'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PersonInfo,
    ...overrides,
  });
}

export type CustomerServiceTestContext = {
  getService: () => CustomerService;
  getCustomerRepo: () => Record<string, jest.Mock>;
  getCompanyInfoRepo: () => Record<string, jest.Mock>;
  getPersonInfoRepo: () => Record<string, jest.Mock>;
  getFileRepo: () => Record<string, jest.Mock>;
  getVisaCaseRepo: () => Record<string, jest.Mock>;
  setupCodeGenQueryBuilder: (lastCustomer: Customer | null) => void;
  setupFindOneAfterCreate: (customer: Customer) => void;
};

export function createFindAllQueryBuilder(result: [Customer[], number]) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };
}
