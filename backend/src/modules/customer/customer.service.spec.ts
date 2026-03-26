import { Test, TestingModule } from '@nestjs/testing'
import { getRepositoryToken } from '@nestjs/typeorm'
import { NotFoundException, ConflictException } from '@nestjs/common'
import { CustomerService } from './customer.service'
import { Customer } from './entities/customer.entity'
import { CompanyInfo } from './entities/company-info.entity'
import { PersonInfo } from './entities/person-info.entity'
import {
  CustomerType,
  ServiceType,
  CustomerStatus,
} from '../../common/constants/enums'

function createMockCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'cust-1',
    customerCode: 'C00001',
    customerType: CustomerType.COMPANY,
    customerName: 'テスト株式会社',
    phone: '03-1234-5678',
    email: 'test@example.com',
    address: '東京都千代田区',
    serviceType: ServiceType.BOTH,
    ownerUserId: 'user-1',
    status: CustomerStatus.ACTIVE,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    owner: {
      id: 'user-1',
      displayName: 'テスト太郎',
    } as any,
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
  } as Customer
}

function createMockPersonalCustomer(overrides: Partial<Customer> = {}): Customer {
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
      residenceExpireDate: new Date('2028-12-31'),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as PersonInfo,
    ...overrides,
  })
}

describe('CustomerService', () => {
  let service: CustomerService
  let customerRepo: Record<string, jest.Mock>
  let companyInfoRepo: Record<string, jest.Mock>
  let personInfoRepo: Record<string, jest.Mock>

  beforeEach(async () => {
    customerRepo = {
      create: jest.fn().mockImplementation((d) => ({ ...d, id: 'cust-new' })),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      softRemove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    }

    companyInfoRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    }

    personInfoRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: getRepositoryToken(CompanyInfo), useValue: companyInfoRepo },
        { provide: getRepositoryToken(PersonInfo), useValue: personInfoRepo },
      ],
    }).compile()

    service = module.get<CustomerService>(CustomerService)
  })

  function setupCodeGenQueryBuilder(lastCustomer: Customer | null) {
    const qb = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(lastCustomer),
    }
    customerRepo.createQueryBuilder.mockReturnValue(qb)
    return qb
  }

  function setupFindOneAfterCreate(customer: Customer) {
    customerRepo.findOne.mockResolvedValue(customer)
  }

  describe('create', () => {
    it('should create a company customer with companyInfo', async () => {
      const mockCreated = createMockCustomer()
      setupCodeGenQueryBuilder(null)
      setupFindOneAfterCreate(mockCreated)

      const result = await service.create(
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
      )

      expect(customerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerType: CustomerType.COMPANY,
          customerName: 'テスト株式会社',
          customerCode: 'C00001',
        }),
      )
      expect(customerRepo.save).toHaveBeenCalled()
      expect(companyInfoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          corporationNumber: '1234567890123',
          fiscalMonth: 3,
        }),
      )
      expect(companyInfoRepo.save).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('should create a personal customer with personInfo', async () => {
      const mockCreated = createMockPersonalCustomer()
      setupCodeGenQueryBuilder(null)
      setupFindOneAfterCreate(mockCreated)

      const result = await service.create(
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
      )

      expect(customerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerType: CustomerType.PERSONAL,
          customerCode: 'P00001',
        }),
      )
      expect(personInfoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nationality: '日本',
        }),
      )
      expect(result).toBeDefined()
    })

    it('should auto-generate customer code with incrementing numbers', async () => {
      const lastCust = createMockCustomer({ customerCode: 'C00005' })
      setupCodeGenQueryBuilder(lastCust)
      setupFindOneAfterCreate(createMockCustomer({ customerCode: 'C00006' }))

      await service.create(
        {
          customerType: CustomerType.COMPANY,
          customerName: 'テスト2',
          serviceType: ServiceType.TAX,
        },
        'user-1',
      )

      expect(customerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ customerCode: 'C00006' }),
      )
    })

    it('should throw ConflictException for duplicate customer code', async () => {
      setupCodeGenQueryBuilder(null)
      customerRepo.count.mockResolvedValue(1)

      await expect(
        service.create(
          {
            customerType: CustomerType.COMPANY,
            customerName: '重複テスト',
            serviceType: ServiceType.ADMIN,
          },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException)
    })

    it('should create companyInfo when company payload has content even if customerType is personal', async () => {
      setupCodeGenQueryBuilder(null)
      setupFindOneAfterCreate(createMockPersonalCustomer())

      await service.create(
        {
          customerType: CustomerType.PERSONAL,
          customerName: '個人テスト',
          serviceType: ServiceType.ADMIN,
          companyInfo: { corporationNumber: '1234567890123' },
        },
        'user-1',
      )

      expect(companyInfoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          corporationNumber: '1234567890123',
        }),
      )
      expect(companyInfoRepo.save).toHaveBeenCalled()
    })

    it('should create both companyInfo and personInfo when both payloads have content', async () => {
      const mockCreated = createMockCustomer({
        personInfo: { id: 'pi-2', customerId: 'cust-new' } as PersonInfo,
      })
      setupCodeGenQueryBuilder(null)
      setupFindOneAfterCreate(mockCreated)

      await service.create(
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
      )

      expect(companyInfoRepo.create).toHaveBeenCalled()
      expect(companyInfoRepo.save).toHaveBeenCalled()
      expect(personInfoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          nationality: '中国',
        }),
      )
      expect(personInfoRepo.save).toHaveBeenCalled()
    })
  })

  describe('findOne', () => {
    it('should return customer with relations', async () => {
      const mockCustomer = createMockCustomer()
      customerRepo.findOne.mockResolvedValue(mockCustomer)

      const result = await service.findOne('cust-1')

      expect(result.id).toBe('cust-1')
      expect(customerRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        relations: ['companyInfo', 'personInfo', 'owner', 'staffRelations', 'staffRelations.user'],
      })
    })

    it('should throw NotFoundException for non-existent customer', async () => {
      customerRepo.findOne.mockResolvedValue(null)

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const mockCustomers = [createMockCustomer()]
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockCustomers, 1]),
      }
      customerRepo.createQueryBuilder.mockReturnValue(qb)

      const result = await service.findAll({ page: 1, pageSize: 20 })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
    })

    it('should apply keyword filter', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }
      customerRepo.createQueryBuilder.mockReturnValue(qb)

      await service.findAll({ keyword: 'テスト', page: 1, pageSize: 20 })

      expect(qb.andWhere).toHaveBeenCalled()
    })

    it('should apply type/service/status filters', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }
      customerRepo.createQueryBuilder.mockReturnValue(qb)

      await service.findAll({
        customerType: CustomerType.COMPANY,
        serviceType: ServiceType.TAX,
        status: CustomerStatus.ACTIVE,
        page: 1,
        pageSize: 10,
      })

      expect(qb.andWhere).toHaveBeenCalledTimes(3)
    })
  })

  describe('update', () => {
    it('should update basic customer fields', async () => {
      const mockCustomer = createMockCustomer()
      customerRepo.findOne.mockResolvedValue(mockCustomer)

      await service.update('cust-1', { customerName: '更新テスト' }, 'user-2')

      expect(customerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ customerName: '更新テスト', updatedBy: 'user-2' }),
      )
    })

    it('should update companyInfo for company type', async () => {
      const mockCustomer = createMockCustomer()
      customerRepo.findOne.mockResolvedValue(mockCustomer)

      await service.update(
        'cust-1',
        { companyInfo: { fiscalMonth: 12 } },
        'user-2',
      )

      expect(companyInfoRepo.save).toHaveBeenCalled()
    })

    it('should throw NotFoundException when updating non-existent customer', async () => {
      customerRepo.findOne.mockResolvedValue(null)

      await expect(
        service.update('nonexistent', { customerName: 'テスト' }, 'user-1'),
      ).rejects.toThrow(NotFoundException)
    })

    it('should handle type change from company to personal', async () => {
      const mockCustomer = createMockCustomer()
      customerRepo.findOne.mockResolvedValue(mockCustomer)

      await service.update(
        'cust-1',
        {
          customerType: CustomerType.PERSONAL,
          personInfo: { nationality: '日本' },
        },
        'user-1',
      )

      expect(companyInfoRepo.remove).toHaveBeenCalledWith(mockCustomer.companyInfo)
      expect(personInfoRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ nationality: '日本' }),
      )
    })
  })

  describe('remove', () => {
    it('should soft-delete a customer', async () => {
      const mockCustomer = createMockCustomer()
      customerRepo.findOne.mockResolvedValue(mockCustomer)

      await service.remove('cust-1')

      expect(customerRepo.softRemove).toHaveBeenCalledWith(mockCustomer)
    })

    it('should throw NotFoundException for non-existent customer', async () => {
      customerRepo.findOne.mockResolvedValue(null)

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      )
    })
  })
})
