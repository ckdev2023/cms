import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Brackets, DataSource, EntityManager } from 'typeorm'
import { DepositAccount } from './entities/deposit-account.entity'
import { DepositTransaction } from './entities/deposit-transaction.entity'
import { Invoice } from './entities/invoice.entity'
import { PaymentAllocation } from './entities/payment-allocation.entity'
import { CreateDepositRechargeDto } from './dto/create-deposit-recharge.dto'
import { CreateDepositOffsetDto } from './dto/create-deposit-offset.dto'
import { CreateDepositRefundDto } from './dto/create-deposit-refund.dto'
import { CreateDepositAdjustmentDto } from './dto/create-deposit-adjustment.dto'
import { QueryDepositAccountDto } from './dto/query-deposit-account.dto'
import { QueryDepositTransactionDto } from './dto/query-deposit-transaction.dto'
import {
  DepositTransactionType,
  InvoiceStatus,
} from '../../common/constants/enums'

const OFFSETABLE_INVOICE_STATUSES = [InvoiceStatus.SENT, InvoiceStatus.PARTIAL]

@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name)

  constructor(
    @InjectRepository(DepositAccount)
    private readonly accountRepo: Repository<DepositAccount>,
    @InjectRepository(DepositTransaction)
    private readonly txnRepo: Repository<DepositTransaction>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(PaymentAllocation)
    private readonly paymentAllocRepo: Repository<PaymentAllocation>,
    private readonly dataSource: DataSource,
  ) {}

  /* ──────── Account Queries ──────── */

  async findAllAccounts(query: QueryDepositAccountDto) {
    const { page = 1, pageSize = 20, keyword, sortBy, sortOrder = 'DESC' } = query

    const qb = this.accountRepo
      .createQueryBuilder('da')
      .leftJoinAndSelect('da.customer', 'customer')
      .loadRelationCountAndMap('da.transactionCount', 'da.transactions')

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('customer.customerName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('customer.customerCode ILIKE :kw', { kw: `%${keyword}%` })
        }),
      )
    }

    if (query.customerId) {
      qb.andWhere('da.customerId = :customerId', { customerId: query.customerId })
    }

    if (query.hasBalance) {
      qb.andWhere('da.balance > 0')
    }

    const allowedSortFields = ['balance', 'createdAt', 'updatedAt']
    const orderField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'updatedAt'
    qb.orderBy(`da.${orderField}`, sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((a) => this.toAccountListDto(a)),
      total,
      page,
      pageSize,
    }
  }

  async findAccountById(id: string): Promise<DepositAccount> {
    const account = await this.accountRepo.findOne({
      where: { id },
      relations: ['customer'],
    })
    if (!account) {
      throw new NotFoundException('預り金アカウントが見つかりません')
    }
    return account
  }

  async findAccountByCustomer(customerId: string): Promise<DepositAccount | null> {
    return this.accountRepo.findOne({
      where: { customerId },
      relations: ['customer'],
    })
  }

  async getAccountSummary() {
    const result = await this.accountRepo
      .createQueryBuilder('da')
      .select('COUNT(*)', 'totalAccounts')
      .addSelect('COALESCE(SUM(da.balance), 0)', 'totalBalance')
      .addSelect('COUNT(CASE WHEN da.balance > 0 THEN 1 END)', 'activeAccounts')
      .getRawOne()
    return result
  }

  /* ──────── Transaction Queries ──────── */

  async findAllTransactions(query: QueryDepositTransactionDto) {
    const { page = 1, pageSize = 20, keyword, sortBy, sortOrder = 'DESC' } = query

    const qb = this.txnRepo
      .createQueryBuilder('dt')
      .leftJoinAndSelect('dt.depositAccount', 'da')
      .leftJoinAndSelect('da.customer', 'customer')
      .leftJoinAndSelect('dt.relatedInvoice', 'invoice')

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('customer.customerName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('invoice.invoiceNo ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('dt.remark ILIKE :kw', { kw: `%${keyword}%` })
        }),
      )
    }

    if (query.depositAccountId) {
      qb.andWhere('dt.depositAccountId = :depositAccountId', {
        depositAccountId: query.depositAccountId,
      })
    }

    if (query.customerId) {
      qb.andWhere('da.customerId = :customerId', { customerId: query.customerId })
    }

    if (query.transactionType) {
      qb.andWhere('dt.transactionType = :transactionType', {
        transactionType: query.transactionType,
      })
    }

    if (query.relatedInvoiceId) {
      qb.andWhere('dt.relatedInvoiceId = :relatedInvoiceId', {
        relatedInvoiceId: query.relatedInvoiceId,
      })
    }

    if (query.createdFrom) {
      qb.andWhere('dt.createdAt >= :createdFrom', { createdFrom: query.createdFrom })
    }

    if (query.createdTo) {
      qb.andWhere('dt.createdAt <= :createdTo', { createdTo: query.createdTo })
    }

    const allowedSortFields = ['amount', 'balanceAfter', 'createdAt']
    const orderField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    qb.orderBy(`dt.${orderField}`, sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((t) => this.toTransactionListDto(t)),
      total,
      page,
      pageSize,
    }
  }

  async findTransactionsByAccount(
    accountId: string,
    query: QueryDepositTransactionDto,
  ) {
    return this.findAllTransactions({ ...query, depositAccountId: accountId })
  }

  /* ──────── Mutations ──────── */

  async recharge(
    dto: CreateDepositRechargeDto,
    userId?: string,
  ): Promise<DepositTransaction> {
    const amount = this.round(dto.amount)

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const account = await this.getOrCreateAccount(
        dto.customerId,
        queryRunner.manager,
      )
      const prevBalance = this.round(Number(account.balance))
      const newBalance = this.round(prevBalance + amount)

      account.balance = newBalance
      await queryRunner.manager.save(DepositAccount, account)

      const remarkParts = [dto.paymentMethod, dto.remark].filter(Boolean)
      const txn = queryRunner.manager.create(DepositTransaction, {
        depositAccountId: account.id,
        transactionType: DepositTransactionType.RECHARGE,
        amount,
        balanceAfter: newBalance,
        remark: remarkParts.length > 0 ? remarkParts.join(' | ') : null,
        createdBy: userId ?? null,
      })

      const saved = await queryRunner.manager.save(DepositTransaction, txn)
      await queryRunner.commitTransaction()

      this.logger.log(
        `Deposit recharge ¥${amount} for customer ${dto.customerId} by user ${userId}`,
      )
      return this.findTransactionById(saved.id)
    } catch (err) {
      await queryRunner.rollbackTransaction()
      throw err
    } finally {
      await queryRunner.release()
    }
  }

  async offset(
    dto: CreateDepositOffsetDto,
    userId?: string,
  ): Promise<DepositTransaction> {
    const amount = this.round(dto.amount)

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const account = await queryRunner.manager.findOne(DepositAccount, {
        where: { customerId: dto.customerId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!account) {
        throw new NotFoundException('預り金アカウントが見つかりません')
      }

      const currentBalance = this.round(Number(account.balance))
      if (currentBalance < amount) {
        throw new BadRequestException(
          `残高不足です。現在残高: ¥${currentBalance.toLocaleString()}、充当金額: ¥${amount.toLocaleString()}`,
        )
      }

      const invoice = await queryRunner.manager.findOne(Invoice, {
        where: { id: dto.invoiceId },
        relations: ['paymentAllocations'],
        lock: { mode: 'pessimistic_write' },
      })
      if (!invoice) {
        throw new NotFoundException('請求書が見つかりません')
      }
      if (invoice.customerId !== dto.customerId) {
        throw new BadRequestException('請求書は指定顧客に属していません')
      }
      if (!OFFSETABLE_INVOICE_STATUSES.includes(invoice.status)) {
        throw new BadRequestException(
          `請求書のステータス（${invoice.status}）には充当できません`,
        )
      }

      const paymentAllocTotal = (invoice.paymentAllocations ?? []).reduce(
        (sum, pa) => sum + Number(pa.allocatedAmount),
        0,
      )
      const existingOffsets = await this.getInvoiceOffsetTotal(
        dto.invoiceId,
        queryRunner.manager,
      )
      const invoiceTotal = this.round(Number(invoice.totalAmount))
      const totalPaid = this.round(paymentAllocTotal + existingOffsets)
      const remaining = this.round(invoiceTotal - totalPaid)

      if (amount > remaining) {
        throw new BadRequestException(
          `請求書の残額（¥${remaining.toLocaleString()}）を超える充当（¥${amount.toLocaleString()}）はできません`,
        )
      }

      const newBalance = this.round(currentBalance - amount)
      account.balance = newBalance
      await queryRunner.manager.save(DepositAccount, account)

      const txn = queryRunner.manager.create(DepositTransaction, {
        depositAccountId: account.id,
        transactionType: DepositTransactionType.OFFSET,
        amount,
        balanceAfter: newBalance,
        relatedInvoiceId: dto.invoiceId,
        remark: dto.remark ?? null,
        createdBy: userId ?? null,
      })
      const saved = await queryRunner.manager.save(DepositTransaction, txn)

      await this.recalcInvoiceStatus(dto.invoiceId, queryRunner.manager)

      await queryRunner.commitTransaction()

      this.logger.log(
        `Deposit offset ¥${amount} for invoice ${invoice.invoiceNo} by user ${userId}`,
      )
      return this.findTransactionById(saved.id)
    } catch (err) {
      await queryRunner.rollbackTransaction()
      throw err
    } finally {
      await queryRunner.release()
    }
  }

  async refund(
    dto: CreateDepositRefundDto,
    userId?: string,
  ): Promise<DepositTransaction> {
    const amount = this.round(dto.amount)

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const account = await queryRunner.manager.findOne(DepositAccount, {
        where: { customerId: dto.customerId },
        lock: { mode: 'pessimistic_write' },
      })
      if (!account) {
        throw new NotFoundException('預り金アカウントが見つかりません')
      }

      const currentBalance = this.round(Number(account.balance))
      if (currentBalance < amount) {
        throw new BadRequestException(
          `残高不足です。現在残高: ¥${currentBalance.toLocaleString()}、返金金額: ¥${amount.toLocaleString()}`,
        )
      }

      const newBalance = this.round(currentBalance - amount)
      account.balance = newBalance
      await queryRunner.manager.save(DepositAccount, account)

      const remarkStr = [dto.reason, dto.remark].filter(Boolean).join(' | ')
      const txn = queryRunner.manager.create(DepositTransaction, {
        depositAccountId: account.id,
        transactionType: DepositTransactionType.REFUND,
        amount,
        balanceAfter: newBalance,
        remark: remarkStr || null,
        createdBy: userId ?? null,
      })
      const saved = await queryRunner.manager.save(DepositTransaction, txn)

      await queryRunner.commitTransaction()

      this.logger.log(
        `Deposit refund ¥${amount} for customer ${dto.customerId} by user ${userId}`,
      )
      return this.findTransactionById(saved.id)
    } catch (err) {
      await queryRunner.rollbackTransaction()
      throw err
    } finally {
      await queryRunner.release()
    }
  }

  async adjustment(
    dto: CreateDepositAdjustmentDto,
    userId?: string,
  ): Promise<DepositTransaction> {
    const amount = this.round(dto.amount)
    if (amount === 0) {
      throw new BadRequestException('調整金額は0以外を指定してください')
    }

    const queryRunner = this.dataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
      const account = await this.getOrCreateAccount(
        dto.customerId,
        queryRunner.manager,
      )
      const currentBalance = this.round(Number(account.balance))
      const newBalance = this.round(currentBalance + amount)

      if (newBalance < 0) {
        throw new BadRequestException(
          `調整後の残高がマイナス（¥${newBalance.toLocaleString()}）になります`,
        )
      }

      account.balance = newBalance
      await queryRunner.manager.save(DepositAccount, account)

      const remarkStr = [dto.reason, dto.remark].filter(Boolean).join(' | ')
      const txn = queryRunner.manager.create(DepositTransaction, {
        depositAccountId: account.id,
        transactionType: DepositTransactionType.ADJUSTMENT,
        amount,
        balanceAfter: newBalance,
        remark: remarkStr || null,
        createdBy: userId ?? null,
      })
      const saved = await queryRunner.manager.save(DepositTransaction, txn)

      await queryRunner.commitTransaction()

      this.logger.log(
        `Deposit adjustment ¥${amount} for customer ${dto.customerId} by user ${userId}`,
      )
      return this.findTransactionById(saved.id)
    } catch (err) {
      await queryRunner.rollbackTransaction()
      throw err
    } finally {
      await queryRunner.release()
    }
  }

  /* ──────── Private Helpers ──────── */

  private async getOrCreateAccount(
    customerId: string,
    manager: EntityManager,
  ): Promise<DepositAccount> {
    let account = await manager.findOne(DepositAccount, {
      where: { customerId },
      lock: { mode: 'pessimistic_write' },
    })

    if (account) return account

    try {
      const newAccount = manager.create(DepositAccount, {
        customerId,
        balance: 0,
      })
      account = await manager.save(DepositAccount, newAccount)
      return account
    } catch (err: any) {
      if (err?.driverError?.code === '23505') {
        const existing = await manager.findOne(DepositAccount, {
          where: { customerId },
          lock: { mode: 'pessimistic_write' },
        })
        if (existing) return existing
      }
      throw err
    }
  }

  private async getInvoiceOffsetTotal(
    invoiceId: string,
    manager: EntityManager,
  ): Promise<number> {
    const result = await manager
      .createQueryBuilder(DepositTransaction, 'dt')
      .where('dt.relatedInvoiceId = :invoiceId', { invoiceId })
      .andWhere('dt.transactionType = :type', {
        type: DepositTransactionType.OFFSET,
      })
      .select('COALESCE(SUM(dt.amount), 0)', 'total')
      .getRawOne()
    return Number(result?.total || 0)
  }

  /**
   * Recalculates invoice status accounting for both PaymentAllocations
   * and deposit offsets.
   */
  private async recalcInvoiceStatus(
    invoiceId: string,
    manager: EntityManager,
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

    const paymentAllocTotal = (invoice.paymentAllocations ?? []).reduce(
      (sum: number, pa: PaymentAllocation) => sum + Number(pa.allocatedAmount),
      0,
    )
    const offsetTotal = await this.getInvoiceOffsetTotal(invoiceId, manager)
    const totalPaid = this.round(paymentAllocTotal + offsetTotal)
    const invoiceTotal = this.round(Number(invoice.totalAmount))

    let newStatus: InvoiceStatus
    if (totalPaid >= invoiceTotal) {
      newStatus = InvoiceStatus.PAID
    } else if (totalPaid > 0) {
      newStatus = InvoiceStatus.PARTIAL
    } else {
      newStatus = InvoiceStatus.SENT
    }

    if (invoice.status !== newStatus) {
      invoice.status = newStatus
      await manager.save(Invoice, invoice)
      this.logger.log(
        `Invoice "${invoice.invoiceNo}" status recalculated → ${newStatus} (with deposits)`,
      )
    }
  }

  private async findTransactionById(id: string): Promise<DepositTransaction> {
    const txn = await this.txnRepo.findOne({
      where: { id },
      relations: ['depositAccount', 'depositAccount.customer', 'relatedInvoice'],
    })
    if (!txn) throw new NotFoundException('取引が見つかりません')
    return txn
  }

  private round(val: number): number {
    return Math.round(val * 100) / 100
  }

  private toAccountListDto(
    account: DepositAccount & { transactionCount?: number },
  ) {
    return {
      id: account.id,
      customerId: account.customerId,
      customerName: account.customer?.customerName ?? null,
      customerCode: (account.customer as any)?.customerCode ?? null,
      balance: account.balance,
      transactionCount: account.transactionCount ?? 0,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }
  }

  private toTransactionListDto(txn: DepositTransaction) {
    return {
      id: txn.id,
      depositAccountId: txn.depositAccountId,
      customerId: txn.depositAccount?.customerId ?? null,
      customerName: txn.depositAccount?.customer?.customerName ?? null,
      transactionType: txn.transactionType,
      amount: txn.amount,
      balanceAfter: txn.balanceAfter,
      relatedInvoiceId: txn.relatedInvoiceId,
      relatedInvoiceNo: txn.relatedInvoice?.invoiceNo ?? null,
      remark: txn.remark,
      createdBy: txn.createdBy,
      createdAt: txn.createdAt,
    }
  }
}
