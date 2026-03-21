import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Brackets, DataSource } from 'typeorm'
import { Payment } from './entities/payment.entity'
import { PaymentAllocation } from './entities/payment-allocation.entity'
import { Invoice } from './entities/invoice.entity'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { QueryPaymentDto } from './dto/query-payment.dto'
import { ReversePaymentDto } from './dto/reverse-payment.dto'
import { PaymentStatus, InvoiceStatus } from '../../common/constants/enums'

const ALLOCATABLE_INVOICE_STATUSES = [InvoiceStatus.SENT, InvoiceStatus.PARTIAL]

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name)

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentAllocation)
    private readonly allocationRepo: Repository<PaymentAllocation>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreatePaymentDto, userId?: string): Promise<Payment> {
    const allocationTotal = dto.allocations.reduce(
      (sum, a) => sum + Number(a.allocatedAmount),
      0,
    )
    const allocationTotalRounded = Math.round(allocationTotal * 100) / 100
    const paymentAmountRounded = Math.round(dto.paymentAmount * 100) / 100

    if (allocationTotalRounded !== paymentAmountRounded) {
      throw new BadRequestException(
        `充当金額の合計（${allocationTotalRounded}）が入金金額（${paymentAmountRounded}）と一致しません`,
      )
    }

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const invoiceIds = dto.allocations.map((a) => a.invoiceId)
      const invoices = await queryRunner.manager.find(Invoice, {
        where: invoiceIds.map((id) => ({ id })),
        relations: ['paymentAllocations'],
        lock: { mode: 'pessimistic_write' },
      })

      const invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]))

      for (const alloc of dto.allocations) {
        const invoice = invoiceMap.get(alloc.invoiceId)
        if (!invoice) {
          throw new BadRequestException(
            `請求書（ID: ${alloc.invoiceId}）が見つかりません`,
          )
        }
        if (invoice.customerId !== dto.customerId) {
          throw new BadRequestException(
            `請求書「${invoice.invoiceNo}」は指定顧客に属していません`,
          )
        }
        if (!ALLOCATABLE_INVOICE_STATUSES.includes(invoice.status)) {
          throw new BadRequestException(
            `請求書「${invoice.invoiceNo}」のステータス（${invoice.status}）には充当できません`,
          )
        }

        const existingAllocated = (invoice.paymentAllocations ?? []).reduce(
          (sum, pa) => sum + Number(pa.allocatedAmount),
          0,
        )
        const remaining =
          Math.round((Number(invoice.totalAmount) - existingAllocated) * 100) / 100
        const allocAmount = Math.round(Number(alloc.allocatedAmount) * 100) / 100

        if (allocAmount > remaining) {
          throw new BadRequestException(
            `請求書「${invoice.invoiceNo}」の残額（${remaining}）を超える充当（${allocAmount}）はできません`,
          )
        }
      }

      const paymentNo = await this.generatePaymentNo(queryRunner.manager)

      const payment = queryRunner.manager.create(Payment, {
        customerId: dto.customerId,
        paymentNo,
        paymentDate: new Date(dto.paymentDate),
        paymentAmount: paymentAmountRounded,
        paymentMethod: dto.paymentMethod,
        status: PaymentStatus.REGISTERED,
        remark: dto.remark ?? null,
        createdBy: userId ?? null,
      })

      const savedPayment = await queryRunner.manager.save(Payment, payment)

      const allocations = dto.allocations.map((a) =>
        queryRunner.manager.create(PaymentAllocation, {
          paymentId: savedPayment.id,
          invoiceId: a.invoiceId,
          allocatedAmount: Math.round(Number(a.allocatedAmount) * 100) / 100,
          createdBy: userId ?? null,
        }),
      )

      await queryRunner.manager.save(PaymentAllocation, allocations)

      for (const alloc of dto.allocations) {
        await this.recalcInvoiceStatus(alloc.invoiceId, queryRunner.manager)
      }

      await queryRunner.commitTransaction()

      this.logger.log(
        `Payment "${savedPayment.paymentNo}" created by user ${userId}`,
      )
      return this.findOne(savedPayment.id)
    } catch (err) {
      await queryRunner.rollbackTransaction()
      throw err
    } finally {
      await queryRunner.release()
    }
  }

  async findAll(query: QueryPaymentDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      sortBy,
      sortOrder = 'DESC',
    } = query

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.customer', 'customer')
      .loadRelationCountAndMap('p.allocationCount', 'p.allocations')

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('p.paymentNo ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('customer.customerName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('p.remark ILIKE :kw', { kw: `%${keyword}%` })
        }),
      )
    }

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status })
    }

    if (query.paymentMethod) {
      qb.andWhere('p.paymentMethod = :paymentMethod', {
        paymentMethod: query.paymentMethod,
      })
    }

    if (query.customerId) {
      qb.andWhere('p.customerId = :customerId', { customerId: query.customerId })
    }

    if (query.invoiceId) {
      qb.innerJoin('p.allocations', 'alloc')
        .andWhere('alloc.invoiceId = :invoiceId', {
          invoiceId: query.invoiceId,
        })
    }

    if (query.paymentDateFrom) {
      qb.andWhere('p.paymentDate >= :paymentDateFrom', {
        paymentDateFrom: query.paymentDateFrom,
      })
    }

    if (query.paymentDateTo) {
      qb.andWhere('p.paymentDate <= :paymentDateTo', {
        paymentDateTo: query.paymentDateTo,
      })
    }

    if (query.createdFrom) {
      qb.andWhere('p.createdAt >= :createdFrom', {
        createdFrom: query.createdFrom,
      })
    }

    if (query.createdTo) {
      qb.andWhere('p.createdAt <= :createdTo', {
        createdTo: query.createdTo,
      })
    }

    const allowedSortFields = [
      'paymentNo',
      'paymentAmount',
      'paymentDate',
      'status',
      'createdAt',
    ]
    const orderField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    qb.orderBy(`p.${orderField}`, sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((p) => this.toListDto(p)),
      total,
      page,
      pageSize,
    }
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: [
        'customer',
        'allocations',
        'allocations.invoice',
      ],
      order: { allocations: { createdAt: 'ASC' } },
    })

    if (!payment) {
      throw new NotFoundException('入金記録が見つかりません')
    }

    return payment
  }

  async reverse(
    id: string,
    dto: ReversePaymentDto,
    userId?: string,
  ): Promise<Payment> {
    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const payment = await queryRunner.manager.findOne(Payment, {
        where: { id },
        relations: ['allocations'],
        lock: { mode: 'pessimistic_write' },
      })

      if (!payment) {
        throw new NotFoundException('入金記録が見つかりません')
      }

      if (payment.status === PaymentStatus.REVERSED) {
        throw new BadRequestException('この入金は既に取り消し済みです')
      }

      const affectedInvoiceIds = payment.allocations.map((a) => a.invoiceId)

      await queryRunner.manager.remove(PaymentAllocation, payment.allocations)

      payment.status = PaymentStatus.REVERSED
      payment.reversalReason = dto.reversalReason
      payment.reversedAt = new Date()
      payment.reversedBy = userId ?? null
      await queryRunner.manager.save(Payment, payment)

      for (const invoiceId of affectedInvoiceIds) {
        await this.recalcInvoiceStatus(invoiceId, queryRunner.manager)
      }

      await queryRunner.commitTransaction()

      this.logger.log(
        `Payment "${payment.paymentNo}" reversed by user ${userId}`,
      )
      return this.findOne(id)
    } catch (err) {
      await queryRunner.rollbackTransaction()
      throw err
    } finally {
      await queryRunner.release()
    }
  }

  async findByInvoice(invoiceId: string) {
    const allocations = await this.allocationRepo.find({
      where: { invoiceId },
      relations: ['payment', 'payment.customer'],
      order: { createdAt: 'ASC' },
    })

    return allocations.map((a) => ({
      id: a.id,
      paymentId: a.paymentId,
      paymentNo: a.payment?.paymentNo ?? null,
      paymentDate: a.payment?.paymentDate ?? null,
      paymentMethod: a.payment?.paymentMethod ?? null,
      paymentStatus: a.payment?.status ?? null,
      allocatedAmount: a.allocatedAmount,
      createdAt: a.createdAt,
    }))
  }

  async findByCustomer(customerId: string, query: QueryPaymentDto) {
    return this.findAll({ ...query, customerId })
  }

  async getSummary(customerId?: string) {
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(p.paymentAmount), 0)', 'totalAmount')
      .groupBy('p.status')

    if (customerId) {
      qb.where('p.customerId = :customerId', { customerId })
    }

    return qb.getRawMany()
  }

  private async recalcInvoiceStatus(
    invoiceId: string,
    manager: any,
  ): Promise<void> {
    const invoice = await manager.findOne(Invoice, {
      where: { id: invoiceId },
      relations: ['paymentAllocations'],
    })

    if (!invoice) return

    if (
      invoice.status === InvoiceStatus.VOID ||
      invoice.status === InvoiceStatus.DRAFT
    ) {
      return
    }

    const totalAllocated = (invoice.paymentAllocations ?? []).reduce(
      (sum: number, pa: PaymentAllocation) => sum + Number(pa.allocatedAmount),
      0,
    )
    const totalAllocatedRounded = Math.round(totalAllocated * 100) / 100
    const invoiceTotal = Math.round(Number(invoice.totalAmount) * 100) / 100

    let newStatus: InvoiceStatus
    if (totalAllocatedRounded >= invoiceTotal) {
      newStatus = InvoiceStatus.PAID
    } else if (totalAllocatedRounded > 0) {
      newStatus = InvoiceStatus.PARTIAL
    } else {
      newStatus = InvoiceStatus.SENT
    }

    if (invoice.status !== newStatus) {
      invoice.status = newStatus
      await manager.save(Invoice, invoice)
      this.logger.log(
        `Invoice "${invoice.invoiceNo}" status recalculated → ${newStatus}`,
      )
    }
  }

  private async generatePaymentNo(manager?: any): Promise<string> {
    const repo = manager
      ? manager.getRepository(Payment)
      : this.paymentRepo

    const today = new Date()
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0')

    const prefix = `PAY-${dateStr}-`

    const latest = await repo
      .createQueryBuilder('p')
      .where('p.paymentNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('p.paymentNo', 'DESC')
      .getOne()

    let seq = 1
    if (latest) {
      const lastSeq = parseInt(latest.paymentNo.replace(prefix, ''), 10)
      if (!isNaN(lastSeq)) seq = lastSeq + 1
    }

    return `${prefix}${seq.toString().padStart(5, '0')}`
  }

  private toListDto(p: Payment & { allocationCount?: number }) {
    return {
      id: p.id,
      customerId: p.customerId,
      customerName: p.customer?.customerName ?? null,
      paymentNo: p.paymentNo,
      paymentDate: p.paymentDate,
      paymentAmount: p.paymentAmount,
      paymentMethod: p.paymentMethod,
      status: p.status,
      remark: p.remark,
      allocationCount: p.allocationCount ?? 0,
      createdBy: p.createdBy,
      reversedAt: p.reversedAt,
      reversalReason: p.reversalReason,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }
  }
}
