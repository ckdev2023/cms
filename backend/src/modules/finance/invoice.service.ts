import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { InvoiceStatus } from '../../common/constants/enums';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { VoidInvoiceDto } from './dto/void-invoice.dto';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import {
  InvoiceListItem,
  InvoiceSummaryRow,
  PaginatedResult,
} from './finance.types';

const STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.VOID],
  [InvoiceStatus.SENT]: [
    InvoiceStatus.PARTIAL,
    InvoiceStatus.PAID,
    InvoiceStatus.VOID,
  ],
  [InvoiceStatus.PARTIAL]: [InvoiceStatus.PAID, InvoiceStatus.VOID],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.VOID]: [],
};

/**
 * 封装请求书的创建、查询、更新、状态流转、作废与恢复逻辑。
 */
@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepo: Repository<InvoiceItem>,
  ) {}

  /**
   * 创建一张新的下书き请求书并自动汇总行项目金额。
   *
   * @param dto - 请求书主表与行项目入参
   * @param userId - 可选操作人 ID，用于审计字段
   * @returns 已持久化并重新加载关联信息的请求书实体
   */
  async create(dto: CreateInvoiceDto, userId?: string): Promise<Invoice> {
    const invoiceNo = await this.generateInvoiceNo();

    const items = dto.items.map((it) => {
      const quantity = it.quantity ?? 1;
      const amount = Math.round(quantity * it.unitPrice * 100) / 100;
      return this.itemRepo.create({
        description: it.description,
        quantity,
        unitPrice: it.unitPrice,
        amount,
        sortOrder: it.sortOrder ?? 0,
      });
    });

    const totalAmount = items.reduce((sum, it) => sum + Number(it.amount), 0);

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
    });

    const saved = await this.invoiceRepo.save(invoice);
    this.logger.log(`Invoice "${saved.invoiceNo}" created by user ${userId}`);
    return this.findOne(saved.id);
  }

  /**
   * 按分页与筛选条件查询请求书列表。
   *
   * @param query - 分页、客户、状态、日期与排序条件
   * @returns 请求书概要列表及分页信息
   */
  async findAll(
    query: QueryInvoiceDto,
  ): Promise<PaginatedResult<InvoiceListItem>> {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      sortBy,
      sortOrder = 'DESC',
    } = query;

    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.customer', 'customer')
      .loadRelationCountAndMap('inv.itemCount', 'inv.items');

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('inv.invoiceNo ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('customer.customerName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('inv.remark ILIKE :kw', { kw: `%${keyword}%` });
        }),
      );
    }

    if (query.status) {
      qb.andWhere('inv.status = :status', { status: query.status });
    }

    if (query.invoiceType) {
      qb.andWhere('inv.invoiceType = :invoiceType', {
        invoiceType: query.invoiceType,
      });
    }

    if (query.customerId) {
      qb.andWhere('inv.customerId = :customerId', {
        customerId: query.customerId,
      });
    }

    if (query.dueDateFrom) {
      qb.andWhere('inv.dueDate >= :dueDateFrom', {
        dueDateFrom: query.dueDateFrom,
      });
    }

    if (query.dueDateTo) {
      qb.andWhere('inv.dueDate <= :dueDateTo', { dueDateTo: query.dueDateTo });
    }

    if (query.createdFrom) {
      qb.andWhere('inv.createdAt >= :createdFrom', {
        createdFrom: query.createdFrom,
      });
    }

    if (query.createdTo) {
      qb.andWhere('inv.createdAt <= :createdTo', {
        createdTo: query.createdTo,
      });
    }

    const allowedSortFields = [
      'invoiceNo',
      'totalAmount',
      'status',
      'dueDate',
      'createdAt',
      'updatedAt',
    ];
    const orderField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    qb.orderBy(`inv.${orderField}`, sortOrder);

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((inv) => this.toListDto(inv)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 根据请求书 ID 读取详情。
   *
   * @param id - 请求书主键 ID
   * @returns 已加载客户与行项目的请求书实体
   * @throws {NotFoundException} 请求书不存在时
   */
  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['customer', 'items'],
      order: { items: { sortOrder: 'ASC', createdAt: 'ASC' } },
    });

    if (!invoice) {
      throw new NotFoundException('請求書が見つかりません');
    }

    return invoice;
  }

  /**
   * 更新下书き状态请求书的字段与行项目。
   *
   * @param id - 请求书主键 ID
   * @param dto - 可更新字段与行项目入参
   * @param userId - 可选操作人 ID，用于审计字段
   * @returns 更新后的请求书实体
   * @throws {BadRequestException} 请求书不处于下书き状态时
   */
  async update(
    id: string,
    dto: UpdateInvoiceDto,
    userId?: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('下書き状態の請求書のみ編集できます');
    }

    if (dto.invoiceType !== undefined) invoice.invoiceType = dto.invoiceType;
    if (dto.dueDate !== undefined)
      invoice.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.relatedId !== undefined) invoice.relatedId = dto.relatedId ?? null;
    if (dto.relatedType !== undefined)
      invoice.relatedType = dto.relatedType ?? null;
    if (dto.remark !== undefined) invoice.remark = dto.remark ?? null;
    invoice.updatedBy = userId ?? null;

    if (dto.items !== undefined) {
      await this.itemRepo.delete({ invoiceId: id });

      const newItems = dto.items.map((it) => {
        const quantity = it.quantity ?? 1;
        const amount = Math.round(quantity * it.unitPrice * 100) / 100;
        return this.itemRepo.create({
          invoiceId: id,
          description: it.description,
          quantity,
          unitPrice: it.unitPrice,
          amount,
          sortOrder: it.sortOrder ?? 0,
        });
      });

      await this.itemRepo.save(newItems);
      invoice.totalAmount =
        Math.round(newItems.reduce((s, it) => s + Number(it.amount), 0) * 100) /
        100;
    }

    await this.invoiceRepo.save(invoice);
    this.logger.log(`Invoice "${invoice.invoiceNo}" updated by user ${userId}`);
    return this.findOne(id);
  }

  /**
   * 按状态机规则推进请求书状态。
   *
   * @param id - 请求书主键 ID
   * @param newStatus - 目标请求书状态
   * @param userId - 可选操作人 ID，用于审计字段
   * @returns 状态更新后的请求书实体
   * @throws {BadRequestException} 当前状态不允许迁移到目标状态时
   */
  async updateStatus(
    id: string,
    newStatus: InvoiceStatus,
    userId?: string,
  ): Promise<Invoice> {
    const invoice = await this.findOne(id);
    const allowed = STATUS_TRANSITIONS[invoice.status];

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `ステータスを「${invoice.status}」から「${newStatus}」に変更できません`,
      );
    }

    if (newStatus === InvoiceStatus.SENT) {
      invoice.issuedAt = new Date();
    }

    invoice.status = newStatus;
    invoice.updatedBy = userId ?? null;
    await this.invoiceRepo.save(invoice);

    this.logger.log(
      `Invoice "${invoice.invoiceNo}" status → ${newStatus} by user ${userId}`,
    );
    return this.findOne(id);
  }

  /**
   * 将请求书标记为作废并记录作废原因。
   *
   * @param id - 请求书主键 ID
   * @param dto - 作废原因入参
   * @param userId - 可选操作人 ID，用于审计字段
   * @returns 作废后的请求书实体
   * @throws {BadRequestException} 当前状态不可作废或存在已入金记录时
   * @throws {NotFoundException} 请求书不存在时
   */
  async voidInvoice(
    id: string,
    dto: VoidInvoiceDto,
    userId?: string,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      relations: ['paymentAllocations'],
    });

    if (!invoice) {
      throw new NotFoundException('請求書が見つかりません');
    }

    const allowed = STATUS_TRANSITIONS[invoice.status];
    if (!allowed.includes(InvoiceStatus.VOID)) {
      throw new BadRequestException(
        `ステータス「${invoice.status}」の請求書は無効化できません`,
      );
    }

    if (
      invoice.paymentAllocations?.length > 0 &&
      invoice.status === InvoiceStatus.PARTIAL
    ) {
      throw new BadRequestException(
        '入金済みの請求書を無効化するには、先に入金を取り消してください',
      );
    }

    invoice.status = InvoiceStatus.VOID;
    invoice.voidReason = dto.voidReason;
    invoice.voidedAt = new Date();
    invoice.voidedBy = userId ?? null;
    invoice.updatedBy = userId ?? null;
    await this.invoiceRepo.save(invoice);

    this.logger.log(`Invoice "${invoice.invoiceNo}" voided by user ${userId}`);
    return this.findOne(id);
  }

  /**
   * 软删除下书き状态的请求书。
   *
   * @param id - 请求书主键 ID
   * @throws {BadRequestException} 请求书不处于下书き状态时
   */
  async remove(id: string): Promise<void> {
    const invoice = await this.findOne(id);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('下書き状態の請求書のみ削除できます');
    }

    await this.invoiceRepo.softRemove(invoice);
    this.logger.log(`Invoice "${invoice.invoiceNo}" soft-deleted`);
  }

  /**
   * 从逻辑删除状态恢复请求书。
   *
   * @param id - 请求书主键 ID
   * @returns 恢复后的请求书实体
   * @throws {BadRequestException} 请求书未被删除时
   * @throws {NotFoundException} 请求书不存在时
   */
  async restore(id: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!invoice) throw new NotFoundException('請求書が見つかりません');
    if (!invoice.deletedAt)
      throw new BadRequestException('この請求書は削除されていません');
    await this.invoiceRepo.recover(invoice);
    this.logger.log(`Invoice "${invoice.invoiceNo}" restored`);
    return this.findOne(id);
  }

  /**
   * 返回给定状态下允许迁移到的目标状态集合。
   *
   * @param status - 当前请求书状态
   * @returns 可迁移到的状态数组
   */
  getAvailableTransitions(status: InvoiceStatus): InvoiceStatus[] {
    return STATUS_TRANSITIONS[status] ?? [];
  }

  /**
   * 查询某个客户名下的请求书列表。
   *
   * @param customerId - 客户主键 ID
   * @param query - 分页与筛选条件
   * @returns 客户维度的请求书概要列表及分页信息
   */
  async findByCustomer(
    customerId: string,
    query: QueryInvoiceDto,
  ): Promise<PaginatedResult<InvoiceListItem>> {
    return this.findAll({ ...query, customerId });
  }

  /**
   * 汇总请求书状态分布和金额。
   *
   * @param customerId - 可选客户 ID；传入后仅统计该客户的数据
   * @returns 按状态聚合的数量与金额统计
   */
  async getSummary(customerId?: string): Promise<InvoiceSummaryRow[]> {
    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .select('inv.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(inv.totalAmount), 0)', 'totalAmount')
      .groupBy('inv.status');

    if (customerId) {
      qb.where('inv.customerId = :customerId', { customerId });
    }

    return qb.getRawMany();
  }

  /**
   * 生成当天递增的请求书编号。
   *
   * @returns 形如 `INV-YYYYMMDD-00001` 的请求书编号
   */
  private async generateInvoiceNo(): Promise<string> {
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const prefix = `INV-${dateStr}-`;

    const latest = await this.invoiceRepo
      .createQueryBuilder('inv')
      .where('inv.invoiceNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('inv.invoiceNo', 'DESC')
      .getOne();

    let seq = 1;
    if (latest) {
      const lastSeq = parseInt(latest.invoiceNo.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${seq.toString().padStart(5, '0')}`;
  }

  /**
   * 将请求书实体转换为列表页使用的扁平概要结构。
   *
   * @param inv - 已加载客户关系与行项目计数映射的请求书实体
   * @returns 请求书列表展示用的扁平对象
   */
  private toListDto(inv: Invoice & { itemCount?: number }): InvoiceListItem {
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
    };
  }
}
