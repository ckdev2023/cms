import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { VisaCaseStatus } from '../../common/constants/enums';
import { CreateCustomerFilePathDto } from './dto/create-customer-file-path.dto';
import { CreateMaterialTemplateDto } from './dto/create-material-template.dto';
import { CreateVisaCaseDto } from './dto/create-visa-case.dto';
import { CreateVisaCaseFamilyMemberDto } from './dto/create-visa-case-family-member.dto';
import { CreateVisaCaseLogDto } from './dto/create-visa-case-log.dto';
import { CreateVisaCaseMaterialItemDto } from './dto/create-visa-case-material-item.dto';
import { QueryCustomerFilePathDto } from './dto/query-customer-file-path.dto';
import { QueryGlobalVisaCaseListDto } from './dto/query-global-visa-case-list.dto';
import { QueryVisaCaseDto } from './dto/query-visa-case.dto';
import { QueryVisaCaseLogDto } from './dto/query-visa-case-log.dto';
import { QueryVisaCaseStatsDto } from './dto/query-visa-case-stats.dto';
import { QueryVisaReminderDto } from './dto/query-visa-reminder.dto';
import { QueryVisaWorkbenchDto } from './dto/query-visa-workbench.dto';
import { UpdateCustomerFilePathDto } from './dto/update-customer-file-path.dto';
import { UpdateMaterialTemplateDto } from './dto/update-material-template.dto';
import { UpdateVisaCaseDto } from './dto/update-visa-case.dto';
import { UpdateVisaCaseFamilyMemberDto } from './dto/update-visa-case-family-member.dto';
import { UpdateVisaCaseLogDto } from './dto/update-visa-case-log.dto';
import { UpdateVisaCaseMaterialItemDto } from './dto/update-visa-case-material-item.dto';
import { VisaCase } from './entities/visa-case.entity';
import { MaterialTemplateService } from './material-template.service';
import {
  formatLocalDateYyyyMmDd,
  mapVisaCaseToResponseDto,
} from './visa-case.mapper';
import type {
  CustomerFilePathListResponse,
  CustomerFilePathResponseDto,
  FamilyMemberResponseDto,
  MaterialSummaryResponseDto,
  MaterialTemplateResponseDto,
  VisaCaseListResponse,
  VisaCaseLogListResponse,
  VisaCaseLogResponseDto,
  VisaCaseMaterialItemResponseDto,
  VisaCaseResponseDto,
  VisaDomainStatsDto,
  VisaReminderListResponse,
  VisaWorkbenchAggregateDto,
} from './visa-case.types';
import { applyVisaCaseDataScopeToQueryBuilder } from './visa-case-data-scope.query';
import { VisaCaseDataScopeService } from './visa-case-data-scope.service';
import { VisaCaseDataScopePermissionService } from './visa-case-data-scope-permission.service';
import { VisaCaseFamilyMemberService } from './visa-case-family-member.service';
import { VisaCaseFilePathService } from './visa-case-file-path.service';
import {
  applyGlobalReminderBucketFilter,
  applyGlobalVisaCaseListScalarFilters,
  applyGlobalVisaCaseListSort,
} from './visa-case-global-list.query';
import { VisaCaseInternalPrimaryService } from './visa-case-internal-primary.service';
import { VisaCaseLogService } from './visa-case-log.service';
import { VisaCaseLookupService } from './visa-case-lookup.service';
import { VisaCaseMaterialService } from './visa-case-material.service';
import { VisaCaseReminderService } from './visa-case-reminder.service';

/**
 * 管理签证案件的核心业务逻辑，支持在客户上下文中创建、查询与更新案件；
 * 家属、日志、资料路径、提醒与 INTERNAL 主申请人同步委托专用子服务以降低单文件复杂度。
 */
@Injectable()
export class VisaCaseService {
  private readonly logger = new Logger(VisaCaseService.name);

