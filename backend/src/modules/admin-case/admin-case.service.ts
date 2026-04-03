import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AdminCaseStatus } from '../../common/constants/enums';
import type { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import {
  type AdminCaseDocumentDto,
  type AdminCaseInterviewDto,
  type AdminCaseListItemDto,
  applyAdminCaseDocumentUpdateDto,
  applyAdminCaseUpdateDto,
  applyInterviewUpdateDto,
  mapAdminCaseDocumentToDto,
  mapAdminCaseInterviewToDto,
  mapAdminCaseToListItemDto,
  mapCreateAdminCaseDocumentDtoToEntityInput,
  mapCreateAdminCaseDtoToEntityInput,
  mapCreateInterviewDtoToEntityInput,
} from './admin-case.mapper';
import {
  applyAdminCaseInterviewQueryOptions,
  applyAdminCaseListQueryOptions,
} from './admin-case.query-helper';
import {
  assertAdminCaseStatusTransition,
  getAdminCaseAvailableTransitions,
} from './admin-case-status-flow';
import { CreateAdminCaseDto } from './dto/create-admin-case.dto';
import { CreateAdminCaseDocumentDto } from './dto/create-document.dto';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { QueryAdminCaseDto } from './dto/query-admin-case.dto';
import { QueryInterviewDto } from './dto/query-interview.dto';
import { UpdateAdminCaseDto } from './dto/update-admin-case.dto';
import { UpdateAdminCaseDocumentDto } from './dto/update-document.dto';
import { UpdateInterviewDto } from './dto/update-interview.dto';
import { AdminCase } from './entities/admin-case.entity';
import { AdminCaseDocument } from './entities/admin-case-document.entity';
import { AdminCaseInterview } from './entities/admin-case-interview.entity';

/**
 * 提供行政案件、面谈记录与案件资料的统一领域服务。
 *
 * 该服务负责维护案件状态流转、分页查询和关联资料映射逻辑，
 * 供控制器在不感知持久化细节的前提下复用。
 */
@Injectable()
export class AdminCaseService {
  private readonly logger = new Logger(AdminCaseService.name);

  constructor(
    @InjectRepository(AdminCase)
    private readonly caseRepo: Repository<AdminCase>,
    @InjectRepository(AdminCaseInterview)
    private readonly interviewRepo: Repository<AdminCaseInterview>,
    @InjectRepository(AdminCaseDocument)
    private readonly documentRepo: Repository<AdminCaseDocument>,
  ) {}

  /**
   * 创建新的行政案件，并补齐默认状态与审计字段。
   *
   * @param dto - 行政案件创建入参，包含客户、案件名称和可选负责人信息
   * @param userId - 当前执行创建操作的用户 ID；省略时审计字段写入 null
   * @returns 包含客户、负责人和面谈关联信息的最新案件实体
   */
  async create(dto: CreateAdminCaseDto, userId?: string): Promise<AdminCase> {
    const adminCase = this.caseRepo.create(
      mapCreateAdminCaseDtoToEntityInput(dto, userId),
    );

    const saved = await this.caseRepo.save(adminCase);
    this.logger.log(`AdminCase "${saved.id}" created by user ${userId}`);
    return this.findOne(saved.id);
  }

  /**
   * 按筛选条件分页查询行政案件列表，并映射为前端列表页所需结构。
   *
   * @param query - 案件列表的分页、关键字、负责人和状态筛选条件
   * @returns 供案件列表页消费的分页结果与摘要字段集合
   */
  async findAll(
    query: QueryAdminCaseDto,
  ): Promise<PaginatedResult<AdminCaseListItemDto>> {
    const { page = 1, pageSize = 20 } = query;

    const qb = this.caseRepo
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.customer', 'customer')
      .leftJoinAndSelect('ac.owner', 'owner');

    applyAdminCaseListQueryOptions(qb, query);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map(mapAdminCaseToListItemDto),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 查询单个行政案件详情，并带出客户、负责人和面谈关联数据。
   *
   * @param id - 目标案件 ID
   * @returns 完整的案件详情实体
   * @throws {NotFoundException} 对应案件不存在时
   */
  async findOne(id: string): Promise<AdminCase> {
    const adminCase = await this.caseRepo.findOne({
      where: { id },
      relations: ['customer', 'owner', 'interviews', 'interviews.creator'],
    });

    if (!adminCase) {
      throw new NotFoundException('案件が見つかりません');
    }

    return adminCase;
  }

  /**
   * 更新行政案件的基础信息，并回写最后修改人。
   *
   * @param id - 目标案件 ID
   * @param dto - 允许局部更新的案件字段集合
   * @param userId - 当前执行更新操作的用户 ID；省略时清空 updatedBy
   * @returns 更新后的案件详情实体
   * @throws {NotFoundException} 对应案件不存在时
   */
  async update(
    id: string,
    dto: UpdateAdminCaseDto,
    userId?: string,
  ): Promise<AdminCase> {
    const adminCase = await this.findOne(id);
    applyAdminCaseUpdateDto(adminCase, dto, userId);

    await this.caseRepo.save(adminCase);
    this.logger.log(`AdminCase "${id}" updated by user ${userId}`);
    return this.findOne(id);
  }

  /**
   * 校验状态流转规则后更新行政案件状态。
   *
   * @param id - 目标案件 ID
   * @param newStatus - 期望切换到的新状态
   * @param userId - 当前执行状态变更的用户 ID；省略时清空 updatedBy
   * @returns 完成状态变更后的案件详情实体
   * @throws {NotFoundException} 目标案件不存在时
   * @throws {BadRequestException} 当前状态不允许切换到目标状态时
   */
  async updateStatus(
    id: string,
    newStatus: AdminCaseStatus,
    userId?: string,
  ): Promise<AdminCase> {
    const adminCase = await this.findOne(id);
    assertAdminCaseStatusTransition(adminCase.status, newStatus);

    adminCase.status = newStatus;
    adminCase.updatedBy = userId ?? null;
    await this.caseRepo.save(adminCase);

    this.logger.log(
      `AdminCase "${id}" status changed to ${newStatus} by user ${userId}`,
    );
    return this.findOne(id);
  }

  /**
   * 逻辑删除行政案件，保留历史记录以便后续恢复。
   *
   * @param id - 目标案件 ID
   * @throws {NotFoundException} 目标案件不存在时
   */
  async remove(id: string): Promise<void> {
    const adminCase = await this.findOne(id);
    await this.caseRepo.softRemove(adminCase);
    this.logger.log(`AdminCase "${id}" soft-deleted`);
  }

  /**
   * 恢复已被逻辑删除的行政案件。
   *
   * @param id - 目标案件 ID
   * @returns 恢复后的案件详情实体
   * @throws {NotFoundException} 目标案件不存在时
   * @throws {BadRequestException} 目标案件尚未被删除时
   */
  async restore(id: string): Promise<AdminCase> {
    const adminCase = await this.caseRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!adminCase) throw new NotFoundException('案件が見つかりません');
    if (!adminCase.deletedAt)
      throw new BadRequestException('この案件は削除されていません');
    await this.caseRepo.recover(adminCase);
    this.logger.log(`AdminCase "${id}" restored`);
    return this.findOne(id);
  }

  /**
   * 返回指定案件状态当前允许切换的下一步状态集合。
   *
   * @param status - 当前案件状态
   * @returns 可供前端状态下拉框展示的目标状态列表
   */
  getAvailableTransitions(status: AdminCaseStatus): AdminCaseStatus[] {
    return getAdminCaseAvailableTransitions(status);
  }

  /**
   * 按客户维度分页查询其名下的行政案件列表。
   *
   * @param customerId - 目标客户 ID
   * @param query - 列表查询参数，内部会强制附加客户筛选条件
   * @returns 仅包含该客户案件的分页结果
   */
  async findByCustomer(
    customerId: string,
    query: QueryAdminCaseDto,
  ): Promise<PaginatedResult<AdminCaseListItemDto>> {
    return this.findAll({ ...query, customerId });
  }

  /**
   * 为指定案件新增一条面谈记录。
   *
   * @param caseId - 所属行政案件 ID
   * @param dto - 面谈日期、地点和内容等入参
   * @param userId - 当前创建面谈记录的用户 ID；省略时 createdBy 写入 null
   * @returns 带有创建人关联信息的面谈记录实体
   * @throws {NotFoundException} 所属案件不存在时
   */
  async createInterview(
    caseId: string,
    dto: CreateInterviewDto,
    userId?: string,
  ): Promise<AdminCaseInterview> {
    const adminCase = await this.findOne(caseId);
    const interview = this.interviewRepo.create(
      mapCreateInterviewDtoToEntityInput(
        caseId,
        dto.customerId ?? adminCase.customerId,
        dto,
        userId,
      ),
    );

    const saved = await this.interviewRepo.save(interview);
    this.logger.log(
      `Interview "${saved.id}" created for case "${caseId}" by user ${userId}`,
    );
    return this.findInterview(saved.id);
  }

  /**
   * 分页查询指定案件下的面谈记录，并映射为列表展示结构。
   *
   * @param caseId - 所属行政案件 ID
   * @param query - 面谈记录的分页与日期区间筛选条件
   * @returns 面谈记录分页结果
   */
  async findInterviews(
    caseId: string,
    query: QueryInterviewDto,
  ): Promise<PaginatedResult<AdminCaseInterviewDto>> {
    const { page = 1, pageSize = 20 } = query;

    const qb = this.interviewRepo
      .createQueryBuilder('iv')
      .leftJoinAndSelect('iv.creator', 'creator')
      .where('iv.adminCaseId = :caseId', { caseId });

    applyAdminCaseInterviewQueryOptions(qb, query);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map(mapAdminCaseInterviewToDto),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 查询单条面谈记录详情，并带出创建人信息。
   *
   * @param id - 面谈记录 ID
   * @returns 面谈记录实体
   * @throws {NotFoundException} 面谈记录不存在时
   */
  async findInterview(id: string): Promise<AdminCaseInterview> {
    const interview = await this.interviewRepo.findOne({
      where: { id },
      relations: ['creator'],
    });

    if (!interview) {
      throw new NotFoundException('面談記録が見つかりません');
    }

    return interview;
  }

  /**
   * 更新指定面谈记录的日期、地点、内容与客户绑定信息。
   *
   * @param id - 面谈记录 ID
   * @param dto - 允许局部更新的面谈字段
   * @param userId - 当前执行更新的用户 ID，仅用于审计日志输出
   * @returns 更新后的面谈记录实体
   * @throws {NotFoundException} 面谈记录不存在时
   */
  async updateInterview(
    id: string,
    dto: UpdateInterviewDto,
    userId?: string,
  ): Promise<AdminCaseInterview> {
    const interview = await this.findInterview(id);
    applyInterviewUpdateDto(interview, dto);

    await this.interviewRepo.save(interview);
    this.logger.log(`Interview "${id}" updated by user ${userId}`);
    return this.findInterview(id);
  }

  /**
   * 逻辑删除指定面谈记录。
   *
   * @param id - 面谈记录 ID
   * @throws {NotFoundException} 面谈记录不存在时
   */
  async removeInterview(id: string): Promise<void> {
    const interview = await this.findInterview(id);
    await this.interviewRepo.softRemove(interview);
    this.logger.log(`Interview "${id}" soft-deleted`);
  }

  /**
   * 查询指定案件已绑定的全部资料记录。
   *
   * @param caseId - 所属行政案件 ID
   * @returns 按创建时间倒序排列的资料实体列表
   * @throws {NotFoundException} 所属案件不存在时
   */
  async findDocuments(caseId: string): Promise<AdminCaseDocument[]> {
    await this.findOne(caseId);
    return this.documentRepo.find({
      where: { adminCaseId: caseId },
      relations: ['file', 'file.uploader'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 为指定案件新增一条资料绑定记录。
   *
   * @param caseId - 所属行政案件 ID
   * @param dto - 文件 ID、资料类型和备注等入参
   * @returns 带有文件关联信息的资料实体
   * @throws {NotFoundException} 所属案件不存在时
   */
  async createDocument(
    caseId: string,
    dto: CreateAdminCaseDocumentDto,
  ): Promise<AdminCaseDocument> {
    await this.findOne(caseId);
    const doc = this.documentRepo.create(
      mapCreateAdminCaseDocumentDtoToEntityInput(caseId, dto),
    );

    const saved = await this.documentRepo.save(doc);
    this.logger.log(
      `AdminCaseDocument "${saved.id}" created for case "${caseId}"`,
    );
    return this.findDocument(saved.id);
  }

  /**
   * 查询单条案件资料记录，并带出上传文件信息。
   *
   * @param docId - 资料记录 ID
   * @returns 资料实体及其文件关联信息
   * @throws {NotFoundException} 资料记录不存在时
   */
  async findDocument(docId: string): Promise<AdminCaseDocument> {
    const doc = await this.documentRepo.findOne({
      where: { id: docId },
      relations: ['file', 'file.uploader'],
    });
    if (!doc) {
      throw new NotFoundException('書類が見つかりません');
    }
    return doc;
  }

  /**
   * 更新案件资料的资料类型与备注信息。
   *
   * @param docId - 资料记录 ID
   * @param dto - 允许局部更新的资料字段
   * @returns 更新后的资料实体
   * @throws {NotFoundException} 资料记录不存在时
   */
  async updateDocument(
    docId: string,
    dto: UpdateAdminCaseDocumentDto,
  ): Promise<AdminCaseDocument> {
    const doc = await this.findDocument(docId);
    applyAdminCaseDocumentUpdateDto(doc, dto);
    await this.documentRepo.save(doc);
    this.logger.log(`AdminCaseDocument "${docId}" updated`);
    return this.findDocument(docId);
  }

  /**
   * 删除指定案件资料记录。
   *
   * @param docId - 资料记录 ID
   * @throws {NotFoundException} 资料记录不存在时
   */
  async removeDocument(docId: string): Promise<void> {
    const doc = await this.findDocument(docId);
    await this.documentRepo.remove(doc);
    this.logger.log(`AdminCaseDocument "${docId}" removed`);
  }

  /**
   * 将案件资料实体映射为接口返回结构，并展开文件摘要信息。
   *
   * @param doc - 已附带文件与上传人关联信息的资料实体
   * @returns 供前端资料面板消费的资料 DTO
   */
  toDocumentDto(doc: AdminCaseDocument): AdminCaseDocumentDto {
    return mapAdminCaseDocumentToDto(doc);
  }
}
