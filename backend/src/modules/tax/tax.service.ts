import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

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

const STATUS_TRANSITIONS: Record<TaxContractStatus, TaxContractStatus[]> = {
  [TaxContractStatus.ACTIVE]: [
    TaxContractStatus.EXPIRED,
    TaxContractStatus.TERMINATED,
  ],
  [TaxContractStatus.EXPIRED]: [
    TaxContractStatus.ACTIVE,
    TaxContractStatus.TERMINATED,
  ],
  [TaxContractStatus.TERMINATED]: [],
};

type PaginatedResponse<TItem> = {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
};

type TaxContractListDto = {
  id: string;
  customerId: string;
  customerName: string | null;
  contractName: string;
  contractStatus: TaxContractStatus;
  billingCycle: TaxContract['billingCycle'];
  startDate: Date;
  endDate: Date | null;
  monthlyFee: number;
  ownerUserId: string | null;
  ownerName: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TaxPeriodListDto = {
  id: string;
  taxContractId: string;
  customerId: string;
  periodYm: string;
  declarationDeadline: Date | null;
  monthlyStatus: MonthlyStatus;
  materialStatus: MaterialStatus;
  documentCount: number;
  documentReceivedCount: number;
  workItemCount: number;
  workItemCompletedCount: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TaxPeriodDocumentDto = {
  id: string;
  documentName: string;
  fileId: string | null;
  received: boolean;
  receivedAt: Date | null;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TaxPeriodWorkItemDto = {
  id: string;
  itemName: string;
  completed: boolean;
  completedAt: Date | null;
  completedBy: string | null;
  completedByName: string | null;
  remark: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type TaxPeriodDetailDto = {
  id: string;
  taxContractId: string;
  customerId: string;
  periodYm: string;
  declarationDeadline: Date | null;
  monthlyStatus: MonthlyStatus;
  materialStatus: MaterialStatus;
  documents: TaxPeriodDocumentDto[];
  workItems: TaxPeriodWorkItemDto[];
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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
    const {
      page = 1,
      pageSize = 20,
      keyword,
      sortBy,
      sortOrder = 'DESC',
    } = query;

    const qb = this.contractRepo
      .createQueryBuilder('tc')
      .leftJoinAndSelect('tc.customer', 'customer')
      .leftJoinAndSelect('tc.owner', 'owner');

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('tc.contractName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('customer.customerName ILIKE :kw', {
              kw: `%${keyword}%`,
            });
        }),
      );
    }

    if (query.contractStatus) {
      qb.andWhere('tc.contractStatus = :contractStatus', {
        contractStatus: query.contractStatus,
      });
    }

    if (query.billingCycle) {
      qb.andWhere('tc.billingCycle = :billingCycle', {
        billingCycle: query.billingCycle,
      });
    }

    if (query.customerId) {
      qb.andWhere('tc.customerId = :customerId', {
        customerId: query.customerId,
      });
    }

    if (query.ownerUserId) {
      qb.andWhere('tc.ownerUserId = :ownerUserId', {
        ownerUserId: query.ownerUserId,
      });
    }

    if (query.startDateFrom) {
      qb.andWhere('tc.startDate >= :from', { from: query.startDateFrom });
    }

    if (query.startDateTo) {
      qb.andWhere('tc.startDate <= :to', { to: query.startDateTo });
    }

    const allowedSortFields = [
      'contractName',
      'contractStatus',
      'startDate',
      'endDate',
      'monthlyFee',
      'createdAt',
      'updatedAt',
    ];
    const orderField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`tc.${orderField}`, sortOrder);

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((c) => this.toContractListDto(c)),
      total,
      page,
      pageSize,
    };
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
   * 返回合同当前状态允许进入的下一批状态。
   *
   * @param status - 当前合同状态
   * @returns 允许的目标状态列表；未定义状态时返回空数组
   */
  getAvailableTransitions(status: TaxContractStatus): TaxContractStatus[] {
    return STATUS_TRANSITIONS[status] ?? [];
  }

  /**
   * 按客户维度复用合同列表查询逻辑。
   *
   * @param customerId - 客户主键 ID
   * @param query - 合同列表的分页、筛选与排序参数
   * @returns 限定到指定客户后的税务合同分页结果
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
    const { page = 1, pageSize = 20, sortBy, sortOrder = 'ASC' } = query;

    const qb = this.periodRepo
      .createQueryBuilder('tp')
      .leftJoinAndSelect('tp.documents', 'doc')
      .leftJoinAndSelect('tp.workItems', 'wi')
      .where('tp.taxContractId = :contractId', { contractId });

    if (query.monthlyStatus) {
      qb.andWhere('tp.monthlyStatus = :monthlyStatus', {
        monthlyStatus: query.monthlyStatus,
      });
    }

    if (query.materialStatus) {
      qb.andWhere('tp.materialStatus = :materialStatus', {
        materialStatus: query.materialStatus,
      });
    }

    if (query.periodYmFrom) {
      qb.andWhere('tp.periodYm >= :periodYmFrom', {
        periodYmFrom: query.periodYmFrom,
      });
    }

    if (query.periodYmTo) {
      qb.andWhere('tp.periodYm <= :periodYmTo', {
        periodYmTo: query.periodYmTo,
      });
    }

    if (query.deadlineFrom) {
      qb.andWhere('tp.declarationDeadline >= :deadlineFrom', {
        deadlineFrom: query.deadlineFrom,
      });
    }

    if (query.deadlineTo) {
      qb.andWhere('tp.declarationDeadline <= :deadlineTo', {
        deadlineTo: query.deadlineTo,
      });
    }

    const allowedSortFields = [
      'periodYm',
      'declarationDeadline',
      'monthlyStatus',
      'materialStatus',
      'createdAt',
    ];
    const orderField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'periodYm';
    qb.orderBy(`tp.${orderField}`, sortOrder);

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((p) => this.toPeriodListDto(p)),
      total,
      page,
      pageSize,
    };
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

    const months = this.expandMonths(dto.startYm, dto.endYm);
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
        ? this.calcDeadline(ym, dto.deadlineDay)
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

  // ── Documents ──────────────────────────────────────────

  /**
   * 为月次期间新增一条资料记录，并同步回写资料状态。
   *
   * @param periodId - 所属月次期间 ID
   * @param dto - 资料名称、附件与接收状态参数
   * @returns 持久化后的月次资料实体
   * @throws {NotFoundException} 所属月次期间不存在时抛出
   */
  async createDocument(
    periodId: string,
    dto: CreateTaxDocumentDto,
  ): Promise<TaxMonthlyDocument> {
    await this.findOnePeriod(periodId);

    const doc = this.documentRepo.create({
      taxPeriodId: periodId,
      documentName: dto.documentName,
      fileId: dto.fileId ?? null,
      received: dto.received ?? false,
      receivedAt: dto.received ? new Date() : null,
      remark: dto.remark ?? null,
    });

    const saved = await this.documentRepo.save(doc);
    await this.recalcMaterialStatus(periodId);
    this.logger.log(
      `TaxMonthlyDocument "${saved.id}" created for period "${periodId}"`,
    );
    return saved;
  }

  /**
   * 更新月次资料内容，并在接收状态变化后重算期间资料状态。
   *
   * @param docId - 月次资料主键 ID
   * @param dto - 月次资料更新参数
   * @returns 更新后的月次资料实体
   * @throws {NotFoundException} 指定资料不存在时抛出
   */
  async updateDocument(
    docId: string,
    dto: UpdateTaxDocumentDto,
  ): Promise<TaxMonthlyDocument> {
    const doc = await this.documentRepo.findOne({ where: { id: docId } });
    if (!doc) {
      throw new NotFoundException('資料が見つかりません');
    }

    if (dto.documentName !== undefined) doc.documentName = dto.documentName;
    if (dto.fileId !== undefined) doc.fileId = dto.fileId ?? null;
    if (dto.remark !== undefined) doc.remark = dto.remark ?? null;
    if (dto.received !== undefined) {
      const wasReceived = doc.received;
      doc.received = dto.received;
      if (dto.received && !wasReceived) {
        doc.receivedAt = new Date();
      } else if (!dto.received) {
        doc.receivedAt = null;
      }
    }

    const saved = await this.documentRepo.save(doc);
    await this.recalcMaterialStatus(doc.taxPeriodId);
    return saved;
  }

  /**
   * 删除月次资料，并重算所属期间的资料状态。
   *
   * @param docId - 月次资料主键 ID
   * @returns 删除完成后返回空
   * @throws {NotFoundException} 指定资料不存在时抛出
   */
  async removeDocument(docId: string): Promise<void> {
    const doc = await this.documentRepo.findOne({ where: { id: docId } });
    if (!doc) {
      throw new NotFoundException('資料が見つかりません');
    }
    const periodId = doc.taxPeriodId;
    await this.documentRepo.remove(doc);
    await this.recalcMaterialStatus(periodId);
    this.logger.log(`TaxMonthlyDocument "${docId}" removed`);
  }

  // ── Work Items ─────────────────────────────────────────

  /**
   * 为月次期间新增一条作业项记录。
   *
   * @param periodId - 所属月次期间 ID
   * @param dto - 作业项名称、排序与完成状态参数
   * @returns 持久化后的作业项实体
   * @throws {NotFoundException} 所属月次期间不存在时抛出
   */
  async createWorkItem(
    periodId: string,
    dto: CreateTaxWorkItemDto,
  ): Promise<TaxMonthlyWorkItem> {
    await this.findOnePeriod(periodId);

    const item = this.workItemRepo.create({
      taxPeriodId: periodId,
      itemName: dto.itemName,
      completed: dto.completed ?? false,
      completedAt: dto.completed ? new Date() : null,
      remark: dto.remark ?? null,
      sortOrder: dto.sortOrder ?? 0,
    });

    const saved = await this.workItemRepo.save(item);
    this.logger.log(
      `TaxMonthlyWorkItem "${saved.id}" created for period "${periodId}"`,
    );
    return saved;
  }

  /**
   * 更新作业项内容，并在完成状态切换时维护完成时间与责任人。
   *
   * @param itemId - 作业项主键 ID
   * @param dto - 作业项更新参数
   * @param userId - 当前操作人 ID，在勾选完成时记录为责任人，可省略
   * @returns 更新后的作业项实体
   * @throws {NotFoundException} 指定作业项不存在时抛出
   */
  async updateWorkItem(
    itemId: string,
    dto: UpdateTaxWorkItemDto,
    userId?: string,
  ): Promise<TaxMonthlyWorkItem> {
    const item = await this.workItemRepo.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('作業項目が見つかりません');
    }

    if (dto.itemName !== undefined) item.itemName = dto.itemName;
    if (dto.remark !== undefined) item.remark = dto.remark ?? null;
    if (dto.sortOrder !== undefined) item.sortOrder = dto.sortOrder;
    if (dto.completed !== undefined) {
      const wasCompleted = item.completed;
      item.completed = dto.completed;
      if (dto.completed && !wasCompleted) {
        item.completedAt = new Date();
        item.completedBy = userId ?? null;
      } else if (!dto.completed) {
        item.completedAt = null;
        item.completedBy = null;
      }
    }

    const saved = await this.workItemRepo.save(item);
    return saved;
  }

  /**
   * 删除指定作业项记录。
   *
   * @param itemId - 作业项主键 ID
   * @returns 删除完成后返回空
   * @throws {NotFoundException} 指定作业项不存在时抛出
   */
  async removeWorkItem(itemId: string): Promise<void> {
    const item = await this.workItemRepo.findOne({ where: { id: itemId } });
    if (!item) {
      throw new NotFoundException('作業項目が見つかりません');
    }
    await this.workItemRepo.remove(item);
    this.logger.log(`TaxMonthlyWorkItem "${itemId}" removed`);
  }

  // ── Helpers ────────────────────────────────────────────

  /**
   * 根据资料接收情况回写月次期间的资料状态。
   *
   * @param periodId 月次期间 ID
   * @returns 状态回写完成后返回空
   */
  private async recalcMaterialStatus(periodId: string): Promise<void> {
    const docs = await this.documentRepo.find({
      where: { taxPeriodId: periodId },
    });
    const period = await this.periodRepo.findOne({
      where: { id: periodId },
    });
    if (!period) return;

    if (docs.length === 0) {
      period.materialStatus = MaterialStatus.NOT_RECEIVED;
    } else {
      const receivedCount = docs.filter((d) => d.received).length;
      if (receivedCount === 0) {
        period.materialStatus = MaterialStatus.NOT_RECEIVED;
      } else if (receivedCount === docs.length) {
        period.materialStatus = MaterialStatus.COMPLETE;
      } else {
        period.materialStatus = MaterialStatus.PARTIAL;
      }
    }

    await this.periodRepo.save(period);
  }

  /**
   * 将起止年月展开为连续的 `YYYY-MM` 列表。
   *
   * @param startYm 起始年月
   * @param endYm 结束年月
   * @returns 闭区间内的所有年月字符串
   */
  private expandMonths(startYm: string, endYm: string): string[] {
    const [sy, sm] = startYm.split('-').map(Number);
    const [ey, em] = endYm.split('-').map(Number);
    const months: string[] = [];
    let y = sy;
    let m = sm;

    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    return months;
  }

  /**
   * 计算某申报月份对应的次月截止日期，并自动夹紧非法日数。
   *
   * @param periodYm 月次期间，格式为 `YYYY-MM`
   * @param day 截止日的日号
   * @returns 归属到次月的有效截止日期
   */
  private calcDeadline(periodYm: string, day: number): Date {
    const [year, month] = periodYm.split('-').map(Number);
    let deadlineYear = year;
    let deadlineMonth = month + 1;
    if (deadlineMonth > 12) {
      deadlineMonth = 1;
      deadlineYear++;
    }
    const maxDay = new Date(deadlineYear, deadlineMonth, 0).getDate();
    const clampedDay = Math.min(day, maxDay);
    return new Date(deadlineYear, deadlineMonth - 1, clampedDay);
  }

  // ── Response Mappers ───────────────────────────────────

  /**
   * 将税务合同实体映射为列表展示所需的扁平结构。
   *
   * @param tc 税务合同实体
   * @returns 合同列表项 DTO
   */
  private toContractListDto(tc: TaxContract): TaxContractListDto {
    return {
      id: tc.id,
      customerId: tc.customerId,
      customerName: tc.customer?.customerName ?? null,
      contractName: tc.contractName,
      contractStatus: tc.contractStatus,
      billingCycle: tc.billingCycle,
      startDate: tc.startDate,
      endDate: tc.endDate,
      monthlyFee: tc.monthlyFee,
      ownerUserId: tc.ownerUserId,
      ownerName: tc.owner?.displayName ?? null,
      createdBy: tc.createdBy,
      updatedBy: tc.updatedBy,
      createdAt: tc.createdAt,
      updatedAt: tc.updatedAt,
    };
  }

  /**
   * 将月次期间实体映射为列表展示结构，并聚合资料/作业统计值。
   *
   * @param p 月次期间实体
   * @returns 月次期间列表项 DTO
   */
  toPeriodListDto(p: TaxPeriod): TaxPeriodListDto {
    return {
      id: p.id,
      taxContractId: p.taxContractId,
      customerId: p.customerId,
      periodYm: p.periodYm,
      declarationDeadline: p.declarationDeadline,
      monthlyStatus: p.monthlyStatus,
      materialStatus: p.materialStatus,
      documentCount: p.documents?.length ?? 0,
      documentReceivedCount: p.documents?.filter((d) => d.received).length ?? 0,
      workItemCount: p.workItems?.length ?? 0,
      workItemCompletedCount:
        p.workItems?.filter((w) => w.completed).length ?? 0,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  /**
   * 将月次期间实体映射为详情结构，展开资料与作业项明细。
   *
   * @param p 月次期间实体
   * @returns 月次期间详情 DTO
   */
  toPeriodDetailDto(p: TaxPeriod): TaxPeriodDetailDto {
    return {
      id: p.id,
      taxContractId: p.taxContractId,
      customerId: p.customerId,
      periodYm: p.periodYm,
      declarationDeadline: p.declarationDeadline,
      monthlyStatus: p.monthlyStatus,
      materialStatus: p.materialStatus,
      documents: (p.documents ?? []).map((d) => ({
        id: d.id,
        documentName: d.documentName,
        fileId: d.fileId,
        received: d.received,
        receivedAt: d.receivedAt,
        remark: d.remark,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      workItems: (p.workItems ?? []).map((w) => ({
        id: w.id,
        itemName: w.itemName,
        completed: w.completed,
        completedAt: w.completedAt,
        completedBy: w.completedBy,
        completedByName: w.completedByUser?.displayName ?? null,
        remark: w.remark,
        sortOrder: w.sortOrder,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      createdBy: p.createdBy,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
