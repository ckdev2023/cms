import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Brackets } from 'typeorm'
import { TaxContract } from './entities/tax-contract.entity'
import { TaxPeriod } from './entities/tax-period.entity'
import { TaxMonthlyDocument } from './entities/tax-monthly-document.entity'
import { TaxMonthlyWorkItem } from './entities/tax-monthly-work-item.entity'
import { CreateTaxContractDto } from './dto/create-tax-contract.dto'
import { UpdateTaxContractDto } from './dto/update-tax-contract.dto'
import { QueryTaxContractDto } from './dto/query-tax-contract.dto'
import { CreateTaxPeriodDto } from './dto/create-tax-period.dto'
import { UpdateTaxPeriodDto } from './dto/update-tax-period.dto'
import { QueryTaxPeriodDto } from './dto/query-tax-period.dto'
import { GeneratePeriodsDto } from './dto/generate-periods.dto'
import { CreateTaxDocumentDto } from './dto/create-tax-document.dto'
import { UpdateTaxDocumentDto } from './dto/update-tax-document.dto'
import { CreateTaxWorkItemDto } from './dto/create-tax-work-item.dto'
import { UpdateTaxWorkItemDto } from './dto/update-tax-work-item.dto'
import {
  TaxContractStatus,
  MonthlyStatus,
  MaterialStatus,
} from '../../common/constants/enums'

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
}

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name)

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
    })

    const saved = await this.contractRepo.save(contract)
    this.logger.log(
      `TaxContract "${saved.id}" created by user ${userId}`,
    )
    return this.findOne(saved.id)
  }

  async findAll(query: QueryTaxContractDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      sortBy,
      sortOrder = 'DESC',
    } = query

    const qb = this.contractRepo
      .createQueryBuilder('tc')
      .leftJoinAndSelect('tc.customer', 'customer')
      .leftJoinAndSelect('tc.owner', 'owner')

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('tc.contractName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('customer.customerName ILIKE :kw', {
              kw: `%${keyword}%`,
            })
        }),
      )
    }

    if (query.contractStatus) {
      qb.andWhere('tc.contractStatus = :contractStatus', {
        contractStatus: query.contractStatus,
      })
    }

    if (query.billingCycle) {
      qb.andWhere('tc.billingCycle = :billingCycle', {
        billingCycle: query.billingCycle,
      })
    }

    if (query.customerId) {
      qb.andWhere('tc.customerId = :customerId', {
        customerId: query.customerId,
      })
    }

    if (query.ownerUserId) {
      qb.andWhere('tc.ownerUserId = :ownerUserId', {
        ownerUserId: query.ownerUserId,
      })
    }

    if (query.startDateFrom) {
      qb.andWhere('tc.startDate >= :from', { from: query.startDateFrom })
    }

    if (query.startDateTo) {
      qb.andWhere('tc.startDate <= :to', { to: query.startDateTo })
    }

    const allowedSortFields = [
      'contractName',
      'contractStatus',
      'startDate',
      'endDate',
      'monthlyFee',
      'createdAt',
      'updatedAt',
    ]
    const orderField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    qb.orderBy(`tc.${orderField}`, sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((c) => this.toContractListDto(c)),
      total,
      page,
      pageSize,
    }
  }

  async findOne(id: string): Promise<TaxContract> {
    const contract = await this.contractRepo.findOne({
      where: { id },
      relations: ['customer', 'owner', 'periods'],
    })

    if (!contract) {
      throw new NotFoundException('契約が見つかりません')
    }

    return contract
  }

  async update(
    id: string,
    dto: UpdateTaxContractDto,
    userId?: string,
  ): Promise<TaxContract> {
    const contract = await this.findOne(id)

    if (dto.customerId !== undefined) contract.customerId = dto.customerId
    if (dto.contractName !== undefined)
      contract.contractName = dto.contractName
    if (dto.billingCycle !== undefined)
      contract.billingCycle = dto.billingCycle
    if (dto.startDate !== undefined)
      contract.startDate = new Date(dto.startDate)
    if (dto.endDate !== undefined)
      contract.endDate = dto.endDate ? new Date(dto.endDate) : null
    if (dto.monthlyFee !== undefined) contract.monthlyFee = dto.monthlyFee
    if (dto.ownerUserId !== undefined)
      contract.ownerUserId = dto.ownerUserId ?? null
    contract.updatedBy = userId ?? null

    await this.contractRepo.save(contract)
    this.logger.log(`TaxContract "${id}" updated by user ${userId}`)
    return this.findOne(id)
  }

  async updateStatus(
    id: string,
    newStatus: TaxContractStatus,
    userId?: string,
  ): Promise<TaxContract> {
    const contract = await this.findOne(id)
    const allowed = STATUS_TRANSITIONS[contract.contractStatus]

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `ステータスを「${contract.contractStatus}」から「${newStatus}」に変更できません`,
      )
    }

    contract.contractStatus = newStatus
    contract.updatedBy = userId ?? null
    await this.contractRepo.save(contract)

    this.logger.log(
      `TaxContract "${id}" status changed to ${newStatus} by user ${userId}`,
    )
    return this.findOne(id)
  }

  async remove(id: string): Promise<void> {
    const contract = await this.findOne(id)
    await this.contractRepo.softRemove(contract)
    this.logger.log(`TaxContract "${id}" soft-deleted`)
  }

  async restore(id: string) {
    const contract = await this.contractRepo.findOne({
      where: { id },
      withDeleted: true,
    })
    if (!contract) throw new NotFoundException('契約が見つかりません')
    if (!contract.deletedAt) throw new BadRequestException('この契約は削除されていません')
    await this.contractRepo.recover(contract)
    this.logger.log(`TaxContract "${id}" restored`)
    return this.findOne(id)
  }

  getAvailableTransitions(
    status: TaxContractStatus,
  ): TaxContractStatus[] {
    return STATUS_TRANSITIONS[status] ?? []
  }

  async findByCustomer(
    customerId: string,
    query: QueryTaxContractDto,
  ) {
    return this.findAll({ ...query, customerId })
  }

  // ── Periods ────────────────────────────────────────────

  async createPeriod(
    contractId: string,
    dto: CreateTaxPeriodDto,
    userId?: string,
  ): Promise<TaxPeriod> {
    const contract = await this.findOne(contractId)

    const existing = await this.periodRepo.findOne({
      where: { taxContractId: contractId, periodYm: dto.periodYm },
    })
    if (existing) {
      throw new ConflictException(
        `期間「${dto.periodYm}」は既に登録されています`,
      )
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
    })

    const saved = await this.periodRepo.save(period)
    this.logger.log(
      `TaxPeriod "${saved.id}" (${dto.periodYm}) created for contract "${contractId}"`,
    )
    return this.findOnePeriod(saved.id)
  }

  async findPeriods(contractId: string, query: QueryTaxPeriodDto) {
    const {
      page = 1,
      pageSize = 20,
      sortBy,
      sortOrder = 'ASC',
    } = query

    const qb = this.periodRepo
      .createQueryBuilder('tp')
      .leftJoinAndSelect('tp.documents', 'doc')
      .leftJoinAndSelect('tp.workItems', 'wi')
      .where('tp.taxContractId = :contractId', { contractId })

    if (query.monthlyStatus) {
      qb.andWhere('tp.monthlyStatus = :monthlyStatus', {
        monthlyStatus: query.monthlyStatus,
      })
    }

    if (query.materialStatus) {
      qb.andWhere('tp.materialStatus = :materialStatus', {
        materialStatus: query.materialStatus,
      })
    }

    if (query.periodYmFrom) {
      qb.andWhere('tp.periodYm >= :periodYmFrom', {
        periodYmFrom: query.periodYmFrom,
      })
    }

    if (query.periodYmTo) {
      qb.andWhere('tp.periodYm <= :periodYmTo', {
        periodYmTo: query.periodYmTo,
      })
    }

    if (query.deadlineFrom) {
      qb.andWhere('tp.declarationDeadline >= :deadlineFrom', {
        deadlineFrom: query.deadlineFrom,
      })
    }

    if (query.deadlineTo) {
      qb.andWhere('tp.declarationDeadline <= :deadlineTo', {
        deadlineTo: query.deadlineTo,
      })
    }

    const allowedSortFields = [
      'periodYm',
      'declarationDeadline',
      'monthlyStatus',
      'materialStatus',
      'createdAt',
    ]
    const orderField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'periodYm'
    qb.orderBy(`tp.${orderField}`, sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((p) => this.toPeriodListDto(p)),
      total,
      page,
      pageSize,
    }
  }

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
    })

    if (!period) {
      throw new NotFoundException('月次期間が見つかりません')
    }

    return period
  }

  async updatePeriod(
    periodId: string,
    dto: UpdateTaxPeriodDto,
    userId?: string,
  ): Promise<TaxPeriod> {
    const period = await this.findOnePeriod(periodId)

    if (dto.periodYm !== undefined) {
      const existing = await this.periodRepo.findOne({
        where: {
          taxContractId: period.taxContractId,
          periodYm: dto.periodYm,
        },
      })
      if (existing && existing.id !== periodId) {
        throw new ConflictException(
          `期間「${dto.periodYm}」は既に登録されています`,
        )
      }
      period.periodYm = dto.periodYm
    }
    if (dto.declarationDeadline !== undefined) {
      period.declarationDeadline = dto.declarationDeadline
        ? new Date(dto.declarationDeadline)
        : null
    }
    if (dto.monthlyStatus !== undefined) {
      period.monthlyStatus = dto.monthlyStatus
    }
    if (dto.materialStatus !== undefined) {
      period.materialStatus = dto.materialStatus
    }

    await this.periodRepo.save(period)
    this.logger.log(`TaxPeriod "${periodId}" updated by user ${userId}`)
    return this.findOnePeriod(periodId)
  }

  async updatePeriodStatus(
    periodId: string,
    monthlyStatus: MonthlyStatus,
    userId?: string,
  ): Promise<TaxPeriod> {
    const period = await this.findOnePeriod(periodId)
    period.monthlyStatus = monthlyStatus
    await this.periodRepo.save(period)
    this.logger.log(
      `TaxPeriod "${periodId}" status changed to ${monthlyStatus} by user ${userId}`,
    )
    return this.findOnePeriod(periodId)
  }

  async removePeriod(periodId: string): Promise<void> {
    const period = await this.findOnePeriod(periodId)
    await this.documentRepo.delete({ taxPeriodId: periodId })
    await this.workItemRepo.delete({ taxPeriodId: periodId })
    await this.periodRepo.softRemove(period)
    this.logger.log(`TaxPeriod "${periodId}" soft-deleted with children`)
  }

  async generatePeriods(
    contractId: string,
    dto: GeneratePeriodsDto,
    userId?: string,
  ): Promise<TaxPeriod[]> {
    const contract = await this.findOne(contractId)

    if (dto.startYm > dto.endYm) {
      throw new BadRequestException(
        '開始期間は終了期間より前に設定してください',
      )
    }

    const months = this.expandMonths(dto.startYm, dto.endYm)
    if (months.length > 36) {
      throw new BadRequestException(
        '一括生成は最大36か月までです',
      )
    }

    const existingPeriods = await this.periodRepo.find({
      where: { taxContractId: contractId },
      select: ['periodYm'],
    })
    const existingSet = new Set(existingPeriods.map((p) => p.periodYm))

    const newPeriods: TaxPeriod[] = []
    for (const ym of months) {
      if (existingSet.has(ym)) continue

      const deadline = dto.deadlineDay
        ? this.calcDeadline(ym, dto.deadlineDay)
        : null

      const period = this.periodRepo.create({
        taxContractId: contractId,
        customerId: contract.customerId,
        periodYm: ym,
        declarationDeadline: deadline,
        monthlyStatus: MonthlyStatus.NOT_STARTED,
        materialStatus: MaterialStatus.NOT_RECEIVED,
        createdBy: userId ?? null,
      })
      newPeriods.push(period)
    }

    if (newPeriods.length === 0) {
      return []
    }

    const saved = await this.periodRepo.save(newPeriods)
    this.logger.log(
      `Generated ${saved.length} periods for contract "${contractId}" (${dto.startYm}~${dto.endYm})`,
    )
    return saved
  }

  // ── Documents ──────────────────────────────────────────

  async createDocument(
    periodId: string,
    dto: CreateTaxDocumentDto,
  ): Promise<TaxMonthlyDocument> {
    await this.findOnePeriod(periodId)

    const doc = this.documentRepo.create({
      taxPeriodId: periodId,
      documentName: dto.documentName,
      fileId: dto.fileId ?? null,
      received: dto.received ?? false,
      receivedAt: dto.received ? new Date() : null,
      remark: dto.remark ?? null,
    })

    const saved = await this.documentRepo.save(doc)
    await this.recalcMaterialStatus(periodId)
    this.logger.log(
      `TaxMonthlyDocument "${saved.id}" created for period "${periodId}"`,
    )
    return saved
  }

  async updateDocument(
    docId: string,
    dto: UpdateTaxDocumentDto,
  ): Promise<TaxMonthlyDocument> {
    const doc = await this.documentRepo.findOne({ where: { id: docId } })
    if (!doc) {
      throw new NotFoundException('資料が見つかりません')
    }

    if (dto.documentName !== undefined) doc.documentName = dto.documentName
    if (dto.fileId !== undefined) doc.fileId = dto.fileId ?? null
    if (dto.remark !== undefined) doc.remark = dto.remark ?? null
    if (dto.received !== undefined) {
      const wasReceived = doc.received
      doc.received = dto.received
      if (dto.received && !wasReceived) {
        doc.receivedAt = new Date()
      } else if (!dto.received) {
        doc.receivedAt = null
      }
    }

    const saved = await this.documentRepo.save(doc)
    await this.recalcMaterialStatus(doc.taxPeriodId)
    return saved
  }

  async removeDocument(docId: string): Promise<void> {
    const doc = await this.documentRepo.findOne({ where: { id: docId } })
    if (!doc) {
      throw new NotFoundException('資料が見つかりません')
    }
    const periodId = doc.taxPeriodId
    await this.documentRepo.remove(doc)
    await this.recalcMaterialStatus(periodId)
    this.logger.log(`TaxMonthlyDocument "${docId}" removed`)
  }

  // ── Work Items ─────────────────────────────────────────

  async createWorkItem(
    periodId: string,
    dto: CreateTaxWorkItemDto,
  ): Promise<TaxMonthlyWorkItem> {
    await this.findOnePeriod(periodId)

    const item = this.workItemRepo.create({
      taxPeriodId: periodId,
      itemName: dto.itemName,
      completed: dto.completed ?? false,
      completedAt: dto.completed ? new Date() : null,
      remark: dto.remark ?? null,
      sortOrder: dto.sortOrder ?? 0,
    })

    const saved = await this.workItemRepo.save(item)
    this.logger.log(
      `TaxMonthlyWorkItem "${saved.id}" created for period "${periodId}"`,
    )
    return saved
  }

  async updateWorkItem(
    itemId: string,
    dto: UpdateTaxWorkItemDto,
    userId?: string,
  ): Promise<TaxMonthlyWorkItem> {
    const item = await this.workItemRepo.findOne({ where: { id: itemId } })
    if (!item) {
      throw new NotFoundException('作業項目が見つかりません')
    }

    if (dto.itemName !== undefined) item.itemName = dto.itemName
    if (dto.remark !== undefined) item.remark = dto.remark ?? null
    if (dto.sortOrder !== undefined) item.sortOrder = dto.sortOrder
    if (dto.completed !== undefined) {
      const wasCompleted = item.completed
      item.completed = dto.completed
      if (dto.completed && !wasCompleted) {
        item.completedAt = new Date()
        item.completedBy = userId ?? null
      } else if (!dto.completed) {
        item.completedAt = null
        item.completedBy = null
      }
    }

    const saved = await this.workItemRepo.save(item)
    return saved
  }

  async removeWorkItem(itemId: string): Promise<void> {
    const item = await this.workItemRepo.findOne({ where: { id: itemId } })
    if (!item) {
      throw new NotFoundException('作業項目が見つかりません')
    }
    await this.workItemRepo.remove(item)
    this.logger.log(`TaxMonthlyWorkItem "${itemId}" removed`)
  }

  // ── Helpers ────────────────────────────────────────────

  private async recalcMaterialStatus(periodId: string): Promise<void> {
    const docs = await this.documentRepo.find({
      where: { taxPeriodId: periodId },
    })
    const period = await this.periodRepo.findOne({
      where: { id: periodId },
    })
    if (!period) return

    if (docs.length === 0) {
      period.materialStatus = MaterialStatus.NOT_RECEIVED
    } else {
      const receivedCount = docs.filter((d) => d.received).length
      if (receivedCount === 0) {
        period.materialStatus = MaterialStatus.NOT_RECEIVED
      } else if (receivedCount === docs.length) {
        period.materialStatus = MaterialStatus.COMPLETE
      } else {
        period.materialStatus = MaterialStatus.PARTIAL
      }
    }

    await this.periodRepo.save(period)
  }

  private expandMonths(startYm: string, endYm: string): string[] {
    const [sy, sm] = startYm.split('-').map(Number)
    const [ey, em] = endYm.split('-').map(Number)
    const months: string[] = []
    let y = sy
    let m = sm

    while (y < ey || (y === ey && m <= em)) {
      months.push(`${y}-${String(m).padStart(2, '0')}`)
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }

    return months
  }

  private calcDeadline(periodYm: string, day: number): Date {
    const [year, month] = periodYm.split('-').map(Number)
    let deadlineYear = year
    let deadlineMonth = month + 1
    if (deadlineMonth > 12) {
      deadlineMonth = 1
      deadlineYear++
    }
    const maxDay = new Date(deadlineYear, deadlineMonth, 0).getDate()
    const clampedDay = Math.min(day, maxDay)
    return new Date(deadlineYear, deadlineMonth - 1, clampedDay)
  }

  // ── Response Mappers ───────────────────────────────────

  private toContractListDto(tc: TaxContract) {
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
    }
  }

  toPeriodListDto(p: TaxPeriod) {
    return {
      id: p.id,
      taxContractId: p.taxContractId,
      customerId: p.customerId,
      periodYm: p.periodYm,
      declarationDeadline: p.declarationDeadline,
      monthlyStatus: p.monthlyStatus,
      materialStatus: p.materialStatus,
      documentCount: p.documents?.length ?? 0,
      documentReceivedCount:
        p.documents?.filter((d) => d.received).length ?? 0,
      workItemCount: p.workItems?.length ?? 0,
      workItemCompletedCount:
        p.workItems?.filter((w) => w.completed).length ?? 0,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }
  }

  toPeriodDetailDto(p: TaxPeriod) {
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
    }
  }
}
