import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  MaterialStatus,
  MonthlyStatus,
  TaxContractStatus,
} from '../../common/constants/enums';
import {
  CreateTaxContractDto,
  CreateTaxDocumentDto,
  CreateTaxPeriodDto,
  CreateTaxWorkItemDto,
  GeneratePeriodsDto,
  QueryTaxContractDto,
  QueryTaxPeriodDto,
  UpdateTaxContractDto,
  UpdateTaxDocumentDto,
  UpdateTaxPeriodDto,
  UpdateTaxWorkItemDto,
} from './dto';
import {
  TaxContract,
  TaxMonthlyDocument,
  TaxMonthlyWorkItem,
  TaxPeriod,
} from './entities';
import {
  calcDeadline,
  expandMonths,
  recalcTaxPeriodMaterialStatus,
  toPeriodDetailDto,
  toPeriodListDto,
} from './tax.service.helpers';
import {
  createTaxDocument,
  createTaxWorkItem,
  removeTaxDocument,
  removeTaxWorkItem,
  updateTaxDocument,
  updateTaxWorkItem,
} from './tax.service.items';
import { findTaxContracts, findTaxPeriods } from './tax.service.queries';
import {
  PaginatedResponse,
  STATUS_TRANSITIONS,
  TaxContractListDto,
  TaxPeriodDetailDto,
  TaxPeriodListDto,
} from './tax.service.types';

/**
 * 封装税务合同、月次期间、资料与作业项的核心业务编排逻辑。
 */
