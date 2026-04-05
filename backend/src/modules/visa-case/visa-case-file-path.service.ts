import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FilePathType } from '../../common/constants/enums';
import { CreateCustomerFilePathDto } from './dto/create-customer-file-path.dto';
import { QueryCustomerFilePathDto } from './dto/query-customer-file-path.dto';
import { UpdateCustomerFilePathDto } from './dto/update-customer-file-path.dto';
import { CustomerFilePath } from './entities/customer-file-path.entity';
import { mapCustomerFilePathToResponseDto } from './visa-case.mapper';
import type {
  CustomerFilePathListResponse,
  CustomerFilePathResponseDto,
} from './visa-case.types';
import { VisaCaseLookupService } from './visa-case-lookup.service';

/**
 * 管理客户资料路径台账的增删改查，与签证案件主流程拆分以降低单服务行数。
 */
@Injectable()
export class VisaCaseFilePathService {
  private readonly logger = new Logger(VisaCaseFilePathService.name);

  constructor(
    @InjectRepository(CustomerFilePath)
    private readonly filePathRepo: Repository<CustomerFilePath>,
    private readonly lookup: VisaCaseLookupService,
  ) {}

  /**
   * 读取路径记录关联的签证案件 id，供数据范围双校验使用（路径不存在时返回 null）。
   *
   * @param id - 资料路径主键
   * @returns `visa_case_id`；无关联案件或未找到记录时为 null
   */
  async findVisaCaseIdByFilePathId(id: string): Promise<string | null> {
    const fp = await this.filePathRepo.findOne({
      where: { id },
      select: { visaCaseId: true },
    });
    return fp?.visaCaseId ?? null;
  }

  /**
   * 在指定客户上下文中创建一条资料路径台账记录，可选关联到签证案件。
   *
   * @param customerId - 路由参数传入的客户 ID
   * @param dto - 路径创建参数，含路径类型、服务器路径与备注
   * @param userId - 当前登录用户 ID
   * @returns 已持久化且加载了创建人信息的路径响应对象
   * @throws {NotFoundException} 客户不存在或关联的签证案件不存在时
   */
  async createFilePath(
    customerId: string,
    dto: CreateCustomerFilePathDto,
    userId: string,
  ): Promise<CustomerFilePathResponseDto> {
    await this.lookup.ensureCustomerExists(customerId);

    if (dto.visaCaseId) {
      await this.lookup.ensureVisaCaseExists(dto.visaCaseId);
    }

    const entity = this.filePathRepo.create({
      customerId,
      visaCaseId: dto.visaCaseId ?? null,
      pathType: dto.pathType ?? FilePathType.OTHER,
      filePath: dto.filePath,
      displayName: dto.displayName ?? null,
      remark: dto.remark ?? null,
      createdBy: userId,
    });

    const saved = await this.filePathRepo.save(entity);
    this.logger.log(
      `File path created for customer ${customerId} by user ${userId}`,
    );

    const loaded = await this.filePathRepo.findOne({
      where: { id: saved.id },
      relations: ['creator'],
    });
    return mapCustomerFilePathToResponseDto(loaded!);
  }

  /**
   * 分页查询指定客户名下的资料路径台账，支持按路径类型筛选。
   *
   * @param customerId - 路径归属的客户 ID
   * @param query - 分页与路径类型筛选参数
   * @returns 包含路径列表和分页信息的结果对象
   * @throws {NotFoundException} 客户不存在时
   */
  async findFilePathsByCustomer(
    customerId: string,
    query: QueryCustomerFilePathDto,
  ): Promise<CustomerFilePathListResponse> {
    await this.lookup.ensureCustomerExists(customerId);

    const { page = 1, pageSize = 20, pathType } = query;

    const qb = this.filePathRepo
      .createQueryBuilder('fp')
      .leftJoinAndSelect('fp.creator', 'creator')
      .where('fp.customerId = :customerId', { customerId })
      .andWhere('fp.deletedAt IS NULL');

    if (pathType) {
      qb.andWhere('fp.pathType = :pathType', { pathType });
    }

    qb.orderBy('fp.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((fp) => mapCustomerFilePathToResponseDto(fp)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 分页查询指定签证案件下的资料路径台账。
   *
   * @param visaCaseId - 路径关联的签证案件 ID
   * @param query - 分页与路径类型筛选参数
   * @returns 包含路径列表和分页信息的结果对象
   * @throws {NotFoundException} 签证案件不存在时
   */
  async findFilePathsByVisaCase(
    visaCaseId: string,
    query: QueryCustomerFilePathDto,
  ): Promise<CustomerFilePathListResponse> {
    await this.lookup.ensureVisaCaseExists(visaCaseId);

    const { page = 1, pageSize = 20, pathType } = query;

    const qb = this.filePathRepo
      .createQueryBuilder('fp')
      .leftJoinAndSelect('fp.creator', 'creator')
      .where('fp.visaCaseId = :visaCaseId', { visaCaseId })
      .andWhere('fp.deletedAt IS NULL');

    if (pathType) {
      qb.andWhere('fp.pathType = :pathType', { pathType });
    }

    qb.orderBy('fp.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((fp) => mapCustomerFilePathToResponseDto(fp)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 更新指定资料路径台账记录的可编辑字段。
   *
   * @param id - 路径记录 ID
   * @param dto - 包含部分可更新字段的请求体
   * @returns 更新后的路径响应对象
   * @throws {NotFoundException} 路径记录不存在时
   * @throws {NotFoundException} 更新关联案件时案件不存在
   */
  async updateFilePath(
    id: string,
    dto: UpdateCustomerFilePathDto,
  ): Promise<CustomerFilePathResponseDto> {
    const fp = await this.filePathRepo.findOne({
      where: { id },
      relations: ['creator'],
    });

    if (!fp) {
      throw new NotFoundException('資料パスが見つかりません');
    }

    if (dto.visaCaseId !== undefined && dto.visaCaseId) {
      await this.lookup.ensureVisaCaseExists(dto.visaCaseId);
    }

    const { customerId: _ignored, ...updateFields } = dto;

    if (updateFields.pathType !== undefined)
      fp.pathType = updateFields.pathType;
    if (updateFields.filePath !== undefined)
      fp.filePath = updateFields.filePath;
    if (updateFields.displayName !== undefined)
      fp.displayName = updateFields.displayName ?? null;
    if (updateFields.remark !== undefined)
      fp.remark = updateFields.remark ?? null;
    if (updateFields.visaCaseId !== undefined)
      fp.visaCaseId = updateFields.visaCaseId ?? null;

    await this.filePathRepo.save(fp);
    this.logger.log(`File path ${id} updated`);

    const loaded = await this.filePathRepo.findOne({
      where: { id },
      relations: ['creator'],
    });
    return mapCustomerFilePathToResponseDto(loaded!);
  }

  /**
   * 对指定资料路径记录执行逻辑删除。
   *
   * @param id - 路径记录 ID
   * @throws {NotFoundException} 路径记录不存在时
   */
  async removeFilePath(id: string): Promise<void> {
    const fp = await this.filePathRepo.findOne({ where: { id } });

    if (!fp) {
      throw new NotFoundException('資料パスが見つかりません');
    }

    await this.filePathRepo.softRemove(fp);
    this.logger.log(`File path ${id} soft-deleted`);
  }
}
