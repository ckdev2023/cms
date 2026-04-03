import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import {
  DepositTransactionType,
  InvoiceStatus,
} from '../../common/constants/enums';
import {
  findDepositAccountByCustomer,
  findDepositAccountById,
  findDepositAccounts,
  findDepositTransactionById,
  findDepositTransactions,
  getDepositAccountSummary,
} from './deposit.service.queries';
import { CreateDepositAdjustmentDto } from './dto/create-deposit-adjustment.dto';
import { CreateDepositOffsetDto } from './dto/create-deposit-offset.dto';
import { CreateDepositRechargeDto } from './dto/create-deposit-recharge.dto';
import { CreateDepositRefundDto } from './dto/create-deposit-refund.dto';
import { QueryDepositAccountDto } from './dto/query-deposit-account.dto';
import { QueryDepositTransactionDto } from './dto/query-deposit-transaction.dto';
import { DepositAccount } from './entities/deposit-account.entity';
import { DepositTransaction } from './entities/deposit-transaction.entity';
import { Invoice } from './entities/invoice.entity';
import {
  DepositAccountListItem,
  DepositAccountSummary,
  DepositTransactionListItem,
  PaginatedResult,
  PostgresErrorLike,
} from './finance.types';

const OFFSETABLE_INVOICE_STATUSES = [InvoiceStatus.SENT, InvoiceStatus.PARTIAL];

/**
 * 封装预り金账户与交易流水的查询、充值、充当、返金和人工调整逻辑。
 */