  constructor(
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
    private readonly lookup: VisaCaseLookupService,
    private readonly internalPrimary: VisaCaseInternalPrimaryService,
    private readonly familyMemberService: VisaCaseFamilyMemberService,
    private readonly logService: VisaCaseLogService,
    private readonly filePathService: VisaCaseFilePathService,
    private readonly reminderService: VisaCaseReminderService,
    private readonly visaCaseDataScope: VisaCaseDataScopeService,
    private readonly visaCaseDataScopePermission: VisaCaseDataScopePermissionService,
    private readonly materialTemplateService: MaterialTemplateService,
    private readonly materialService: VisaCaseMaterialService,
  ) {}

  /**
   * 按案件 id 加载负责人列并校验当前用户在该行上的读/写数据范围（P2-S2d / docs/21 §18.6）。
   *
   * @param userId - 当前登录用户主键
   * @param visaCaseId - 签证案件主键
   * @param mode - 读模式用 404 掩藏；写模式用 403
   * @throws {NotFoundException} 案件不存在或读模式越权时
   * @throws {ForbiddenException} 写模式越权时
   */
  private async ensureVisaCaseRowAccessById(
    userId: string,
    visaCaseId: string,
    mode: 'read' | 'write',
  ): Promise<void> {
    const row = await this.visaCaseRepo.findOne({
      where: { id: visaCaseId },
      select: { id: true, assignedTo: true },
    });
    if (!row) {
      throw new NotFoundException('ビザ案件が見つかりません');
    }
    await this.visaCaseDataScopePermission.assertVisaCaseRowAccessible(
      userId,
      row.assignedTo,
      mode,
    );
  }

