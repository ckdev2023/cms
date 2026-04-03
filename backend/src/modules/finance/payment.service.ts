import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { InvoiceStatus, PaymentStatus } from '../../common/constants/enums';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { Invoice } from './entities/invoice.entity';
import { Payment } from './entities/payment.entity';
import { PaymentAllocation } from './entities/payment-allocation.entity';
import {
  PaginatedResult,
  PaymentInvoiceItem,
  PaymentListItem,
  PaymentSummaryRow,
} from './finance.types';

const ALLOCATABLE_INVOICE_STATUSES = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIAL,
];
const ALLOWED_PAYMENT_SORT_FIELDS = new Set([
  'paymentNo',
  'paymentAmount',
  'paymentDate',
  'status',
  'createdAt',
]);

/**
 * 封装入金登记、分配查询、冲正与请求书状态回算逻辑。
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(PaymentAllocation)
    private readonly allocationRepo: Repository<PaymentAllocation>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 登记一笔入金并为每条分配明细回写请求书状态。
   *
   * @param dto - 入金主表与分配明细入参
   * @param userId - 可选操作人 ID，用于审计字段
   * @returns 已持久化并重新加载关联信息的入金实体
   * @throws {BadRequestException} 分配金额合计不等于入金金额，或存在非法请求书分配时
   */
  async create(dto: CreatePaymentDto, userId?: string): Promise<Payment> {
    const paymentAmountRounded = this.roundCurrency(dto.paymentAmount);
    this.assertAllocationTotalMatchesPayment(dto, paymentAmountRounded);

    return this.withTransaction(async (manager) => {
      await this.loadAndValidateInvoices(dto, manager);

      const paymentNo = await this.generatePaymentNo(manager);
      const savedPayment = await manager.save(
        Payment,
        manager.create(Payment, {
          customerId: dto.customerId,
          paymentNo,
          paymentDate: new Date(dto.paymentDate),
          paymentAmount: paymentAmountRounded,
          paymentMethod: dto.paymentMethod,
          status: PaymentStatus.REGISTERED,
          remark: dto.remark ?? null,
          createdBy: userId ?? null,
        }),
      );
      const allocations = this.buildAllocations(
        dto,
        savedPayment.id,
        userId,
        manager,
      );
      await manager.save(PaymentAllocation, allocations);
      await this.recalcInvoices(
        dto.allocations.map((alloc) => alloc.invoiceId),
        manager,
      );

      this.logger.log(
        `Payment "${savedPayment.paymentNo}" created by user ${userId}`,
      );
      return this.findOne(savedPayment.id);
    });
  }

  /**
   * 按分页与筛选条件查询入金列表。
   *
   * @param query - 分页、客户、状态、日期与排序条件
   * @returns 入金概要列表及分页信息
   */
  async findAll(
    query: QueryPaymentDto,
  ): Promise<PaginatedResult<PaymentListItem>> {
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.customer', 'customer')
      .loadRelationCountAndMap('p.allocationCount', 'p.allocations');
    const { page = 1, pageSize = 20, sortBy, sortOrder = 'DESC' } = query;
    this.applyFindAllFilters(qb, query);
    qb.orderBy(`p.${this.resolveSortField(sortBy)}`, sortOrder)
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((p) => this.toListDto(p)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 根据入金 ID 读取详情。
   *
   * @param id - 入金主键 ID
   * @returns 已加载客户与分配明细的入金实体
   * @throws {NotFoundException} 入金记录不存在时
   */
  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: ['customer', 'allocations', 'allocations.invoice'],
      order: { allocations: { createdAt: 'ASC' } },
    });

    if (!payment) {
      throw new NotFoundException('入金記録が見つかりません');
    }

    return payment;
  }

  /**
   * 冲正一笔已登记入金，并删除其分配明细后回算请求书状态。
   *
   * @param id - 入金主键 ID
   * @param dto - 冲正原因入参
   * @param userId - 可选操作人 ID，用于审计字段
   * @returns 冲正后的入金实体
   * @throws {BadRequestException} 入金已处于冲正状态时
   * @throws {NotFoundException} 入金记录不存在时
   */
  async reverse(
    id: string,
    dto: ReversePaymentDto,
    userId?: string,
  ): Promise<Payment> {
    return this.withTransaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id },
        relations: ['allocations'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!payment) {
        throw new NotFoundException('入金記録が見つかりません');
      }

      if (payment.status === PaymentStatus.REVERSED) {
        throw new BadRequestException('この入金は既に取り消し済みです');
      }

      const affectedInvoiceIds = payment.allocations.map((a) => a.invoiceId);

      await manager.remove(PaymentAllocation, payment.allocations);

      payment.status = PaymentStatus.REVERSED;
      payment.reversalReason = dto.reversalReason;
      payment.reversedAt = new Date();
      payment.reversedBy = userId ?? null;
      await manager.save(Payment, payment);

      for (const invoiceId of affectedInvoiceIds) {
        await this.recalcInvoiceStatus(invoiceId, manager);
      }

      this.logger.log(
        `Payment "${payment.paymentNo}" reversed by user ${userId}`,
      );
      return this.findOne(id);
    });
  }

  /**
   * 查询某张请求书已关联的入金分配记录。
   *
   * @param invoiceId - 请求书主键 ID
   * @returns 按创建时间排序的入金分配概要列表
   */
  async findByInvoice(invoiceId: string): Promise<PaymentInvoiceItem[]> {
    const allocations = await this.allocationRepo.find({
      where: { invoiceId },
      relations: ['payment', 'payment.customer'],
      order: { createdAt: 'ASC' },
    });

    return allocations.map((a) => ({
      id: a.id,
      paymentId: a.paymentId,
      paymentNo: a.payment?.paymentNo ?? null,
      paymentDate: a.payment?.paymentDate ?? null,
      paymentMethod: a.payment?.paymentMethod ?? null,
      paymentStatus: a.payment?.status ?? null,
      allocatedAmount: a.allocatedAmount,
      createdAt: a.createdAt,
    }));
  }

  /**
   * 查询某个客户名下的入金列表。
   *
   * @param customerId - 客户主键 ID
   * @param query - 分页与筛选条件
   * @returns 客户维度的入金概要列表及分页信息
   */
  async findByCustomer(
    customerId: string,
    query: QueryPaymentDto,
  ): Promise<PaginatedResult<PaymentListItem>> {
    return this.findAll({ ...query, customerId });
  }

  /**
   * 汇总入金状态分布和金额。
   *
   * @param customerId - 可选客户 ID；传入后仅统计该客户的数据
   * @returns 按状态聚合的数量与金额统计
   */
  async getSummary(customerId?: string): Promise<PaymentSummaryRow[]> {
    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(p.paymentAmount), 0)', 'totalAmount')
      .groupBy('p.status');

    if (customerId) {
      qb.where('p.customerId = :customerId', { customerId });
    }

    return qb.getRawMany();
  }

  /**
   * 在事务中执行入金写操作，并统一处理提交与回滚。
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
   * 按当前入金分配总额重算请求书状态。
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

    const totalAllocated = (invoice.paymentAllocations ?? []).reduce(
      (sum, allocation) => sum + Number(allocation.allocatedAmount),
      0,
    );
    const totalAllocatedRounded = Math.round(totalAllocated * 100) / 100;
    const invoiceTotal = Math.round(Number(invoice.totalAmount) * 100) / 100;

    let newStatus: InvoiceStatus;
    if (totalAllocatedRounded >= invoiceTotal) {
      newStatus = InvoiceStatus.PAID;
    } else if (totalAllocatedRounded > 0) {
      newStatus = InvoiceStatus.PARTIAL;
    } else {
      newStatus = InvoiceStatus.SENT;
    }

    if (invoice.status !== newStatus) {
      invoice.status = newStatus;
      await manager.save(Invoice, invoice);
      this.logger.log(
        `Invoice "${invoice.invoiceNo}" status recalculated → ${newStatus}`,
      );
    }
  }

  /**
   * 生成当天递增的入金编号。
   *
   * @param manager - 可选事务管理器；传入后在同一事务内取号
   * @returns 形如 `PAY-YYYYMMDD-00001` 的入金编号
   */
  private async generatePaymentNo(manager?: EntityManager): Promise<string> {
    const repo = manager ? manager.getRepository(Payment) : this.paymentRepo;

    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const prefix = `PAY-${dateStr}-`;

    const latest = await repo
      .createQueryBuilder('p')
      .where('p.paymentNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('p.paymentNo', 'DESC')
      .getOne();

    let seq = 1;
    if (latest) {
      const lastSeq = parseInt(latest.paymentNo.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${seq.toString().padStart(5, '0')}`;
  }

  /**
   * 将入金实体转换为列表页使用的扁平概要结构。
   *
   * @param p - 已加载客户关系与分配数量映射的入金实体
   * @returns 入金列表展示用的扁平对象
   */
  private toListDto(
    p: Payment & { allocationCount?: number },
  ): PaymentListItem {
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
    };
  }

  /**
   * 校验入金总额与分配明细合计是否一致。
   *
   * @param dto - 入金主表与分配明细入参
   * @param paymentAmountRounded - 统一按分单位四舍五入后的入金金额
   * @throws {BadRequestException} 分配金额合计与入金金额不一致时
   */
  private assertAllocationTotalMatchesPayment(
    dto: CreatePaymentDto,
    paymentAmountRounded: number,
  ): void {
    const allocationTotalRounded = this.roundCurrency(
      dto.allocations.reduce(
        (sum, allocation) => sum + Number(allocation.allocatedAmount),
        0,
      ),
    );

    if (allocationTotalRounded !== paymentAmountRounded) {
      throw new BadRequestException(
        `充当金額の合計（${allocationTotalRounded}）が入金金額（${paymentAmountRounded}）と一致しません`,
      );
    }
  }

  /**
   * 加载待充当请求书并逐条校验客户归属、状态和剩余额度。
   *
   * @param dto - 入金主表与分配明细入参
   * @param manager - 当前事务管理器
   * @throws {BadRequestException} 任一请求书不存在、归属不符、状态非法或剩余额不足时
   */
  private async loadAndValidateInvoices(
    dto: CreatePaymentDto,
    manager: EntityManager,
  ): Promise<void> {
    const invoiceIds = dto.allocations.map(
      (allocation) => allocation.invoiceId,
    );
    const invoices = await manager.find(Invoice, {
      where: invoiceIds.map((id) => ({ id })),
      relations: ['paymentAllocations'],
      lock: { mode: 'pessimistic_write' },
    });
    const invoiceMap = new Map(
      invoices.map((invoice) => [invoice.id, invoice]),
    );

    for (const allocation of dto.allocations) {
      this.assertAllocatableInvoice(
        dto.customerId,
        allocation.invoiceId,
        allocation.allocatedAmount,
        invoiceMap.get(allocation.invoiceId),
      );
    }
  }

  /**
   * 校验单条入金分配是否允许写入目标请求书。
   *
   * @param customerId - 当前入金所属客户 ID
   * @param invoiceId - 目标请求书 ID
   * @param allocatedAmount - 本次拟分配金额
   * @param invoice - 已加锁加载的目标请求书
   * @throws {BadRequestException} 请求书不存在、客户不符、状态非法或超过剩余额时
   */
  private assertAllocatableInvoice(
    customerId: string,
    invoiceId: string,
    allocatedAmount: number,
    invoice?: Invoice,
  ): void {
    if (!invoice) {
      throw new BadRequestException(
        `請求書（ID: ${invoiceId}）が見つかりません`,
      );
    }
    if (invoice.customerId !== customerId) {
      throw new BadRequestException(
        `請求書「${invoice.invoiceNo}」は指定顧客に属していません`,
      );
    }
    if (!ALLOCATABLE_INVOICE_STATUSES.includes(invoice.status)) {
      throw new BadRequestException(
        `請求書「${invoice.invoiceNo}」のステータス（${invoice.status}）には充当できません`,
      );
    }

    const existingAllocated = this.roundCurrency(
      (invoice.paymentAllocations ?? []).reduce(
        (sum, allocation) => sum + Number(allocation.allocatedAmount),
        0,
      ),
    );
    const remaining = this.roundCurrency(
      Number(invoice.totalAmount) - existingAllocated,
    );
    const allocAmountRounded = this.roundCurrency(allocatedAmount);

    if (allocAmountRounded > remaining) {
      throw new BadRequestException(
        `請求書「${invoice.invoiceNo}」の残額（${remaining}）を超える充当（${allocAmountRounded}）はできません`,
      );
    }
  }

  /**
   * 构造待持久化的入金分配实体列表。
   *
   * @param dto - 入金主表与分配明细入参
   * @param paymentId - 已保存入金主表 ID
   * @param userId - 可选操作人 ID，用于审计字段
   * @param manager - 当前事务管理器
   * @returns 已填充审计字段和金额精度的分配实体数组
   */
  private buildAllocations(
    dto: CreatePaymentDto,
    paymentId: string,
    userId: string | undefined,
    manager: EntityManager,
  ): PaymentAllocation[] {
    return dto.allocations.map((allocation) =>
      manager.create(PaymentAllocation, {
        paymentId,
        invoiceId: allocation.invoiceId,
        allocatedAmount: this.roundCurrency(allocation.allocatedAmount),
        createdBy: userId ?? null,
      }),
    );
  }

  /**
   * 逐张回算本次入金影响到的请求书状态。
   *
   * @param invoiceIds - 需要回算的请求书 ID 列表
   * @param manager - 当前事务管理器
   */
  private async recalcInvoices(
    invoiceIds: string[],
    manager: EntityManager,
  ): Promise<void> {
    for (const invoiceId of invoiceIds) {
      await this.recalcInvoiceStatus(invoiceId, manager);
    }
  }

  /**
   * 将列表查询条件追加到入金分页查询构造器。
   *
   * @param qb - 入金分页查询构造器
   * @param query - 分页、筛选和排序入参
   */
  private applyFindAllFilters(
    qb: SelectQueryBuilder<Payment>,
    query: QueryPaymentDto,
  ): void {
    this.applyKeywordFilter(qb, query.keyword);

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    if (query.paymentMethod) {
      qb.andWhere('p.paymentMethod = :paymentMethod', {
        paymentMethod: query.paymentMethod,
      });
    }
    if (query.customerId) {
      qb.andWhere('p.customerId = :customerId', {
        customerId: query.customerId,
      });
    }
    if (query.invoiceId) {
      qb.innerJoin('p.allocations', 'alloc').andWhere(
        'alloc.invoiceId = :invoiceId',
        {
          invoiceId: query.invoiceId,
        },
      );
    }

    this.applyRangeFilter(
      qb,
      'p.paymentDate >= :paymentDateFrom',
      'paymentDateFrom',
      query.paymentDateFrom,
    );
    this.applyRangeFilter(
      qb,
      'p.paymentDate <= :paymentDateTo',
      'paymentDateTo',
      query.paymentDateTo,
    );
    this.applyRangeFilter(
      qb,
      'p.createdAt >= :createdFrom',
      'createdFrom',
      query.createdFrom,
    );
    this.applyRangeFilter(
      qb,
      'p.createdAt <= :createdTo',
      'createdTo',
      query.createdTo,
    );
  }

  /**
   * 将关键字模糊检索条件追加到入金列表查询。
   *
   * @param qb - 入金分页查询构造器
   * @param keyword - 支付编号、客户名或备注关键字
   */
  private applyKeywordFilter(
    qb: SelectQueryBuilder<Payment>,
    keyword?: string,
  ): void {
    if (!keyword) {
      return;
    }

    qb.andWhere(
      new Brackets((sub) => {
        sub
          .where('p.paymentNo ILIKE :kw', { kw: `%${keyword}%` })
          .orWhere('customer.customerName ILIKE :kw', { kw: `%${keyword}%` })
          .orWhere('p.remark ILIKE :kw', { kw: `%${keyword}%` });
      }),
    );
  }

  /**
   * 在查询条件存在值时追加单个范围过滤器。
   *
   * @param qb - 入金分页查询构造器
   * @param condition - TypeORM where 条件片段
   * @param parameterName - 命名参数名
   * @param parameterValue - 命名参数值
   */
  private applyRangeFilter(
    qb: SelectQueryBuilder<Payment>,
    condition: string,
    parameterName: string,
    parameterValue?: string,
  ): void {
    if (!parameterValue) {
      return;
    }

    qb.andWhere(condition, { [parameterName]: parameterValue });
  }

  /**
   * 解析允许用于分页列表排序的字段名。
   *
   * @param sortBy - 调用方传入的排序字段
   * @returns 白名单内的排序字段；非法值时回退为 `createdAt`
   */
  private resolveSortField(sortBy?: string): string {
    if (!sortBy || !ALLOWED_PAYMENT_SORT_FIELDS.has(sortBy)) {
      return 'createdAt';
    }

    return sortBy;
  }

  /**
   * 将金额统一规整为两位小数，避免比较与保存时出现精度漂移。
   *
   * @param amount - 原始金额或可转数字字符串
   * @returns 按分单位四舍五入后的金额
   */
  private roundCurrency(amount: number | string): number {
    return Math.round(Number(amount) * 100) / 100;
  }
}
