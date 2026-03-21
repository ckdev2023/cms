import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Brackets, DataSource } from 'typeorm'
import { Invoice } from './entities/invoice.entity'
import { InvoiceItem } from './entities/invoice-item.entity'
import { CreateInvoiceDto } from './dto/create-invoice.dto'
import { UpdateInvoiceDto } from './dto/update-invoice.dto'
import { QueryInvoiceDto } from './dto/query-invoice.dto'
import { VoidInvoiceDto } from './dto/void-invoice.dto'
import { InvoiceStatus } from '../../common/constants/enums'

const STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.VOID],
  [InvoiceStatus.SENT]: [InvoiceStatus.PARTIAL, InvoiceStatus.PAID, InvoiceStatus.VOID],
  [InvoiceStatus.PARTIAL]: [InvoiceStatus.PAID, InvoiceStatus.VOID],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.VOID]: [],
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name)

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateInvoiceDto, userId?: string): Promise<Invoice> {
    const invoiceNo = await this.generateInvoiceNo()

    const items = dto.items.map((it) => {
      const quantity = it.quantity ?? 1
      const amount = Math.round(quantity * it.unitPrice * 100) / 100
      return this.itemRepo.create({
        description: it.description,
        quantity,
        unitPrice: it.unitPrice,
        amount,
        sortOrder: it.sortOrder ?? 0,
      })
    })

    const totalAmount = items.reduce((sum, it) => sum + Number(it.amount), 0)

    const invoice = this.invoiceRepo.create({
      customerId: dto.customerId,
      invoiceNo,
      invoiceType: dto.invoiceType,
      totalAmount: Math.round(totalAmount * 100) / 100,
      status: InvoiceStatus.DRAFT,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      relatedId: dto.relatedId ?? null,
      relatedType: dto.relatedType ?? null,
      remark: dto.remark ?? null,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
      items,
    })

    const saved = await this.invoiceRepo.save(invoice)
    this.logger.log(`Invoice "${saved.invoiceNo}" created by user ${userId}`)
    return this.findOne(saved.id)
  }

  async findAll(query: QueryInvoiceDto) {
    const { page = 1, pageSize = 20, keyword, sortBy, sortOrder = 'DESC' } = query

    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.customer', 'customer')
      .loadRelationCountAndMap('inv.itemCount', 'inv.items')

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('inv.invoiceNo ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('customer.customerName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('inv.remark ILIKE :kw', { kw: `%${keyword}%` })
        }),
      )
    }

    if (query.status) {
      qb.andWhere('inv.status = :status', { status: query.status })
    }

    if (query.invoiceType) {
      qb.andWhere('inv.invoiceType = :invoiceType', { invoiceType: query.invoiceType })
    }

    if (query.customerId) {
      qb.andWhere('inv.customerId = :customerId', { customerId: query.customerId })
    }

    if (query.dueDateFrom) {
      qb.andWhere('inv.dueDate >= :dueDateFrom', { dueDateFrom: query.dueDateFrom })
    }

    if (query.dueDateTo) {
      qb.andWhere('inv.dueDate <= :dueDateTo', { dueDateTo: query.dueDateTo })
    }

    if (query.createdFrom) {
      qb.andWhere('inv.createdAt >= :createdFrom', { createdFrom: query.createdFrom })
    }

    if (query.createdTo) {
      qb.andWhere('inv.createdAt <= :createdTo', { createdTo: query.createdTo })
    }

    const allowedSortFields = [
      'invoiceNo',
      'totalAmount',
      'status',
      'dueDate',
      'createdAt',
      'updatedAt',
    ]
    const orderField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    qb.orderBy(`inv.${orderField}`, sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((inv) => this.toListDto(inv)),
      total,
      page,
      pageSize,
    }
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['customer', 'items'],
      order: { items: { sortOrder: 'ASC', createdAt: 'ASC' } },
    })

    if (!invoice) {
      throw new NotFoundException('請求書が見つかりません')
    }

    return invoice
  }

  async update(id: string, dto: UpdateInvoiceDto, userId?: string): Promise<Invoice> {
    const invoice = await this.findOne(id)

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('下書き状態の請求書のみ編集できます')
    }

    if (dto.invoiceType !== undefined) invoice.invoiceType = dto.invoiceType
    if (dto.dueDate !== undefined) invoice.dueDate = dto.dueDate ? new Date(dto.dueDate) : null
    if (dto.relatedId !== undefined) invoice.relatedId = dto.relatedId ?? null
    if (dto.relatedType !== undefined) invoice.relatedType = dto.relatedType ?? null
    if (dto.remark !== undefined) invoice.remark = dto.remark ?? null
    invoice.updatedBy = userId ?? null

    if (dto.items !== undefined) {
      await this.itemRepo.delete({ invoiceId: id })

      const newItems = dto.items.map((it) => {
        const quantity = it.quantity ?? 1
        const amount = Math.round(quantity * it.unitPrice * 100) / 100
        return this.itemRepo.create({
          invoiceId: id,
          description: it.description,
          quantity,
          unitPrice: it.unitPrice,
          amount,
          sortOrder: it.sortOrder ?? 0,
        })
      })

      await this.itemRepo.save(newItems)
      invoice.totalAmount =
        Math.round(newItems.reduce((s, it) => s + Number(it.amount), 0) * 100) / 100
    }

    await this.invoiceRepo.save(invoice)
    this.logger.log(`Invoice "${invoice.invoiceNo}" updated by user ${userId}`)
    return this.findOne(id)
  }

  async updateStatus(
    id: string,
    newStatus: InvoiceStatus,
    userId?: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id)
    const allowed = STATUS_TRANSITIONS[invoice.status]

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `ステータスを「${invoice.status}」から「${newStatus}」に変更できません`,
      )
    }

    if (newStatus === InvoiceStatus.SENT) {
      invoice.issuedAt = new Date()
    }

    invoice.status = newStatus
    invoice.updatedBy = userId ?? null
    await this.invoiceRepo.save(invoice)

    this.logger.log(
      `Invoice "${invoice.invoiceNo}" status → ${newStatus} by user ${userId}`,
    )
    return this.findOne(id)
  }

  async voidInvoice(
    id: string,
    dto: VoidInvoiceDto,
    userId?: string,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['paymentAllocations'],
    })

    if (!invoice) {
      throw new NotFoundException('請求書が見つかりません')
    }

    const allowed = STATUS_TRANSITIONS[invoice.status]
    if (!allowed.includes(InvoiceStatus.VOID)) {
      throw new BadRequestException(
        `ステータス「${invoice.status}」の請求書は無効化できません`,
      )
    }

    if (
      invoice.paymentAllocations?.length > 0 &&
      invoice.status === InvoiceStatus.PARTIAL
    ) {
      throw new BadRequestException(
        '入金済みの請求書を無効化するには、先に入金を取り消してください',
      )
    }

    invoice.status = InvoiceStatus.VOID
    invoice.voidReason = dto.voidReason
    invoice.voidedAt = new Date()
    invoice.voidedBy = userId ?? null
    invoice.updatedBy = userId ?? null
    await this.invoiceRepo.save(invoice)

    this.logger.log(`Invoice "${invoice.invoiceNo}" voided by user ${userId}`)
    return this.findOne(id)
  }

  async remove(id: string): Promise<void> {
    const invoice = await this.findOne(id)

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('下書き状態の請求書のみ削除できます')
    }

    await this.invoiceRepo.softRemove(invoice)
    this.logger.log(`Invoice "${invoice.invoiceNo}" soft-deleted`)
  }

  async restore(id: string) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      withDeleted: true,
    })
    if (!invoice) throw new NotFoundException('請求書が見つかりません')
    if (!invoice.deletedAt) throw new BadRequestException('この請求書は削除されていません')
    await this.invoiceRepo.recover(invoice)
    this.logger.log(`Invoice "${invoice.invoiceNo}" restored`)
    return this.findOne(id)
  }

  getAvailableTransitions(status: InvoiceStatus): InvoiceStatus[] {
    return STATUS_TRANSITIONS[status] ?? []
  }

  async findByCustomer(customerId: string, query: QueryInvoiceDto) {
    return this.findAll({ ...query, customerId })
  }

  async getSummary(customerId?: string) {
    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .select('inv.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(inv.totalAmount), 0)', 'totalAmount')
      .groupBy('inv.status')

    if (customerId) {
      qb.where('inv.customerId = :customerId', { customerId })
    }

    return qb.getRawMany()
  }

  private async generateInvoiceNo(): Promise<string> {
    const today = new Date()
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0')

    const prefix = `INV-${dateStr}-`

    const latest = await this.invoiceRepo
      .createQueryBuilder('inv')
      .where('inv.invoiceNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('inv.invoiceNo', 'DESC')
      .getOne()

    let seq = 1
    if (latest) {
      const lastSeq = parseInt(latest.invoiceNo.replace(prefix, ''), 10)
      if (!isNaN(lastSeq)) seq = lastSeq + 1
    }

    return `${prefix}${seq.toString().padStart(5, '0')}`
  }

  private toListDto(inv: Invoice & { itemCount?: number }) {
    return {
      id: inv.id,
      customerId: inv.customerId,
      customerName: inv.customer?.customerName ?? null,
      invoiceNo: inv.invoiceNo,
      invoiceType: inv.invoiceType,
      totalAmount: inv.totalAmount,
      currency: inv.currency,
      status: inv.status,
      dueDate: inv.dueDate,
      issuedAt: inv.issuedAt,
      itemCount: inv.itemCount ?? 0,
      createdBy: inv.createdBy,
      updatedBy: inv.updatedBy,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    }
  }
}
