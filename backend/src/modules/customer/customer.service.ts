import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { VisaReminderType } from '../../common/constants/enums';
import { formatLocalDateYyyyMmDd } from '../visa-case/visa-case.mapper';
import { VisaCaseDataScopeService } from '../visa-case/visa-case-data-scope.service';
import { VisaCaseReminderService } from '../visa-case/visa-case-reminder.service';
import type {
  CustomerDetailListPrimaryVisaCaseAugmentDto,
  CustomerListItemResponseDto,
  CustomerListPrimaryVisaCaseSummaryDto,
  CustomerListResponse,
} from './customer.service.types';
import { CustomerCodeService } from './customer-code.service';
import { applyCustomerListFiltersToQueryBuilder } from './customer-list.query';
import {
  collectCandidatePrimaryCustomerIdsForListFallback,
  loadFallbackPrimaryVisaCaseMapForListPage,
} from './customer-list-findall-primary-fallback.load';
import { resolveCustomerListPrimaryVisaCaseDisplay } from './customer-list-primary-customer-fallback.resolve';
import { CustomerListPrimaryVisaCaseService } from './customer-list-primary-visa-case.service';
import { isAllowedCustomerListSortField } from './customer-list-sort.util';
import { CustomerProfileService } from './customer-profile.service';
import { toCustomerResponseDto } from './customer-response.mapper';
import { CustomerVisaDerivedRiskService } from './customer-visa-derived-risk.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Customer } from './entities/customer.entity';
import { PersonInfo } from './entities/person-info.entity';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(PersonInfo)
    private readonly personInfoRepo: Repository<PersonInfo>,
    private readonly visaCaseReminderService: VisaCaseReminderService,
    private readonly visaCaseDataScope: VisaCaseDataScopeService,
    private readonly customerCode: CustomerCodeService,
    private readonly customerProfile: CustomerProfileService,
    private readonly customerVisaDerivedRisk: CustomerVisaDerivedRiskService,
    private readonly customerListPrimaryVisaCase: CustomerListPrimaryVisaCaseService,
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
    const customerCode = await this.customerCode.generateCustomerCode(
      dto.customerType,
    );
    const customer = this.customerProfile.buildCustomerEntity(
      dto,
      customerCode,
      userId,
    );
    if (dto.photoFileId) {
      await this.customerProfile.assertCustomerPhotoFileAssignable(
        dto.photoFileId,
        null,
      );
    }
    const saved = await this.customerRepo.save(customer);
    await this.customerProfile.createRelatedProfile(saved.id, dto);
    if (dto.photoFileId) {
      await this.customerProfile.linkPhotoFileToCustomer(
        dto.photoFileId,
        saved.id,
      );
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
   * @param currentUserId - 当前登录用户 ID（签证派生筛选与摘要范围）
   * @returns 适用于列表接口的客户数据与分页信息
   */
  async findAll(
    query: QueryCustomerDto,
    currentUserId: string,
  ): Promise<CustomerListResponse> {
    const { page = 1, pageSize = 20, sortBy, sortOrder = 'DESC' } = query;

    const resolved = await this.visaCaseDataScope.resolve(
      currentUserId,
      query.dataScope,
    );

    const todayStr = formatLocalDateYyyyMmDd(new Date());
    const supplementLogCaseIds =
      await this.visaCaseReminderService.getSupplementLogCaseIds();

    const qb = this.customerRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.companyInfo', 'ci')
      .leftJoinAndSelect('c.personInfo', 'pi')
      .leftJoinAndSelect('c.owner', 'owner');

    applyCustomerListFiltersToQueryBuilder(
      qb,
      query,
      todayStr,
      supplementLogCaseIds,
      resolved,
    );

    const orderField = isAllowedCustomerListSortField(sortBy)
      ? sortBy
      : 'createdAt';
    qb.orderBy(`c.${orderField}`, sortOrder);

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    const customerIdList = items.map((c) => c.id);

    const riskMap =
      await this.customerVisaDerivedRisk.fetchCustomerVisaDerivedRiskMap(
        customerIdList,
        todayStr,
        supplementLogCaseIds,
        resolved,
      );

    const selfPrimaryCaseMap =
      await this.customerListPrimaryVisaCase.fetchCustomerListPrimaryVisaCaseMap(
        customerIdList,
        resolved,
      );

    const candidatePrimaryIds =
      collectCandidatePrimaryCustomerIdsForListFallback(
        items,
        selfPrimaryCaseMap,
      );
    const { existingPrimaryCustomerIds, fallbackPrimaryCaseMap } =
      await loadFallbackPrimaryVisaCaseMapForListPage(
        {
          customerRepo: this.customerRepo,
          fetchCustomerListPrimaryVisaCaseMap: (ids, scope) =>
            this.customerListPrimaryVisaCase.fetchCustomerListPrimaryVisaCaseMap(
              ids,
              scope,
            ),
        },
        candidatePrimaryIds,
        resolved,
      );

    return {
      items: items.map((customer) =>
        this.buildCustomerListItemResponse(
          customer,
          riskMap,
          selfPrimaryCaseMap,
          fallbackPrimaryCaseMap,
          existingPrimaryCustomerIds,
        ),
      ),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 将单条客户实体与页内派生风险、主展示摘要映射合并为列表接口行 DTO。
   *
   * @param customer - 已加载 company/person/owner 的列表行实体
   * @param riskMap - 客户 ID → 签证派生提醒桶
   * @param selfPrimaryCaseMap - 本人主展示案件摘要（第一轮批量查询）
   * @param fallbackPrimaryCaseMap - 主客户 ID → 主展示摘要（第二轮，供家属回退）
   * @param existingPrimaryCustomerIds - 未软删存在的主客户 ID 集合
   * @returns `CustomerListItemResponseDto` 形状的一行
   */
  private buildCustomerListItemResponse(
    customer: Customer,
    riskMap: ReadonlyMap<string, VisaReminderType | null>,
    selfPrimaryCaseMap: ReadonlyMap<
      string,
      CustomerListPrimaryVisaCaseSummaryDto | null
    >,
    fallbackPrimaryCaseMap: ReadonlyMap<
      string,
      CustomerListPrimaryVisaCaseSummaryDto | null
    >,
    existingPrimaryCustomerIds: ReadonlySet<string>,
  ): CustomerListItemResponseDto {
    const selfSummary = selfPrimaryCaseMap.get(customer.id) ?? null;
    const display = resolveCustomerListPrimaryVisaCaseDisplay(
      customer,
      selfSummary,
      fallbackPrimaryCaseMap,
      existingPrimaryCustomerIds,
    );
    return {
      ...toCustomerResponseDto(customer),
      visaDerivedRisk: riskMap.get(customer.id) ?? null,
      listPrimaryVisaCase: display.listPrimaryVisaCase,
      listPrimaryVisaCaseSource: display.listPrimaryVisaCaseSource,
      primaryCustomerIdForListFallback:
        display.primaryCustomerIdForListFallback,
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
   * 读取单个客户详情并附加与列表同源的主展示签证案件摘要（默认全所可见范围，与 `findAll` 的 `dataScope` 缺省一致）。
   *
   * @param id - 客户主键 ID
   * @param currentUserId - 当前登录用户 ID，用于解析签证数据范围
   * @returns 客户实体及 `listPrimaryVisaCase` / `listPrimaryVisaCaseSource` / `primaryCustomerIdForListFallback` 只读字段，供详情页默认 Tab 等消费
   * @throws {NotFoundException} 客户不存在时
   */
  async findOneWithListPrimaryVisaCase(
    id: string,
    currentUserId: string,
  ): Promise<Customer & CustomerDetailListPrimaryVisaCaseAugmentDto> {
    const customer = await this.findOne(id);
    const resolved = await this.visaCaseDataScope.resolve(
      currentUserId,
      undefined,
    );
    const selfPrimaryCaseMap =
      await this.customerListPrimaryVisaCase.fetchCustomerListPrimaryVisaCaseMap(
        [id],
        resolved,
      );
    const selfSummary = selfPrimaryCaseMap.get(id) ?? null;
    const candidatePrimaryIds =
      collectCandidatePrimaryCustomerIdsForListFallback(
        [customer],
        selfPrimaryCaseMap,
      );
    const { existingPrimaryCustomerIds, fallbackPrimaryCaseMap } =
      await loadFallbackPrimaryVisaCaseMapForListPage(
        {
          customerRepo: this.customerRepo,
          fetchCustomerListPrimaryVisaCaseMap: (ids, scope) =>
            this.customerListPrimaryVisaCase.fetchCustomerListPrimaryVisaCaseMap(
              ids,
              scope,
            ),
        },
        candidatePrimaryIds,
        resolved,
      );
    const display = resolveCustomerListPrimaryVisaCaseDisplay(
      customer,
      selfSummary,
      fallbackPrimaryCaseMap,
      existingPrimaryCustomerIds,
    );
    return {
      ...customer,
      listPrimaryVisaCase: display.listPrimaryVisaCase,
      listPrimaryVisaCaseSource: display.listPrimaryVisaCaseSource,
      primaryCustomerIdForListFallback:
        display.primaryCustomerIdForListFallback,
    };
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
    const targetType = dto.customerType ?? customer.customerType;

    if (dto.photoFileId !== undefined && dto.photoFileId !== null) {
      await this.customerProfile.assertCustomerPhotoFileAssignable(
        dto.photoFileId,
        id,
      );
    }

    this.customerProfile.applyBasicCustomerUpdates(customer, dto, userId);
    await this.customerProfile.syncRelatedProfile(
      customer,
      id,
      dto,
      targetType,
    );
    customer.customerType = targetType;

    await this.customerRepo.save(customer);
    if (dto.photoFileId !== undefined && dto.photoFileId !== null) {
      await this.customerProfile.linkPhotoFileToCustomer(dto.photoFileId, id);
    }
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
    return this.customerCode.checkCodeExists(code);
  }
}