  /**
   * 在指定客户上下文中创建签证案件，INTERNAL 模式自动挂载主申请人家属记录，
   * EXTERNAL 模式保存外部主申请人快照且不创建客户主档。
   *
   * @param customerId - 案件归属的客户 ID（从路由参数获取）
   * @param dto - 案件创建请求体，`customerId` 字段会被路由参数覆盖
   * @param userId - 当前登录用户 ID
   * @returns 已持久化且加载了负责人、创建人与家属关联信息的案件实体
   * @throws {NotFoundException} 目标客户或内部主申请人不存在时
   * @throws {BadRequestException} INTERNAL 模式缺少主申请人 ID 或 EXTERNAL 模式缺少主申请人姓名时
   */
  async create(
    customerId: string,
    dto: CreateVisaCaseDto,
    userId: string,
  ): Promise<VisaCaseResponseDto> {
    await this.lookup.ensureCustomerExists(customerId);
    this.internalPrimary.validateExternalPrimary(
      dto.isFamilyCase,
      dto.familyLinkMode,
      dto.externalPrimaryName,
    );

    const internalPrimaryCustomerId =
      await this.internalPrimary.resolveInternalPrimaryCustomerId({
        isFamilyCase: dto.isFamilyCase,
        familyLinkMode: dto.familyLinkMode,
        internalPrimaryCustomerId: dto.internalPrimaryCustomerId,
      });

    const entity = this.visaCaseRepo.create({
      ...dto,
      customerId,
      caseStatus: dto.caseStatus ?? VisaCaseStatus.DRAFT,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.visaCaseRepo.save(entity);

    if (internalPrimaryCustomerId) {
      await this.internalPrimary.createInternalPrimaryMember(
        saved.id,
        internalPrimaryCustomerId,
      );
    }

    this.logger.log(
      `Visa case created for customer ${customerId} by user ${userId}`,
    );
    const full = await this.visaCaseRepo.findOne({
      where: { id: saved.id },
      relations: [
        'assignee',
        'creator',
        'internalPrimaryCustomer',
        'familyMembers',
        'familyMembers.customer',
      ],
    });
    if (!full) {
      throw new NotFoundException('ビザ案件が見つかりません');
    }
    return mapVisaCaseToResponseDto(full);
  }

  /**
   * 分页查询指定客户名下的签证案件列表并展开负责人与创建人展示名称。
   *
   * @param customerId - 案件归属的客户 ID
   * @param query - 包含分页、案件状态与负责人筛选的查询参数
   * @param currentUserId - 当前登录用户 ID（`dataScope` 解析）
   * @returns 包含案件列表和分页信息的结果对象
   * @throws {NotFoundException} 目标客户不存在时
   */
  async findByCustomer(
    customerId: string,
    query: QueryVisaCaseDto,
    currentUserId: string,
  ): Promise<VisaCaseListResponse> {
    await this.lookup.ensureCustomerExists(customerId);

    const resolved = await this.visaCaseDataScope.resolve(
      currentUserId,
      query.dataScope,
    );

    const {
      page = 1,
      pageSize = 20,
      caseStatus,
      assignedTo,
      materialStatus,
    } = query;

    const qb = this.visaCaseRepo
      .createQueryBuilder('vc')
      .leftJoinAndSelect('vc.assignee', 'assignee')
      .leftJoinAndSelect('vc.creator', 'creator')
      .leftJoinAndSelect('vc.internalPrimaryCustomer', 'internalPrimary')
      .leftJoinAndSelect('vc.familyMembers', 'fm')
      .leftJoinAndSelect('fm.customer', 'fmCustomer')
      .where('vc.customerId = :customerId', { customerId });

    applyVisaCaseDataScopeToQueryBuilder(qb, 'vc', resolved, 'custList');

    if (caseStatus) {
      qb.andWhere('vc.caseStatus = :caseStatus', { caseStatus });
    }
    if (assignedTo) {
      qb.andWhere('vc.assignedTo = :assignedTo', { assignedTo });
    }
    if (materialStatus) {
      qb.andWhere('vc.materialStatus = :materialStatus', { materialStatus });
    }

    qb.orderBy('vc.createdAt', 'DESC');
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((vc) => mapVisaCaseToResponseDto(vc)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 跨客户分页查询签证案件列表，支持 S4a 冻結筛选维度与 P0 提醒桶一致的主序排序。
   *
   * @param query - 全局列表分页与多选筛选条件
   * @param currentUserId - 当前登录用户 ID（`dataScope` 解析）
   * @returns 含客户展示字段、分页元数据的案件列表
   */
  async findAllGlobal(
    query: QueryGlobalVisaCaseListDto,
    currentUserId: string,
  ): Promise<VisaCaseListResponse> {
    const page = query.page ?? 1;
    const rawPageSize = query.pageSize ?? 20;
    const pageSize = Math.min(100, Math.max(1, rawPageSize));
    const todayStr = formatLocalDateYyyyMmDd(new Date());
    const supplementIds = await this.reminderService.getSupplementLogCaseIds();

    const resolved = await this.visaCaseDataScope.resolve(
      currentUserId,
      query.dataScope,
    );

    const qb = this.visaCaseRepo.createQueryBuilder('vc');

    applyVisaCaseDataScopeToQueryBuilder(qb, 'vc', resolved, 'gvcScope');
    applyGlobalVisaCaseListScalarFilters(qb, query, supplementIds);
    if (query.reminderBucket !== undefined) {
      applyGlobalReminderBucketFilter(
        qb,
        query.reminderBucket,
        todayStr,
        supplementIds,
      );
    }
    applyGlobalVisaCaseListSort(qb, todayStr, supplementIds);

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [pageRows, total] = await qb.getManyAndCount();
    const orderedIds = pageRows.map((row) => row.id);

    if (orderedIds.length === 0) {
      return {
        items: [],
        total,
        page,
        pageSize,
      };
    }

    const listRelations = [
      'assignee',
      'creator',
      'internalPrimaryCustomer',
      'familyMembers',
      'familyMembers.customer',
      'customer',
    ] as const;

    const loaded = await this.visaCaseRepo.find({
      where: { id: In(orderedIds) },
      relations: [...listRelations],
    });
    const orderIndex = new Map(orderedIds.map((id, index) => [id, index]));
    loaded.sort(
      (a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
    );

    return {
      items: loaded.map((vc) => mapVisaCaseToResponseDto(vc)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 读取单个签证案件详情，加载负责人与创建人关联信息。
   *
   * @param id - 签证案件主键 ID
   * @param userId - 当前登录用户主键（数据范围双校验）
   * @returns 匹配的案件响应对象
   * @throws {NotFoundException} 案件不存在或不在可读数据范围内时
   */
  async findOne(id: string, userId: string): Promise<VisaCaseResponseDto> {
    const vc = await this.visaCaseRepo.findOne({
      where: { id },
      relations: [
        'assignee',
        'creator',
        'internalPrimaryCustomer',
        'familyMembers',
        'familyMembers.customer',
      ],
    });

    if (!vc) {
      throw new NotFoundException('ビザ案件が見つかりません');
    }

    await this.visaCaseDataScopePermission.assertVisaCaseRowAccessible(
      userId,
      vc.assignedTo,
      'read',
    );

    return mapVisaCaseToResponseDto(vc);
  }

  /**
   * 更新签证案件的可编辑字段，切换为 INTERNAL 家族签时校验并同步主申请人家属记录，
   * 切换为 EXTERNAL 时清除 INTERNAL 专属字段与家属主申请人记录。
   *
   * @param id - 签证案件主键 ID
   * @param dto - 包含部分可更新字段的请求体
   * @param userId - 当前登录用户 ID
   * @returns 更新后的案件响应对象
   * @throws {NotFoundException} 案件不存在时
   * @throws {BadRequestException} INTERNAL 模式缺少主申请人 ID 或 EXTERNAL 模式缺少主申请人姓名时
   */
  async update(
    id: string,
    dto: UpdateVisaCaseDto,
    userId: string,
  ): Promise<VisaCaseResponseDto> {
    const vc = await this.visaCaseRepo.findOne({
      where: { id },
      relations: ['familyMembers'],
    });

    if (!vc) {
      throw new NotFoundException('ビザ案件が見つかりません');
    }

    await this.visaCaseDataScopePermission.assertVisaCaseRowAccessible(
      userId,
      vc.assignedTo,
      'write',
    );

    const { customerId: _ignored, ...updateFields } = dto;
    const effectiveFamilyCase = updateFields.isFamilyCase ?? vc.isFamilyCase;
    const effectiveLinkMode = updateFields.familyLinkMode ?? vc.familyLinkMode;

    this.internalPrimary.validateExternalPrimary(
      effectiveFamilyCase,
      effectiveLinkMode,
      updateFields.externalPrimaryName ?? vc.externalPrimaryName,
    );

    const internalPrimaryCustomerId =
      await this.internalPrimary.resolveInternalPrimaryCustomerId({
        isFamilyCase: effectiveFamilyCase,
        familyLinkMode: effectiveLinkMode,
        internalPrimaryCustomerId:
          updateFields.internalPrimaryCustomerId ??
          vc.internalPrimaryCustomerId,
      });

    if (
      this.internalPrimary.isExternalFamilyCase(
        effectiveFamilyCase,
        effectiveLinkMode,
      )
    ) {
      updateFields.internalPrimaryCustomerId = null as unknown as undefined;
      await this.internalPrimary.removeInternalPrimaryMember(id);
    }

    if (
      this.internalPrimary.isInternalFamilyCase(
        effectiveFamilyCase,
        effectiveLinkMode,
      )
    ) {
      updateFields.externalPrimaryName = null as unknown as undefined;
      updateFields.externalPrimaryCaseType = null as unknown as undefined;
      updateFields.externalPrimaryExpireDate = null as unknown as undefined;
      updateFields.externalPrimaryRelationToApplicant =
        null as unknown as undefined;
    }

    Object.assign(vc, updateFields, { updatedBy: userId });
    await this.visaCaseRepo.save(vc);

    if (internalPrimaryCustomerId) {
      await this.internalPrimary.syncInternalPrimaryMember(
        id,
        internalPrimaryCustomerId,
      );
    }

    this.logger.log(`Visa case ${id} updated by user ${userId}`);
    return this.findOne(id, userId);
  }

  /**
   * 查询指定签证案件下的全部家属成员列表。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param userId
   * @returns 按主申请人优先排列的家属成员列表
   * @throws {NotFoundException} 案件不存在时
   */
  async listFamilyMembers(
    visaCaseId: string,
    userId: string,
  ): Promise<FamilyMemberResponseDto[]> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'read');
    return this.familyMemberService.listFamilyMembers(visaCaseId);
  }

  /**
   * 向指定签证案件挂载一名家属成员，同一客户不可重复挂载，isPrimary 时自动取消原主申请人标记。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param dto - 家属成员创建参数
   * @param userId
   * @returns 新创建的家属成员响应对象
   * @throws {NotFoundException} 案件或目标客户不存在时
   * @throws {BadRequestException} 同一客户已挂载到该案件时
   */
  async addFamilyMember(
    visaCaseId: string,
    dto: CreateVisaCaseFamilyMemberDto,
    userId: string,
  ): Promise<FamilyMemberResponseDto> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'write');
    return this.familyMemberService.addFamilyMember(visaCaseId, dto);
  }

  /**
   * 更新指定家属成员的角色或主申请人标记，isPrimary 变更时自动维护唯一主申请人约束。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param memberId - 家属成员记录 ID
   * @param dto - 允许修改的字段集
   * @param userId
   * @returns 更新后的家属成员响应对象
   * @throws {NotFoundException} 案件或成员记录不存在时
   */
  async updateFamilyMember(
    visaCaseId: string,
    memberId: string,
    dto: UpdateVisaCaseFamilyMemberDto,
    userId: string,
  ): Promise<FamilyMemberResponseDto> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'write');
    return this.familyMemberService.updateFamilyMember(
      visaCaseId,
      memberId,
      dto,
    );
  }

  /**
   * 从签证案件中移除指定家属成员记录。
   *
   * @param visaCaseId - 签证案件主键 ID
   * @param memberId - 家属成员记录 ID
   * @param userId
   * @returns Promise<void> 删除完成后无返回值
   * @throws {NotFoundException} 案件或成员记录不存在时
   */
  async removeFamilyMember(
    visaCaseId: string,
    memberId: string,
    userId: string,
  ): Promise<void> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'write');
    return this.familyMemberService.removeFamilyMember(visaCaseId, memberId);
  }

