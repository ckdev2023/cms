import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { CustomerType } from '../../common/constants/enums';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CompanyInfo } from './entities/company-info.entity';
import { Customer } from './entities/customer.entity';
import { PersonInfo } from './entities/person-info.entity';

type CustomerResponseDto = {
  id: string;
  customerCode: string;
  customerType: CustomerType;
  customerName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  serviceType: Customer['serviceType'];
  ownerUserId: string | null;
  ownerName: string | null;
  status: Customer['status'];
  companyInfo: {
    id: string;
    corporationNumber: string | null;
    fiscalMonth: number | null;
    representativeName: string | null;
  } | null;
  personInfo: {
    id: string;
    nationality: string | null;
    residenceStatus: string | null;
    residenceExpireDate: Date | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
};

type CustomerListResponse = {
  items: CustomerResponseDto[];
  total: number;
  page: number;
  pageSize: number;
};

const ALLOWED_SORT_FIELDS = [
  'customerCode',
  'customerName',
  'customerType',
  'serviceType',
  'status',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(CompanyInfo)
    private readonly companyInfoRepo: Repository<CompanyInfo>,
    @InjectRepository(PersonInfo)
    private readonly personInfoRepo: Repository<PersonInfo>,
  ) {}

  /**
   * 创建客户主档，并按客户类型补齐公司或个人附属资料。
   *
   * @param dto - 包含客户基础字段及公司/个人资料的创建参数
   * @param userId - 当前登录用户 ID，省略时创建人与更新人写入空值
   * @returns 新建完成并重新加载关联信息的客户实体
   * @throws {ConflictException} 自动生成的客户编码已被占用时
   */
  async create(dto: CreateCustomerDto, userId?: string): Promise<Customer> {
    const customerCode = await this.generateCustomerCode(dto.customerType);

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
    });

    const saved = await this.customerRepo.save(customer);

    if (dto.customerType === CustomerType.COMPANY && dto.companyInfo) {
      const ci = this.companyInfoRepo.create({
        customerId: saved.id,
        corporationNumber: dto.companyInfo.corporationNumber ?? null,
        fiscalMonth: dto.companyInfo.fiscalMonth ?? null,
        representativeName: dto.companyInfo.representativeName ?? null,
      });
      await this.companyInfoRepo.save(ci);
    }

    if (dto.customerType === CustomerType.PERSONAL && dto.personInfo) {
      const pi = this.personInfoRepo.create({
        customerId: saved.id,
        nationality: dto.personInfo.nationality ?? null,
        residenceStatus: dto.personInfo.residenceStatus ?? null,
        residenceExpireDate: dto.personInfo.residenceExpireDate
          ? new Date(dto.personInfo.residenceExpireDate)
          : null,
      });
      await this.personInfoRepo.save(pi);
    }

    this.logger.log(
      `Customer "${saved.customerCode}" created by user ${userId}`,
    );
    return this.findOne(saved.id);
  }

  /**
   * 按筛选条件分页查询客户列表并补充负责人与附属资料摘要。
   *
   * @param query - 包含分页、关键字、状态、负责人和排序条件的查询参数
   * @returns 适用于列表接口的客户数据与分页信息
   */
  async findAll(query: QueryCustomerDto): Promise<CustomerListResponse> {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      sortBy,
      sortOrder = 'DESC',
    } = query;

    const qb = this.customerRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.companyInfo', 'ci')
      .leftJoinAndSelect('c.personInfo', 'pi')
      .leftJoinAndSelect('c.owner', 'owner');

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('c.customerName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('c.customerCode ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('c.phone ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('c.email ILIKE :kw', { kw: `%${keyword}%` });
        }),
      );
    }

    if (query.customerType) {
      qb.andWhere('c.customerType = :customerType', {
        customerType: query.customerType,
      });
    }

    if (query.serviceType) {
      qb.andWhere('c.serviceType = :serviceType', {
        serviceType: query.serviceType,
      });
    }

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }

    if (query.ownerUserId) {
      qb.andWhere('c.ownerUserId = :ownerUserId', {
        ownerUserId: query.ownerUserId,
      });
    }

    const orderField =
      sortBy && ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`c.${orderField}`, sortOrder);

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((customer) => this.toResponseDto(customer)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 读取单个客户详情并加载负责人、附属资料和协作成员关联。
   *
   * @param id - 客户主键 ID
   * @returns 已加载核心关联信息的客户实体
   * @throws {NotFoundException} 客户不存在时
   */
  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepo.findOne({
      where: { id },
      relations: [
        'companyInfo',
        'personInfo',
        'owner',
        'staffRelations',
        'staffRelations.user',
      ],
    });

    if (!customer) {
      throw new NotFoundException('顧客が見つかりません');
    }

    return customer;
  }

  /**
   * 更新客户基础资料，并在客户类型变更时同步重建附属公司或个人信息。
   *
   * @param id - 需要更新的客户主键 ID
   * @param dto - 包含基础字段与附属资料的更新参数
   * @param userId - 当前登录用户 ID，写入更新审计字段
   * @returns 更新完成后重新加载的客户实体
   * @throws {NotFoundException} 客户不存在时
   */
  async update(
    id: string,
    dto: UpdateCustomerDto,
    userId?: string,
  ): Promise<Customer> {
    const customer = await this.findOne(id);

    if (dto.customerName !== undefined)
      customer.customerName = dto.customerName;
    if (dto.phone !== undefined) customer.phone = dto.phone ?? null;
    if (dto.email !== undefined) customer.email = dto.email ?? null;
    if (dto.address !== undefined) customer.address = dto.address ?? null;
    if (dto.serviceType !== undefined) customer.serviceType = dto.serviceType;
    if (dto.ownerUserId !== undefined)
      customer.ownerUserId = dto.ownerUserId ?? null;
    customer.updatedBy = userId ?? null;

    const typeChanged =
      dto.customerType !== undefined &&
      dto.customerType !== customer.customerType;

    if (typeChanged) {
      customer.customerType = dto.customerType!;

      if (dto.customerType === CustomerType.COMPANY) {
        if (customer.personInfo) {
          await this.personInfoRepo.remove(customer.personInfo);
        }
        if (dto.companyInfo) {
          const ci = this.companyInfoRepo.create({
            customerId: id,
            ...dto.companyInfo,
          });
          await this.companyInfoRepo.save(ci);
        }
      } else {
        if (customer.companyInfo) {
          await this.companyInfoRepo.remove(customer.companyInfo);
        }
        if (dto.personInfo) {
          const pi = this.personInfoRepo.create({
            customerId: id,
            nationality: dto.personInfo.nationality ?? null,
            residenceStatus: dto.personInfo.residenceStatus ?? null,
            residenceExpireDate: dto.personInfo.residenceExpireDate
              ? new Date(dto.personInfo.residenceExpireDate)
              : null,
          });
          await this.personInfoRepo.save(pi);
        }
      }
    } else {
      if (customer.customerType === CustomerType.COMPANY && dto.companyInfo) {
        if (customer.companyInfo) {
          Object.assign(customer.companyInfo, {
            corporationNumber:
              dto.companyInfo.corporationNumber ??
              customer.companyInfo.corporationNumber,
            fiscalMonth:
              dto.companyInfo.fiscalMonth ?? customer.companyInfo.fiscalMonth,
            representativeName:
              dto.companyInfo.representativeName ??
              customer.companyInfo.representativeName,
          });
          await this.companyInfoRepo.save(customer.companyInfo);
        } else {
          const ci = this.companyInfoRepo.create({
            customerId: id,
            ...dto.companyInfo,
          });
          await this.companyInfoRepo.save(ci);
        }
      }

      if (customer.customerType === CustomerType.PERSONAL && dto.personInfo) {
        if (customer.personInfo) {
          Object.assign(customer.personInfo, {
            nationality:
              dto.personInfo.nationality ?? customer.personInfo.nationality,
            residenceStatus:
              dto.personInfo.residenceStatus ??
              customer.personInfo.residenceStatus,
            residenceExpireDate: dto.personInfo.residenceExpireDate
              ? new Date(dto.personInfo.residenceExpireDate)
              : customer.personInfo.residenceExpireDate,
          });
          await this.personInfoRepo.save(customer.personInfo);
        } else {
          const pi = this.personInfoRepo.create({
            customerId: id,
            nationality: dto.personInfo.nationality ?? null,
            residenceStatus: dto.personInfo.residenceStatus ?? null,
            residenceExpireDate: dto.personInfo.residenceExpireDate
              ? new Date(dto.personInfo.residenceExpireDate)
              : null,
          });
          await this.personInfoRepo.save(pi);
        }
      }
    }

    await this.customerRepo.save(customer);
    this.logger.log(
      `Customer "${customer.customerCode}" updated by user ${userId}`,
    );
    return this.findOne(id);
  }

  /**
   * 对客户记录执行逻辑删除，保留历史数据用于审计和恢复。
   *
   * @param id - 需要逻辑删除的客户主键 ID
   * @throws {NotFoundException} 客户不存在时
   */
  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    await this.customerRepo.softRemove(customer);
    this.logger.log(`Customer "${customer.customerCode}" soft-deleted`);
  }

  /**
   * 从逻辑删除状态恢复客户记录。
   *
   * @param id - 需要恢复的客户主键 ID
   * @returns 恢复完成后重新加载的客户实体
   * @throws {NotFoundException} 客户不存在或当前未处于删除状态时
   */
  async restore(id: string): Promise<Customer> {
    const customer = await this.customerRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!customer) {
      throw new NotFoundException('顧客が見つかりません');
    }
    if (!customer.deletedAt) {
      throw new NotFoundException('この顧客は削除されていません');
    }
    await this.customerRepo.recover(customer);
    this.logger.log(`Customer "${customer.customerCode}" restored`);
    return this.findOne(id);
  }

  /**
   * 检查客户编码是否已被现有记录占用。
   *
   * @param code - 需要校验的客户编码
   * @returns 编码已存在时返回 true
   */
  async checkCodeExists(code: string): Promise<boolean> {
    const count = await this.customerRepo.count({
      where: { customerCode: code },
    });
    return count > 0;
  }

  /**
   * 按客户类型生成下一个可用的客户编码。
   *
   * @param type - 客户类型，用于决定公司或个人编码前缀
   * @returns 形如 `C00001` 或 `P00001` 的客户编码
   * @throws {ConflictException} 生成出的编码已被占用时
   */
  private async generateCustomerCode(type: CustomerType): Promise<string> {
    const prefix = type === CustomerType.COMPANY ? 'C' : 'P';
    const lastCustomer = await this.customerRepo
      .createQueryBuilder('c')
      .where('c.customerCode LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.customerCode', 'DESC')
      .getOne();

    let nextNum = 1;
    if (lastCustomer) {
      const numPart = lastCustomer.customerCode.slice(prefix.length);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }

    const code = `${prefix}${String(nextNum).padStart(5, '0')}`;

    if (await this.checkCodeExists(code)) {
      throw new ConflictException(`顧客コード ${code} は既に存在します`);
    }

    return code;
  }

  /**
   * 将客户实体转换为列表接口使用的扁平响应结构。
   *
   * @param customer - 已加载负责人与附属资料关联的客户实体
   * @returns 适用于前端列表展示的客户摘要对象
   */
  private toResponseDto(customer: Customer): CustomerResponseDto {
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
    };
  }
}