@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);

  constructor(
    @InjectRepository(DepositAccount)
    private readonly accountRepo: Repository<DepositAccount>,
    @InjectRepository(DepositTransaction)
    private readonly txnRepo: Repository<DepositTransaction>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    private readonly dataSource: DataSource,
  ) {}

  /* ──────── Account Queries ──────── */

  /**
   * 按分页与筛选条件查询预り金账户列表。
   *
   * @param query - 账户分页、客户、关键字与排序条件
   * @returns 账户概要列表及分页信息
   */
  async findAllAccounts(
    query: QueryDepositAccountDto,
  ): Promise<PaginatedResult<DepositAccountListItem>> {
    return findDepositAccounts(this.accountRepo, query);
  }

  /**
   * 根据账户 ID 读取预り金账户详情。
   *
   * @param id - 预り金账户主键 ID
   * @returns 已加载客户关联的账户实体
   * @throws {NotFoundException} 账户不存在时
   */
  async findAccountById(id: string): Promise<DepositAccount> {
    return findDepositAccountById(this.accountRepo, id);
  }

  /**
   * 根据客户 ID 查询该客户的预り金账户。
   *
   * @param customerId - 客户主键 ID
   * @returns 匹配的账户实体；尚未开户时返回 null
   */
  async findAccountByCustomer(
    customerId: string,
  ): Promise<DepositAccount | null> {
    return findDepositAccountByCustomer(this.accountRepo, customerId);
  }

  /**
   * 汇总预り金账户总数、活跃账户数与余额总额。
   *
   * @returns 按字符串字段返回的聚合结果，兼容 TypeORM 原始查询输出
   */
  async getAccountSummary(): Promise<DepositAccountSummary> {
    return getDepositAccountSummary(this.accountRepo);
  }

  /* ──────── Transaction Queries ──────── */

  /**
   * 按分页与筛选条件查询预り金交易流水。
   *
   * @param query - 交易分页、账户、客户、发票与日期筛选条件
   * @returns 交易概要列表及分页信息
   */
  async findAllTransactions(
    query: QueryDepositTransactionDto,
  ): Promise<PaginatedResult<DepositTransactionListItem>> {
    return findDepositTransactions(this.txnRepo, query);
  }

  /**
   * 查询指定账户下的预り金交易流水。
   *
   * @param accountId - 预り金账户主键 ID
   * @param query - 交易分页与筛选条件
   * @returns 账户维度的交易概要列表及分页信息
   */
  async findTransactionsByAccount(
    accountId: string,
    query: QueryDepositTransactionDto,
  ): Promise<PaginatedResult<DepositTransactionListItem>> {
    return this.findAllTransactions({ ...query, depositAccountId: accountId });
  }

  /* ──────── Mutations ──────── */

  /**
   * 为客户账户追加一笔预り金充值交易。
   *
   * @param dto - 充值金额、客户与备注入参
   * @param userId - 可选操作人 ID，用于审计字段
   * @returns 持久化后的充值交易详情
   */
  async recharge(
    dto: CreateDepositRechargeDto,
    userId?: string,
  ): Promise<DepositTransaction> {
    const amount = this.round(dto.amount);
    return this.withTransaction(async (manager) => {
      const account = await this.getOrCreateAccount(dto.customerId, manager);
      const prevBalance = this.round(Number(account.balance));
      const newBalance = this.round(prevBalance + amount);

      account.balance = newBalance;
      await manager.save(DepositAccount, account);

      const remarkParts = [dto.paymentMethod, dto.remark].filter(Boolean);
      const txn = manager.create(DepositTransaction, {
        depositAccountId: account.id,
        transactionType: DepositTransactionType.RECHARGE,
        amount,
        balanceAfter: newBalance,
        remark: remarkParts.length > 0 ? remarkParts.join(' | ') : null,
        createdBy: userId ?? null,
      });

      const saved = await manager.save(DepositTransaction, txn);

      this.logger.log(
        `Deposit recharge ¥${amount} for customer ${dto.customerId} by user ${userId}`,
      );
      return this.findTransactionById(saved.id);
    });
  }

  /**
   * 将客户预り金余额充当到指定请求书。
   *
   * @param dto - 充当金额、客户与请求书入参
   * @param userId - 可选操作人 ID，用于审计字段
   * @returns 持久化后的充当交易详情
   * @throws {BadRequestException} 余额不足、请求书状态不允许或充当金额超过残额时
   * @throws {NotFoundException} 账户或请求书不存在时
   */
  async offset(
    dto: CreateDepositOffsetDto,
    userId?: string,
  ): Promise<DepositTransaction> {
    const amount = this.round(dto.amount);
    return this.withTransaction(async (manager) => {
      const account = await manager.findOne(DepositAccount, {
        where: { customerId: dto.customerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) {
        throw new NotFoundException('預り金アカウントが見つかりません');
      }

      const currentBalance = this.round(Number(account.balance));
      if (currentBalance < amount) {
        throw new BadRequestException(
          `残高不足です。現在残高: ¥${currentBalance.toLocaleString()}、充当金額: ¥${amount.toLocaleString()}`,
        );
      }

      const invoice = await manager.findOne(Invoice, {
        where: { id: dto.invoiceId },
        relations: ['paymentAllocations'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice) {
        throw new NotFoundException('請求書が見つかりません');
      }
      if (invoice.customerId !== dto.customerId) {
        throw new BadRequestException('請求書は指定顧客に属していません');
      }
      if (!OFFSETABLE_INVOICE_STATUSES.includes(invoice.status)) {
        throw new BadRequestException(
          `請求書のステータス（${invoice.status}）には充当できません`,
        );
      }

      const paymentAllocTotal = (invoice.paymentAllocations ?? []).reduce(
        (sum, pa) => sum + Number(pa.allocatedAmount),
        0,
      );
      const existingOffsets = await this.getInvoiceOffsetTotal(
        dto.invoiceId,
        manager,
      );
      const invoiceTotal = this.round(Number(invoice.totalAmount));
      const totalPaid = this.round(paymentAllocTotal + existingOffsets);
      const remaining = this.round(invoiceTotal - totalPaid);

      if (amount > remaining) {
        throw new BadRequestException(
          `請求書の残額（¥${remaining.toLocaleString()}）を超える充当（¥${amount.toLocaleString()}）はできません`,
        );
      }

      const newBalance = this.round(currentBalance - amount);
      account.balance = newBalance;
      await manager.save(DepositAccount, account);

      const txn = manager.create(DepositTransaction, {
        depositAccountId: account.id,
        transactionType: DepositTransactionType.OFFSET,
        amount,
        balanceAfter: newBalance,
        relatedInvoiceId: dto.invoiceId,
        remark: dto.remark ?? null,
        createdBy: userId ?? null,
      });
      const saved = await manager.save(DepositTransaction, txn);

      await this.recalcInvoiceStatus(dto.invoiceId, manager);

      this.logger.log(
        `Deposit offset ¥${amount} for invoice ${invoice.invoiceNo} by user ${userId}`,
      );
      return this.findTransactionById(saved.id);
    });
  }

  /**
   * 从客户预り金余额扣减一笔返金交易。
   *
   * @param dto - 返金额度、客户与返金原因入参
   * @param userId - 可选操作人 ID，用于审计字段
   * @returns 持久化后的返金交易详情
   * @throws {BadRequestException} 余额不足时
   * @throws {NotFoundException} 账户不存在时
   */
  async refund(
    dto: CreateDepositRefundDto,
    userId?: string,
  ): Promise<DepositTransaction> {
    const amount = this.round(dto.amount);
    return this.withTransaction(async (manager) => {
      const account = await manager.findOne(DepositAccount, {
        where: { customerId: dto.customerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) {
        throw new NotFoundException('預り金アカウントが見つかりません');
      }

      const currentBalance = this.round(Number(account.balance));
      if (currentBalance < amount) {
        throw new BadRequestException(
          `残高不足です。現在残高: ¥${currentBalance.toLocaleString()}、返金金額: ¥${amount.toLocaleString()}`,
        );
      }

      const newBalance = this.round(currentBalance - amount);
      account.balance = newBalance;
      await manager.save(DepositAccount, account);

      const remarkStr = [dto.reason, dto.remark].filter(Boolean).join(' | ');
      const txn = manager.create(DepositTransaction, {
        depositAccountId: account.id,
        transactionType: DepositTransactionType.REFUND,
        amount,
        balanceAfter: newBalance,
        remark: remarkStr || null,
        createdBy: userId ?? null,
      });
      const saved = await manager.save(DepositTransaction, txn);

      this.logger.log(
        `Deposit refund ¥${amount} for customer ${dto.customerId} by user ${userId}`,
      );
      return this.findTransactionById(saved.id);
    });
  }

  /**
   * 对客户预り金余额执行人工正负调整。
   *
   * @param dto - 调整金额、客户与调整原因入参
   * @param userId - 可选操作人 ID，用于审计字段
   * @returns 持久化后的调整交易详情
   * @throws {BadRequestException} 调整金额为 0 或调整后余额小于 0 时
   */
  async adjustment(
    dto: CreateDepositAdjustmentDto,
    userId?: string,
  ): Promise<DepositTransaction> {
    const amount = this.round(dto.amount);
    if (amount === 0) {
      throw new BadRequestException('調整金額は0以外を指定してください');
    }
    return this.withTransaction(async (manager) => {
      const account = await this.getOrCreateAccount(dto.customerId, manager);
      const currentBalance = this.round(Number(account.balance));
      const newBalance = this.round(currentBalance + amount);

      if (newBalance < 0) {
        throw new BadRequestException(
          `調整後の残高がマイナス（¥${newBalance.toLocaleString()}）になります`,
        );
      }

      account.balance = newBalance;
      await manager.save(DepositAccount, account);

      const remarkStr = [dto.reason, dto.remark].filter(Boolean).join(' | ');
      const txn = manager.create(DepositTransaction, {
        depositAccountId: account.id,
        transactionType: DepositTransactionType.ADJUSTMENT,
        amount,
        balanceAfter: newBalance,
        remark: remarkStr || null,
        createdBy: userId ?? null,
      });
      const saved = await manager.save(DepositTransaction, txn);

      this.logger.log(
        `Deposit adjustment ¥${amount} for customer ${dto.customerId} by user ${userId}`,
      );
      return this.findTransactionById(saved.id);
    });
  }

  /* ──────── Private Helpers ──────── */

  /**
   * 在事务中执行预り金写操作，并统一处理提交与回滚。
   *
   * @param operation - 基于事务管理器执行的数据库写操作
   * @returns 事务内操作产出的结果
   * @throws {unknown} 事务内任一操作失败时原样抛出
   */
  private async withTransaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await operation(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 读取客户的预り金账户；若不存在则在事务内补建一条空余额账户。
   *
   * @param customerId - 客户主键 ID
   * @param manager - 当前事务管理器
   * @returns 已加写锁的账户实体
   */
  private async getOrCreateAccount(
    customerId: string,
    manager: EntityManager,
  ): Promise<DepositAccount> {
    let account = await manager.findOne(DepositAccount, {
      where: { customerId },
      lock: { mode: 'pessimistic_write' },
    });

    if (account) return account;

    try {
      const newAccount = manager.create(DepositAccount, {
        customerId,
        balance: 0,
      });
      account = await manager.save(DepositAccount, newAccount);
      return account;
    } catch (error: unknown) {
      const postgresError = error as PostgresErrorLike;
      if (postgresError.driverError?.code === '23505') {
        const existing = await manager.findOne(DepositAccount, {
          where: { customerId },
          lock: { mode: 'pessimistic_write' },
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  /**
   * 统计某张请求书已发生的预り金充当总额。
   *
   * @param invoiceId - 请求书主键 ID
   * @param manager - 当前事务管理器
   * @returns 该请求书的预り金充当合计金额
   */
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
      .getRawOne<{ total: string }>();
    return Number(result?.total || 0);
  }

  /**
   * 按入金分配和预り金充当的合计结果重算请求书状态。
   *
   * @param invoiceId - 请求书主键 ID
   * @param manager - 当前事务管理器
   */
  private async recalcInvoiceStatus(
    invoiceId: string,
    manager: EntityManager,
  ): Promise<void> {
    const invoice = await manager.findOne(Invoice, {
      where: { id: invoiceId },
      relations: ['paymentAllocations'],
    });
    if (!invoice) return;
    if (
      invoice.status === InvoiceStatus.VOID ||
      invoice.status === InvoiceStatus.DRAFT
    ) {
      return;
    }

    const paymentAllocTotal = (invoice.paymentAllocations ?? []).reduce(
      (sum, allocation) => sum + Number(allocation.allocatedAmount),
      0,
    );
    const offsetTotal = await this.getInvoiceOffsetTotal(invoiceId, manager);
    const totalPaid = this.round(paymentAllocTotal + offsetTotal);
    const invoiceTotal = this.round(Number(invoice.totalAmount));

    let newStatus: InvoiceStatus;
    if (totalPaid >= invoiceTotal) {
      newStatus = InvoiceStatus.PAID;
    } else if (totalPaid > 0) {
      newStatus = InvoiceStatus.PARTIAL;
    } else {
      newStatus = InvoiceStatus.SENT;
    }

    if (invoice.status !== newStatus) {
      invoice.status = newStatus;
      await manager.save(Invoice, invoice);
      this.logger.log(
        `Invoice "${invoice.invoiceNo}" status recalculated → ${newStatus} (with deposits)`,
      );
    }
  }

  /**
   * 根据交易 ID 回查预り金交易详情及其关联对象。
   *
   * @param id - 交易主键 ID
   * @returns 已加载账户、客户和关联请求书的交易实体
   * @throws {NotFoundException} 交易不存在时
   */
  private async findTransactionById(id: string): Promise<DepositTransaction> {
    return findDepositTransactionById(this.txnRepo, id);
  }

  /**
   * 将金额统一保留到两位小数，避免累计运算出现精度漂移。
   *
   * @param val - 原始金额
   * @returns 保留两位小数后的金额
   */
  private round(val: number): number {
    return Math.round(val * 100) / 100;
  }
}