@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);

  constructor(
    @InjectRepository(TaxContract)
    private readonly contractRepo: Repository<TaxContract>,
    @InjectRepository(TaxPeriod)
    private readonly periodRepo: Repository<TaxPeriod>,
    @InjectRepository(TaxMonthlyDocument)
    private readonly documentRepo: Repository<TaxMonthlyDocument>,
    @InjectRepository(TaxMonthlyWorkItem)
    private readonly workItemRepo: Repository<TaxMonthlyWorkItem>,
  ) {}

  // ── Contracts ──────────────────────────────────────────

  /**
   * 创建税务合同，并补齐默认状态、金额与审计字段。
   *
   * @param dto - 税务合同创建参数，包含客户、合同名称、计费周期等信息
   * @param userId - 当前操作人 ID，用于回写创建人与更新人，可省略
   * @returns 持久化后重新加载关联关系的税务合同实体
   */
  async create(
    dto: CreateTaxContractDto,
    userId?: string,
  ): Promise<TaxContract> {
    const contract = this.contractRepo.create({
      customerId: dto.customerId,
      contractName: dto.contractName,
      contractStatus: dto.contractStatus ?? TaxContractStatus.ACTIVE,
      billingCycle: dto.billingCycle,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      monthlyFee: dto.monthlyFee ?? 0,
      ownerUserId: dto.ownerUserId ?? null,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    });

    const saved = await this.contractRepo.save(contract);
    this.logger.log(`TaxContract "${saved.id}" created by user ${userId}`);
    return this.findOne(saved.id);
  }

  /**
   * 按分页、关键字和状态条件查询税务合同列表。
   *
   * @param query - 合同列表的分页、筛选与排序参数
   * @returns 适配列表页展示的税务合同分页结果
   */
  async findAll(
    query: QueryTaxContractDto,
  ): Promise<PaginatedResponse<TaxContractListDto>> {
    return findTaxContracts(this.contractRepo, query);
  }

  /**
   * 加载单个税务合同及其客户、负责人和月次期间关联。
   *
   * @param id - 税务合同主键 ID
   * @returns 命中的税务合同实体
   * @throws {NotFoundException} 指定合同不存在时抛出
   */
  async findOne(id: string): Promise<TaxContract> {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: ['customer', 'owner', 'periods'],
    });

    if (!contract) {
      throw new NotFoundException('契約が見つかりません');
    }

    return contract;
  }

  /**
   * 按传入字段局部更新税务合同信息。
   *
   * @param id - 税务合同主键 ID
   * @param dto - 合同更新参数，允许按需局部提交
   * @param userId - 当前操作人 ID，用于回写最后更新人，可省略
   * @returns 更新后重新加载关联关系的税务合同实体
   * @throws {NotFoundException} 指定合同不存在时抛出
   */
  async update(
    id: string,
    dto: UpdateTaxContractDto,
    userId?: string,
  ): Promise<TaxContract> {
    const contract = await this.findOne(id);

    if (dto.customerId !== undefined) contract.customerId = dto.customerId;
    if (dto.contractName !== undefined)
      contract.contractName = dto.contractName;
    if (dto.billingCycle !== undefined)
      contract.billingCycle = dto.billingCycle;
    if (dto.startDate !== undefined)
      contract.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined)
      contract.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.monthlyFee !== undefined) contract.monthlyFee = dto.monthlyFee;
    if (dto.ownerUserId !== undefined)
      contract.ownerUserId = dto.ownerUserId ?? null;
    contract.updatedBy = userId ?? null;

    await this.contractRepo.save(contract);
    this.logger.log(`TaxContract "${id}" updated by user ${userId}`);
    return this.findOne(id);
  }

  /**
   * 校验状态流转规则后更新税务合同状态。
   *
   * @param id - 税务合同主键 ID
   * @param newStatus - 目标合同状态
   * @param userId - 当前操作人 ID，用于回写最后更新人，可省略
   * @returns 状态变更后重新加载关联关系的税务合同实体
   * @throws {NotFoundException} 指定合同不存在时抛出
   * @throws {BadRequestException} 目标状态不符合预定义流转规则时抛出
   */
  async updateStatus(
    id: string,
    newStatus: TaxContractStatus,
    userId?: string,
  ): Promise<TaxContract> {
    const contract = await this.findOne(id);
    const allowed = STATUS_TRANSITIONS[contract.contractStatus];

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `ステータスを「${contract.contractStatus}」から「${newStatus}」に変更できません`,
      );
    }

    contract.contractStatus = newStatus;
    contract.updatedBy = userId ?? null;
    await this.contractRepo.save(contract);

    this.logger.log(
      `TaxContract "${id}" status changed to ${newStatus} by user ${userId}`,
    );
    return this.findOne(id);
  }

  /**
   * 软删除指定税务合同。
   *
   * @param id - 税务合同主键 ID
   * @returns 删除完成后返回空
   * @throws {NotFoundException} 指定合同不存在时抛出
   */
  async remove(id: string): Promise<void> {
    const contract = await this.findOne(id);
    await this.contractRepo.softRemove(contract);
    this.logger.log(`TaxContract "${id}" soft-deleted`);
  }

  /**
   * 从逻辑删除状态恢复税务合同。
   *
   * @param id - 税务合同主键 ID
   * @returns 恢复后重新加载关联关系的税务合同实体
   * @throws {NotFoundException} 指定合同不存在时抛出
   * @throws {BadRequestException} 合同未处于删除状态时抛出
   */
  async restore(id: string): Promise<TaxContract> {
    const contract = await this.contractRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!contract) throw new NotFoundException('契約が見つかりません');
    if (!contract.deletedAt)
      throw new BadRequestException('この契約は削除されていません');
    await this.contractRepo.recover(contract);
    this.logger.log(`TaxContract "${id}" restored`);
    return this.findOne(id);
  }

  /**
   * 返回可用的合同状态流转。
   *
   * @param status - 当前合同状态
   * @returns 可切换到的目标状态列表
   */
  getAvailableTransitions(status: TaxContractStatus): TaxContractStatus[] {
    return STATUS_TRANSITIONS[status] ?? [];
  }

  /**
   * 按客户复用合同列表查询。
   *
   * @param customerId - 客户主键 ID
   * @param query - 合同列表查询参数
   * @returns 限定到指定客户后的合同分页结果
   */
  async findByCustomer(
    customerId: string,
    query: QueryTaxContractDto,
  ): Promise<PaginatedResponse<TaxContractListDto>> {
    return this.findAll({ ...query, customerId });
  }

  // ── Periods ────────────────────────────────────────────

  /**
   * 在指定税务合同下创建单个月次期间。
   *
   * @param contractId - 所属税务合同 ID
   * @param dto - 月次期间创建参数
   * @param userId - 当前操作人 ID，用于回写创建人，可省略
   * @returns 持久化后补齐资料与作业项关联的月次期间实体
   * @throws {NotFoundException} 所属合同不存在时抛出
   * @throws {ConflictException} 同合同下已存在相同年月期间时抛出
   */
  async createPeriod(
    contractId: string,
    dto: CreateTaxPeriodDto,
    userId?: string,
  ): Promise<TaxPeriod> {
    const contract = await this.findOne(contractId);

    const existing = await this.periodRepo.findOne({
      where: { taxContractId: contractId, periodYm: dto.periodYm },
    });
    if (existing) {
      throw new ConflictException(
        `期間「${dto.periodYm}」は既に登録されています`,
      );
    }

    const period = this.periodRepo.create({
      taxContractId: contractId,
      customerId: contract.customerId,
      periodYm: dto.periodYm,
      declarationDeadline: dto.declarationDeadline
        ? new Date(dto.declarationDeadline)
        : null,
      monthlyStatus: dto.monthlyStatus ?? MonthlyStatus.NOT_STARTED,
      materialStatus: dto.materialStatus ?? MaterialStatus.NOT_RECEIVED,
      createdBy: userId ?? null,
    });

    const saved = await this.periodRepo.save(period);
    this.logger.log(
      `TaxPeriod "${saved.id}" (${dto.periodYm}) created for contract "${contractId}"`,
    );
    return this.findOnePeriod(saved.id);
  }

  /**
   * 按分页与状态条件查询指定合同下的月次期间列表。
   *
   * @param contractId - 所属税务合同 ID
   * @param query - 月次期间的分页、筛选与排序参数
   * @returns 适配列表页展示的月次期间分页结果
   */
  async findPeriods(
    contractId: string,
    query: QueryTaxPeriodDto,
  ): Promise<PaginatedResponse<TaxPeriodListDto>> {
    return findTaxPeriods(this.periodRepo, contractId, query);
  }

  /**
   * 加载单个月次期间及其资料、作业项详情。
   *
   * @param periodId - 月次期间主键 ID
   * @returns 命中的月次期间实体
   * @throws {NotFoundException} 指定期间不存在时抛出
   */
  async findOnePeriod(periodId: string): Promise<TaxPeriod> {
    const period = await this.periodRepo.findOne({
      where: { id: periodId },
      relations: [
        'documents',
        'documents.file',
        'workItems',
        'workItems.completedByUser',
      ],
      order: {
        workItems: { sortOrder: 'ASC', createdAt: 'ASC' },
        documents: { createdAt: 'ASC' },
      },
    });

    if (!period) {
      throw new NotFoundException('月次期間が見つかりません');
    }

    return period;
  }

  /**
   * 按传入字段局部更新月次期间信息。
   *
   * @param periodId - 月次期间主键 ID
   * @param dto - 月次期间更新参数
   * @param userId - 当前操作人 ID，仅用于日志记录，可省略
   * @returns 更新后的月次期间实体
   * @throws {NotFoundException} 指定期间不存在时抛出
   * @throws {ConflictException} 更新后的年月与同合同其他期间重复时抛出
   */
  async updatePeriod(
    periodId: string,
    dto: UpdateTaxPeriodDto,
    userId?: string,
  ): Promise<TaxPeriod> {
    const period = await this.findOnePeriod(periodId);

    if (dto.periodYm !== undefined) {
      const existing = await this.periodRepo.findOne({
        where: {
          taxContractId: period.taxContractId,
          periodYm: dto.periodYm,
        },
      });
      if (existing && existing.id !== periodId) {
        throw new ConflictException(
          `期間「${dto.periodYm}」は既に登録されています`,
        );
      }
      period.periodYm = dto.periodYm;
    }
    if (dto.declarationDeadline !== undefined) {
      period.declarationDeadline = dto.declarationDeadline
        ? new Date(dto.declarationDeadline)
        : null;
    }
    if (dto.monthlyStatus !== undefined) {
      period.monthlyStatus = dto.monthlyStatus;
    }
    if (dto.materialStatus !== undefined) {
      period.materialStatus = dto.materialStatus;
    }

    await this.periodRepo.save(period);
    this.logger.log(`TaxPeriod "${periodId}" updated by user ${userId}`);
    return this.findOnePeriod(periodId);
  }

  /**
   * 单独更新月次期间的执行状态。
   *
   * @param periodId - 月次期间主键 ID
   * @param monthlyStatus - 目标月次状态
   * @param userId - 当前操作人 ID，仅用于日志记录，可省略
   * @returns 状态更新后的月次期间实体
   * @throws {NotFoundException} 指定期间不存在时抛出
   */
  async updatePeriodStatus(
    periodId: string,
    monthlyStatus: MonthlyStatus,
    userId?: string,
  ): Promise<TaxPeriod> {
    const period = await this.findOnePeriod(periodId);
    period.monthlyStatus = monthlyStatus;
    await this.periodRepo.save(period);
    this.logger.log(
      `TaxPeriod "${periodId}" status changed to ${monthlyStatus} by user ${userId}`,
    );
    return this.findOnePeriod(periodId);
  }

  /**
   * 删除月次期间及其下属资料、作业项记录。
   *
   * @param periodId - 月次期间主键 ID
   * @returns 删除完成后返回空
   * @throws {NotFoundException} 指定期间不存在时抛出
   */
  async removePeriod(periodId: string): Promise<void> {
    const period = await this.findOnePeriod(periodId);
    await this.documentRepo.delete({ taxPeriodId: periodId });
    await this.workItemRepo.delete({ taxPeriodId: periodId });
    await this.periodRepo.softRemove(period);
    this.logger.log(`TaxPeriod "${periodId}" soft-deleted with children`);
  }

  /**
   * 按起止年月批量生成缺失的月次期间。
   *
   * @param contractId - 所属税务合同 ID
   * @param dto - 批量生成的年月区间与截止日参数
   * @param userId - 当前操作人 ID，用于回写创建人，可省略
   * @returns 本次实际新增的月次期间实体列表
   * @throws {NotFoundException} 所属合同不存在时抛出
   * @throws {BadRequestException} 起止年月非法或区间超过 36 个月时抛出
   */
  async generatePeriods(
    contractId: string,
    dto: GeneratePeriodsDto,
    userId?: string,
  ): Promise<TaxPeriod[]> {
    const contract = await this.findOne(contractId);

    if (dto.startYm > dto.endYm) {
      throw new BadRequestException(
        '開始期間は終了期間より前に設定してください',
      );
    }

    const months = expandMonths(dto.startYm, dto.endYm);
    if (months.length > 36) {
      throw new BadRequestException('一括生成は最大36か月までです');
    }

    const existingPeriods = await this.periodRepo.find({
      where: { taxContractId: contractId },
      select: ['periodYm'],
    });
    const existingSet = new Set(existingPeriods.map((p) => p.periodYm));

    const newPeriods: TaxPeriod[] = [];
    for (const ym of months) {
      if (existingSet.has(ym)) continue;

      const deadline = dto.deadlineDay
        ? calcDeadline(ym, dto.deadlineDay)
        : null;

      const period = this.periodRepo.create({
        taxContractId: contractId,
        customerId: contract.customerId,
        periodYm: ym,
        declarationDeadline: deadline,
        monthlyStatus: MonthlyStatus.NOT_STARTED,
        materialStatus: MaterialStatus.NOT_RECEIVED,
        createdBy: userId ?? null,
      });
      newPeriods.push(period);
    }

    if (newPeriods.length === 0) {
      return [];
    }

    const saved = await this.periodRepo.save(newPeriods);
    this.logger.log(
      `Generated ${saved.length} periods for contract "${contractId}" (${dto.startYm}~${dto.endYm})`,
    );
    return saved;
  }

  /**
   * 创建月次资料并同步期间资料状态。
   *
   * @param periodId - 所属月次期间 ID
   * @param dto - 月次资料创建参数
   * @returns 新建后的月次资料实体
   */
  async createDocument(
    periodId: string,
    dto: CreateTaxDocumentDto,
  ): Promise<TaxMonthlyDocument> {
    const saved = await createTaxDocument(
      this.periodRepo,
      this.documentRepo,
      periodId,
      dto,
    );
    await recalcTaxPeriodMaterialStatus(
      this.documentRepo,
      this.periodRepo,
      periodId,
    );
    this.logger.log(
      `TaxMonthlyDocument "${saved.id}" created for period "${periodId}"`,
    );
    return saved;
  }

  /**
   * 更新月次资料并同步期间资料状态。
   *
   * @param docId - 月次资料主键 ID
   * @param dto - 月次资料更新参数
   * @returns 更新后的月次资料实体
   */
  async updateDocument(
    docId: string,
    dto: UpdateTaxDocumentDto,
  ): Promise<TaxMonthlyDocument> {
    const saved = await updateTaxDocument(this.documentRepo, docId, dto);
    await recalcTaxPeriodMaterialStatus(
      this.documentRepo,
      this.periodRepo,
      saved.taxPeriodId,
    );
    return saved;
  }

  /**
   * 删除月次资料并同步期间资料状态。
   *
   * @param docId - 月次资料主键 ID
   * @returns 删除完成后返回空
   */
  async removeDocument(docId: string): Promise<void> {
    const doc = await removeTaxDocument(this.documentRepo, docId);
    await recalcTaxPeriodMaterialStatus(
      this.documentRepo,
      this.periodRepo,
      doc.taxPeriodId,
    );
    this.logger.log(`TaxMonthlyDocument "${docId}" removed`);
  }

  /**
   * 为指定期间创建月次作业项。
   *
   * @param periodId - 所属月次期间 ID
   * @param dto - 月次作业项创建参数
   * @returns 新建后的月次作业项实体
   */
  async createWorkItem(
    periodId: string,
    dto: CreateTaxWorkItemDto,
  ): Promise<TaxMonthlyWorkItem> {
    const saved = await createTaxWorkItem(
      this.periodRepo,
      this.workItemRepo,
      periodId,
      dto,
    );
    this.logger.log(
      `TaxMonthlyWorkItem "${saved.id}" created for period "${periodId}"`,
    );
    return saved;
  }

  /**
   * 按提交参数更新月次作业项。
   *
   * @param itemId - 月次作业项主键 ID
   * @param dto - 月次作业项更新参数
   * @param userId - 当前操作人 ID
   * @returns 更新后的月次作业项实体
   */
  async updateWorkItem(
    itemId: string,
    dto: UpdateTaxWorkItemDto,
    userId?: string,
  ): Promise<TaxMonthlyWorkItem> {
    return updateTaxWorkItem(this.workItemRepo, itemId, dto, userId);
  }

  /**
   * 删除指定的月次作业项记录。
   *
   * @param itemId - 月次作业项主键 ID
   * @returns 删除完成后返回空
   */
  async removeWorkItem(itemId: string): Promise<void> {
    await removeTaxWorkItem(this.workItemRepo, itemId);
    this.logger.log(`TaxMonthlyWorkItem "${itemId}" removed`);
  }

  /**
   * 映射月次期间列表项。
   *
   * @param p - 月次期间实体
   * @returns 月次期间列表展示结构
   */
  toPeriodListDto(p: TaxPeriod): TaxPeriodListDto {
    return toPeriodListDto(p);
  }

  /**
   * 映射月次期间详情项。
   *
   * @param p - 月次期间实体
   * @returns 月次期间详情展示结构
   */
  toPeriodDetailDto(p: TaxPeriod): TaxPeriodDetailDto {
    return toPeriodDetailDto(p);
  }
}
