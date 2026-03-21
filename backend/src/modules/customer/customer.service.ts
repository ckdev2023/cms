import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Brackets } from 'typeorm'
import { Customer } from './entities/customer.entity'
import { CompanyInfo } from './entities/company-info.entity'
import { PersonInfo } from './entities/person-info.entity'
import { CreateCustomerDto } from './dto/create-customer.dto'
import { UpdateCustomerDto } from './dto/update-customer.dto'
import { QueryCustomerDto } from './dto/query-customer.dto'
import { CustomerType } from '../../common/constants/enums'

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name)

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CompanyInfo)
    private readonly companyInfoRepo: Repository<CompanyInfo>,
    @InjectRepository(PersonInfo)
    private readonly personInfoRepo: Repository<PersonInfo>,
  ) {}

  async create(dto: CreateCustomerDto, userId?: string): Promise<Customer> {
    const customerCode = await this.generateCustomerCode(dto.customerType)

    const customer = this.customerRepo.create({
      customerCode,
      customerType: dto.customerType,
      customerName: dto.customerName,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
      serviceType: dto.serviceType,
      ownerUserId: dto.ownerUserId ?? null,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    })

    const saved = await this.customerRepo.save(customer)

    if (dto.customerType === CustomerType.COMPANY && dto.companyInfo) {
      const ci = this.companyInfoRepo.create({
        customerId: saved.id,
        corporationNumber: dto.companyInfo.corporationNumber ?? null,
        fiscalMonth: dto.companyInfo.fiscalMonth ?? null,
        representativeName: dto.companyInfo.representativeName ?? null,
      })
      await this.companyInfoRepo.save(ci)
    }

    if (dto.customerType === CustomerType.PERSONAL && dto.personInfo) {
      const pi = this.personInfoRepo.create({
        customerId: saved.id,
        nationality: dto.personInfo.nationality ?? null,
        residenceStatus: dto.personInfo.residenceStatus ?? null,
        residenceExpireDate: dto.personInfo.residenceExpireDate
          ? new Date(dto.personInfo.residenceExpireDate)
          : null,
      })
      await this.personInfoRepo.save(pi)
    }

    this.logger.log(`Customer "${saved.customerCode}" created by user ${userId}`)
    return this.findOne(saved.id)
  }

  async findAll(query: QueryCustomerDto) {
    const { page = 1, pageSize = 20, keyword, sortBy, sortOrder = 'DESC' } = query

    const qb = this.customerRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.companyInfo', 'ci')
      .leftJoinAndSelect('c.personInfo', 'pi')
      .leftJoinAndSelect('c.owner', 'owner')

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('c.customerName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('c.customerCode ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('c.phone ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('c.email ILIKE :kw', { kw: `%${keyword}%` })
        }),
      )
    }

    if (query.customerType) {
      qb.andWhere('c.customerType = :customerType', {
        customerType: query.customerType,
      })
    }

    if (query.serviceType) {
      qb.andWhere('c.serviceType = :serviceType', {
        serviceType: query.serviceType,
      })
    }

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status })
    }

    if (query.ownerUserId) {
      qb.andWhere('c.ownerUserId = :ownerUserId', {
        ownerUserId: query.ownerUserId,
      })
    }

    const allowedSortFields = [
      'customerCode',
      'customerName',
      'customerType',
      'serviceType',
      'status',
      'createdAt',
      'updatedAt',
    ]
    const orderField = sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    qb.orderBy(`c.${orderField}`, sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return { items: items.map((c) => this.toResponseDto(c)), total, page, pageSize }
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepo.findOne({
      where: { id },
      relations: ['companyInfo', 'personInfo', 'owner', 'staffRelations', 'staffRelations.user'],
    })

    if (!customer) {
      throw new NotFoundException('顧客が見つかりません')
    }

    return customer
  }

  async update(id: string, dto: UpdateCustomerDto, userId?: string): Promise<Customer> {
    const customer = await this.findOne(id)

    if (dto.customerName !== undefined) customer.customerName = dto.customerName
    if (dto.phone !== undefined) customer.phone = dto.phone ?? null
    if (dto.email !== undefined) customer.email = dto.email ?? null
    if (dto.address !== undefined) customer.address = dto.address ?? null
    if (dto.serviceType !== undefined) customer.serviceType = dto.serviceType
    if (dto.ownerUserId !== undefined) customer.ownerUserId = dto.ownerUserId ?? null
    customer.updatedBy = userId ?? null

    const typeChanged = dto.customerType !== undefined && dto.customerType !== customer.customerType

    if (typeChanged) {
      customer.customerType = dto.customerType!

      if (dto.customerType === CustomerType.COMPANY) {
        if (customer.personInfo) {
          await this.personInfoRepo.remove(customer.personInfo)
        }
        if (dto.companyInfo) {
          const ci = this.companyInfoRepo.create({
            customerId: id,
            ...dto.companyInfo,
          })
          await this.companyInfoRepo.save(ci)
        }
      } else {
        if (customer.companyInfo) {
          await this.companyInfoRepo.remove(customer.companyInfo)
        }
        if (dto.personInfo) {
          const pi = this.personInfoRepo.create({
            customerId: id,
            nationality: dto.personInfo.nationality ?? null,
            residenceStatus: dto.personInfo.residenceStatus ?? null,
            residenceExpireDate: dto.personInfo.residenceExpireDate
              ? new Date(dto.personInfo.residenceExpireDate)
              : null,
          })
          await this.personInfoRepo.save(pi)
        }
      }
    } else {
      if (customer.customerType === CustomerType.COMPANY && dto.companyInfo) {
        if (customer.companyInfo) {
          Object.assign(customer.companyInfo, {
            corporationNumber: dto.companyInfo.corporationNumber ?? customer.companyInfo.corporationNumber,
            fiscalMonth: dto.companyInfo.fiscalMonth ?? customer.companyInfo.fiscalMonth,
            representativeName: dto.companyInfo.representativeName ?? customer.companyInfo.representativeName,
          })
          await this.companyInfoRepo.save(customer.companyInfo)
        } else {
          const ci = this.companyInfoRepo.create({
            customerId: id,
            ...dto.companyInfo,
          })
          await this.companyInfoRepo.save(ci)
        }
      }

      if (customer.customerType === CustomerType.PERSONAL && dto.personInfo) {
        if (customer.personInfo) {
          Object.assign(customer.personInfo, {
            nationality: dto.personInfo.nationality ?? customer.personInfo.nationality,
            residenceStatus: dto.personInfo.residenceStatus ?? customer.personInfo.residenceStatus,
            residenceExpireDate: dto.personInfo.residenceExpireDate
              ? new Date(dto.personInfo.residenceExpireDate)
              : customer.personInfo.residenceExpireDate,
          })
          await this.personInfoRepo.save(customer.personInfo)
        } else {
          const pi = this.personInfoRepo.create({
            customerId: id,
            nationality: dto.personInfo.nationality ?? null,
            residenceStatus: dto.personInfo.residenceStatus ?? null,
            residenceExpireDate: dto.personInfo.residenceExpireDate
              ? new Date(dto.personInfo.residenceExpireDate)
              : null,
          })
          await this.personInfoRepo.save(pi)
        }
      }
    }

    await this.customerRepo.save(customer)
    this.logger.log(`Customer "${customer.customerCode}" updated by user ${userId}`)
    return this.findOne(id)
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id)
    await this.customerRepo.softRemove(customer)
    this.logger.log(`Customer "${customer.customerCode}" soft-deleted`)
  }

  async restore(id: string): Promise<Customer> {
    const customer = await this.customerRepo.findOne({
      where: { id },
      withDeleted: true,
    })
    if (!customer) {
      throw new NotFoundException('顧客が見つかりません')
    }
    if (!customer.deletedAt) {
      throw new NotFoundException('この顧客は削除されていません')
    }
    await this.customerRepo.recover(customer)
    this.logger.log(`Customer "${customer.customerCode}" restored`)
    return this.findOne(id)
  }

  async checkCodeExists(code: string): Promise<boolean> {
    const count = await this.customerRepo.count({
      where: { customerCode: code },
    })
    return count > 0
  }

  private async generateCustomerCode(type: CustomerType): Promise<string> {
    const prefix = type === CustomerType.COMPANY ? 'C' : 'P'
    const lastCustomer = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.customerCode LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.customerCode', 'DESC')
      .getOne()

    let nextNum = 1
    if (lastCustomer) {
      const numPart = lastCustomer.customerCode.slice(prefix.length)
      const parsed = parseInt(numPart, 10)
      if (!isNaN(parsed)) {
        nextNum = parsed + 1
      }
    }

    const code = `${prefix}${String(nextNum).padStart(5, '0')}`

    if (await this.checkCodeExists(code)) {
      throw new ConflictException(`顧客コード ${code} は既に存在します`)
    }

    return code
  }

  private toResponseDto(customer: Customer) {
    return {
      id: customer.id,
      customerCode: customer.customerCode,
      customerType: customer.customerType,
      customerName: customer.customerName,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      serviceType: customer.serviceType,
      ownerUserId: customer.ownerUserId,
      ownerName: customer.owner?.displayName ?? null,
      status: customer.status,
      companyInfo: customer.companyInfo
        ? {
            id: customer.companyInfo.id,
            corporationNumber: customer.companyInfo.corporationNumber,
            fiscalMonth: customer.companyInfo.fiscalMonth,
            representativeName: customer.companyInfo.representativeName,
          }
        : null,
      personInfo: customer.personInfo
        ? {
            id: customer.personInfo.id,
            nationality: customer.personInfo.nationality,
            residenceStatus: customer.personInfo.residenceStatus,
            residenceExpireDate: customer.personInfo.residenceExpireDate,
          }
        : null,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    }
  }
}