  /**
   * 为指定签证案件创建一条日志，写入 notes 表并关联 visa_case_id。
   *
   * @param visaCaseId - 日志归属的签证案件 ID
   * @param dto - 包含日志类型、内容与结构化跟进字段的创建参数
   * @param userId - 当前登录用户 ID
   * @returns 已持久化且加载了创建人信息的日志响应对象
   * @throws {NotFoundException} 目标签证案件不存在时
   */
  async createLog(
    visaCaseId: string,
    dto: CreateVisaCaseLogDto,
    userId: string,
  ): Promise<VisaCaseLogResponseDto> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'write');
    return this.logService.createLog(visaCaseId, dto, userId);
  }

  /**
   * 分页查询指定签证案件的日志列表并展开创建人展示名称。
   *
   * @param visaCaseId - 日志归属的签证案件 ID
   * @param query - 分页、日志类型筛选查询参数
   * @param userId
   * @returns 包含日志列表和分页信息的结果对象
   * @throws {NotFoundException} 目标签证案件不存在时
   */
  async findLogs(
    visaCaseId: string,
    query: QueryVisaCaseLogDto,
    userId: string,
  ): Promise<VisaCaseLogListResponse> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'read');
    return this.logService.findLogs(visaCaseId, query);
  }

  /**
   * 按案件范围读取单条日志详情，避免跨案件访问越权数据。
   *
   * @param visaCaseId - 日志归属的签证案件 ID
   * @param logId - 日志主键 ID
   * @param userId
   * @returns 匹配案件范围且已加载创建人信息的日志响应对象
   * @throws {NotFoundException} 日志不存在或不属于该案件时
   */
  async findOneLog(
    visaCaseId: string,
    logId: string,
    userId: string,
  ): Promise<VisaCaseLogResponseDto> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'read');
    return this.logService.findOneLog(visaCaseId, logId);
  }

  /**
   * 更新指定签证案件日志的内容或结构化字段并返回最新实体。
   *
   * @param visaCaseId - 日志归属的签证案件 ID
   * @param logId - 需要更新的日志 ID
   * @param dto - 包含可选更新字段的日志修改参数
   * @param userId
   * @returns 更新完成后重新加载的日志响应对象
   * @throws {NotFoundException} 日志不存在或不属于该案件时
   */
  async updateLog(
    visaCaseId: string,
    logId: string,
    dto: UpdateVisaCaseLogDto,
    userId: string,
  ): Promise<VisaCaseLogResponseDto> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'write');
    return this.logService.updateLog(visaCaseId, logId, dto);
  }

  /**
   * 对指定签证案件日志执行逻辑删除，保留审计追踪数据。
   *
   * @param visaCaseId - 日志归属的签证案件 ID
   * @param logId - 需要逻辑删除的日志 ID
   * @param userId
   * @returns Promise<void> 软删除完成后无返回值
   * @throws {NotFoundException} 日志不存在或不属于该案件时
   */
  async removeLog(
    visaCaseId: string,
    logId: string,
    userId: string,
  ): Promise<void> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'write');
    return this.logService.removeLog(visaCaseId, logId);
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
    if (dto.visaCaseId) {
      await this.ensureVisaCaseRowAccessById(userId, dto.visaCaseId, 'write');
    }
    return this.filePathService.createFilePath(customerId, dto, userId);
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
    return this.filePathService.findFilePathsByCustomer(customerId, query);
  }

  /**
   * 分页查询指定签证案件下的资料路径台账。
   *
   * @param visaCaseId - 路径关联的签证案件 ID
   * @param query - 分页与路径类型筛选参数
   * @param userId
   * @returns 包含路径列表和分页信息的结果对象
   * @throws {NotFoundException} 签证案件不存在时
   */
  async findFilePathsByVisaCase(
    visaCaseId: string,
    query: QueryCustomerFilePathDto,
    userId: string,
  ): Promise<CustomerFilePathListResponse> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'read');
    return this.filePathService.findFilePathsByVisaCase(visaCaseId, query);
  }

  /**
   * 更新指定资料路径台账记录的可编辑字段。
   *
   * @param id - 路径记录 ID
   * @param dto - 包含部分可更新字段的请求体
   * @param userId
   * @returns 更新后的路径响应对象
   * @throws {NotFoundException} 路径记录不存在时
   * @throws {NotFoundException} 更新关联案件时案件不存在
   */
  async updateFilePath(
    id: string,
    dto: UpdateCustomerFilePathDto,
    userId: string,
  ): Promise<CustomerFilePathResponseDto> {
    const currentVid =
      await this.filePathService.findVisaCaseIdByFilePathId(id);
    if (currentVid) {
      await this.ensureVisaCaseRowAccessById(userId, currentVid, 'write');
    }
    if (dto.visaCaseId !== undefined) {
      const nextVid = dto.visaCaseId ?? null;
      if (nextVid && nextVid !== currentVid) {
        await this.ensureVisaCaseRowAccessById(userId, nextVid, 'write');
      }
    }
    return this.filePathService.updateFilePath(id, dto);
  }

  /**
   * 对指定资料路径记录执行逻辑删除。
   *
   * @param id - 路径记录 ID
   * @param userId
   * @returns Promise<void> 软删除完成后无返回值
   * @throws {NotFoundException} 路径记录不存在时
   */
  async removeFilePath(id: string, userId: string): Promise<void> {
    const vid = await this.filePathService.findVisaCaseIdByFilePathId(id);
    if (vid) {
      await this.ensureVisaCaseRowAccessById(userId, vid, 'write');
    }
    return this.filePathService.removeFilePath(id);
  }

  /**
   * 按四类提醒桶聚合签证案件并返回去重后的分页提醒列表。
   *
   * 桶优先级：补件提醒 > 今日待跟进 > 7天内到期 > 2个月内到期。
   * 同一案件命中多个桶时保留最高优先级，已过期案件归入「7天内到期」桶。
   *
   * @param query - 含提醒桶类型与负责人筛选的查询参数
   * @param currentUserId - 当前登录用户主键，用于解析 `dataScope`
   * @returns 按优先级排序、应用分页的提醒列表
   */
  async findVisaReminders(
    query: QueryVisaReminderDto,
    currentUserId: string,
  ): Promise<VisaReminderListResponse> {
    return this.reminderService.findVisaReminders(query, currentUserId);
  }

  /**
   * 返回签证域只读聚合统计，桶规则与提醒列表一致。
   *
   * @param query - 可选负责人筛选
   * @param currentUserId - 当前登录用户主键，用于解析 `dataScope`
   * @returns KPI 汇总体
   */
  async getVisaDomainStats(
    query: QueryVisaCaseStatsDto,
    currentUserId: string,
  ): Promise<VisaDomainStatsDto> {
    return this.reminderService.getVisaDomainStats(query, currentUserId);
  }

  /**
   * 返回签证工作台只读聚合：`stats` 与 `getVisaDomainStats` 同源；`reminderPreviews` 按桶各取 Top N，与 `/visa-reminders` 分类及排序一致。
   *
   * @param query - 负责人与每桶预览条数（0–20，缺省 5；0 仅返回统计）
   * @param currentUserId - 当前登录用户 ID
   * @returns KPI 与四分桶预览行
   */
  async getVisaWorkbenchAggregate(
    query: QueryVisaWorkbenchDto,
    currentUserId: string,
  ): Promise<VisaWorkbenchAggregateDto> {
    const rawLimit = query.previewLimit ?? 5;
    const previewLimit = Math.min(20, Math.max(0, Math.trunc(rawLimit)));
    const reminderQuery = {
      assignedTo: query.assignedTo,
      dataScope: query.dataScope,
    };

    const [stats, reminderPreviews] = await Promise.all([
      this.reminderService.getVisaDomainStats(
        { assignedTo: query.assignedTo, dataScope: query.dataScope },
        currentUserId,
      ),
      this.reminderService.getReminderPreviewsByBucket(
        reminderQuery,
        previewLimit,
        currentUserId,
      ),
    ]);

    return { stats, reminderPreviews };
  }

  // ── 材料模板 ──────────────────────────────────────────

  /**
   * 读取全部活跃材料模板列表。
   *
   * @returns 按 caseType 排序的模板数组
   */
  async findAllTemplates(): Promise<MaterialTemplateResponseDto[]> {
    return this.materialTemplateService.findAll();
  }

  /**
   * 创建材料模板及子项。
   *
   * @param dto - 模板创建参数
   * @returns 已持久化的模板响应
   */
  async createTemplate(
    dto: CreateMaterialTemplateDto,
  ): Promise<MaterialTemplateResponseDto> {
    return this.materialTemplateService.create(dto);
  }

  /**
   * 更新材料模板显示名称或全量替换模板项。
   *
   * @param id - 模板 ID
   * @param dto - 模板更新参数
   * @returns 更新后的模板响应
   */
  async updateTemplate(
    id: string,
    dto: UpdateMaterialTemplateDto,
  ): Promise<MaterialTemplateResponseDto> {
    return this.materialTemplateService.update(id, dto);
  }

  /**
   * 停用（逻辑删除）指定材料模板。
   *
   * @param id - 模板 ID
   * @returns Promise<void> 逻辑删除完成后无返回值
   */
  async deactivateTemplate(id: string): Promise<void> {
    return this.materialTemplateService.deactivate(id);
  }

  // ── 案件材料实例 ──────────────────────────────────────

  /**
   * 从模板实例化材料项到案件（幂等）。
   *
   * @param visaCaseId - 签证案件 ID
   * @param userId - 当前操作用户 ID
   * @returns 实例化后的材料项列表
   */
  async initializeMaterials(
    visaCaseId: string,
    userId: string,
  ): Promise<VisaCaseMaterialItemResponseDto[]> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'write');
    return this.materialService.initialize(visaCaseId, userId);
  }

  /**
   * 查询案件下全部材料项。
   *
   * @param visaCaseId - 签证案件 ID
   * @param userId
   * @returns 按排序的材料项列表
   */
  async findMaterials(
    visaCaseId: string,
    userId: string,
  ): Promise<VisaCaseMaterialItemResponseDto[]> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'read');
    return this.materialService.findByVisaCase(visaCaseId);
  }

  /**
   * 手动新增一条材料项。
   *
   * @param visaCaseId - 签证案件 ID
   * @param dto - 材料项创建参数
   * @param userId - 当前操作用户 ID
   * @returns 新创建的材料项
   */
  async createMaterialItem(
    visaCaseId: string,
    dto: CreateVisaCaseMaterialItemDto,
    userId: string,
  ): Promise<VisaCaseMaterialItemResponseDto> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'write');
    return this.materialService.createItem(visaCaseId, dto, userId);
  }

  /**
   * 更新材料项状态、备注或排序。
   *
   * @param visaCaseId - 签证案件 ID
   * @param itemId - 材料项 ID
   * @param dto - 更新参数
   * @param userId
   * @returns 更新后的材料项
   */
  async updateMaterialItem(
    visaCaseId: string,
    itemId: string,
    dto: UpdateVisaCaseMaterialItemDto,
    userId: string,
  ): Promise<VisaCaseMaterialItemResponseDto> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'write');
    return this.materialService.updateItem(visaCaseId, itemId, dto);
  }

  /**
   * 删除手动新增的材料项（模板来源项不可删除）。
   *
   * @param visaCaseId - 签证案件 ID
   * @param itemId - 材料项 ID
   * @param userId
   * @returns Promise<void> 删除完成后无返回值
   */
  async deleteMaterialItem(
    visaCaseId: string,
    itemId: string,
    userId: string,
  ): Promise<void> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'write');
    return this.materialService.deleteItem(visaCaseId, itemId);
  }

  /**
   * 获取案件材料完成统计与建议 material_status。
   *
   * @param visaCaseId - 签证案件 ID
   * @param userId
   * @returns 含完成数与建议状态的摘要
   */
  async getMaterialSummary(
    visaCaseId: string,
    userId: string,
  ): Promise<MaterialSummaryResponseDto> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'read');
    return this.materialService.getSummary(visaCaseId);
  }

  /**
   * 将 checklist 建议状态同步写入 visa_cases.material_status。
   *
   * @param visaCaseId - 签证案件 ID
   * @param userId
   * @returns 同步后的摘要
   */
  async syncMaterialStatus(
    visaCaseId: string,
    userId: string,
  ): Promise<MaterialSummaryResponseDto> {
    await this.ensureVisaCaseRowAccessById(userId, visaCaseId, 'write');
    return this.materialService.syncStatus(visaCaseId);
  }
}
