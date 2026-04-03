import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';

import {
  AdminCaseStatus,
  CustomerStatus,
  InvoiceStatus,
  MonthlyStatus,
  TaxContractStatus,
} from '../../common/constants/enums';
import { AdminCase } from '../admin-case/entities/admin-case.entity';
import { Customer } from '../customer/entities/customer.entity';
import { Note } from '../customer/entities/note.entity';
import { FileEntity } from '../file/entities/file.entity';
import { Invoice } from '../finance/entities/invoice.entity';
import { TaxContract } from '../tax/entities/tax-contract.entity';
import { TaxPeriod } from '../tax/entities/tax-period.entity';

const ACTIVE_ADMIN_CASE_STATUSES = [
  AdminCaseStatus.DRAFT,
  AdminCaseStatus.ACCEPTED,
  AdminCaseStatus.MATERIAL_PENDING,
  AdminCaseStatus.SUBMITTED,
] as const;

const OPEN_TAX_PERIOD_STATUSES = [
  MonthlyStatus.NOT_STARTED,
  MonthlyStatus.IN_PROGRESS,
] as const;

const PENDING_INVOICE_STATUSES = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIAL,
] as const;

type AmountCarrier = {
  totalAmount: number | null;
};

export interface DashboardSummary {
  activeCustomers: number;
  activeCases: number;
  pendingInvoices: number;
  activeContracts: number;
}

export interface ExpiringItem {
  id: string;
  type: 'admin_case' | 'tax_deadline';
  title: string;
  customerName: string;
  customerId: string;
  deadline: string;
  daysLeft: number;
  status: string;
}

export interface FinanceSummary {
  draftCount: number;
  draftAmount: number;
  sentCount: number;
  sentAmount: number;
  partialCount: number;
  partialAmount: number;
  overdueCount: number;
  overdueAmount: number;
  monthlyCollected: number;
  monthlyCollectedCount: number;
}

export interface RecentActivityItem {
  id: string;
  type: 'note' | 'file';
  title: string;
  description: string;
  customerName: string | null;
  customerId: string | null;
  createdAt: string;
  creatorName: string | null;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(AdminCase)
    private readonly adminCaseRepo: Repository<AdminCase>,
    @InjectRepository(TaxPeriod)
    private readonly taxPeriodRepo: Repository<TaxPeriod>,
    @InjectRepository(TaxContract)
    private readonly taxContractRepo: Repository<TaxContract>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(Note)
    private readonly noteRepo: Repository<Note>,
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
  ) {}

  /**
   * 汇总工作台首页展示的客户、案件、请款与合同核心计数。
   *
   * @returns 包含首页四张概览卡片所需计数的聚合结果
   */
  async getSummary(): Promise<DashboardSummary> {
    const [activeCustomers, activeCases, pendingInvoices, activeContracts] =
      await Promise.all([
        this.customerRepo.count({
          where: { status: CustomerStatus.ACTIVE },
        }),
        this.adminCaseRepo.count({
          where: {
            status: In([...ACTIVE_ADMIN_CASE_STATUSES]),
          },
        }),
        this.invoiceRepo.count({
          where: {
            status: In([...PENDING_INVOICE_STATUSES]),
          },
        }),
        this.taxContractRepo.count({
          where: { contractStatus: TaxContractStatus.ACTIVE },
        }),
      ]);

    return { activeCustomers, activeCases, pendingInvoices, activeContracts };
  }

  /**
   * 查询未来指定天数内到期的行政案件与税务申报事项。
   *
   * @param days - 距今天的查询窗口天数，省略时默认查询 30 天内数据
   * @returns 按剩余天数升序排列的到期提醒列表，最多返回 20 条
   */
  async getExpiringItems(days = 30): Promise<ExpiringItem[]> {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + days);
    const futureDateKey = this.toDateKey(futureDate);

    const [adminCases, taxPeriods] = await Promise.all([
      this.adminCaseRepo.find({
        where: {
          expireDate: Not(IsNull()),
          status: In([...ACTIVE_ADMIN_CASE_STATUSES]),
        },
        relations: ['customer'],
        order: { expireDate: 'ASC' },
      }),
      this.taxPeriodRepo.find({
        where: {
          declarationDeadline: Not(IsNull()),
          monthlyStatus: In([...OPEN_TAX_PERIOD_STATUSES]),
        },
        relations: ['customer'],
        order: { declarationDeadline: 'ASC' },
      }),
    ]);

    const items: ExpiringItem[] = [];

    for (const ac of adminCases) {
      const item = this.buildAdminCaseExpiringItem(ac, today, futureDateKey);

      if (item) {
        items.push(item);
      }
    }

    for (const tp of taxPeriods) {
      const item = this.buildTaxPeriodExpiringItem(tp, today, futureDateKey);

      if (item) {
        items.push(item);
      }
    }

    items.sort((a, b) => a.daysLeft - b.daysLeft);
    return items.slice(0, 20);
  }

  /**
   * 统计工作台首页展示的请款状态分布与本月回款金额。
   *
   * @returns 包含草稿、已发送、部分回款、逾期与本月回款汇总的财务概览
   */
  async getFinanceSummary(): Promise<FinanceSummary> {
    const today = new Date();
    const todayKey = this.toDateKey(today);
    const monthStartKey = this.toMonthStartKey(today);

    const [draftInvoices, sentInvoices, partialInvoices, allSentOrPartial] =
      await Promise.all([
        this.invoiceRepo.find({
          where: { status: InvoiceStatus.DRAFT },
          select: ['id', 'totalAmount'],
        }),
        this.invoiceRepo.find({
          where: { status: InvoiceStatus.SENT },
          select: ['id', 'totalAmount', 'dueDate'],
        }),
        this.invoiceRepo.find({
          where: { status: InvoiceStatus.PARTIAL },
          select: ['id', 'totalAmount', 'dueDate'],
        }),
        this.invoiceRepo.find({
          where: {
            status: InvoiceStatus.PAID,
          },
          select: ['id', 'totalAmount', 'updatedAt'],
        }),
      ]);

    const overdueList = [...sentInvoices, ...partialInvoices].filter(
      (invoice) =>
        invoice.dueDate && this.toDateKey(new Date(invoice.dueDate)) < todayKey,
    );

    const monthlyPaid = allSentOrPartial.filter(
      (invoice) =>
        invoice.updatedAt && this.toDateKey(invoice.updatedAt) >= monthStartKey,
    );

    return {
      draftCount: draftInvoices.length,
      draftAmount: this.sumAmounts(draftInvoices),
      sentCount: sentInvoices.length,
      sentAmount: this.sumAmounts(sentInvoices),
      partialCount: partialInvoices.length,
      partialAmount: this.sumAmounts(partialInvoices),
      overdueCount: overdueList.length,
      overdueAmount: this.sumAmounts(overdueList),
      monthlyCollected: this.sumAmounts(monthlyPaid),
      monthlyCollectedCount: monthlyPaid.length,
    };
  }

  /**
   * 聚合最近新增的客户备注与上传文件，供首页活动流展示。
   *
   * @param limit - 最多返回的活动条目数，省略时默认返回 10 条
   * @returns 按创建时间倒序排列的统一活动流列表
   */
  async getRecentActivity(limit = 10): Promise<RecentActivityItem[]> {
    const [recentNotes, recentFiles] = await Promise.all([
      this.noteRepo.find({
        relations: ['customer', 'creator'],
        order: { createdAt: 'DESC' },
        take: limit,
      }),
      this.fileRepo.find({
        relations: ['uploader'],
        order: { createdAt: 'DESC' },
        take: limit,
      }),
    ]);

    const items: RecentActivityItem[] = [];

    for (const note of recentNotes) {
      items.push(this.buildRecentNoteItem(note));
    }

    for (const file of recentFiles) {
      items.push(this.buildRecentFileItem(file));
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return items.slice(0, limit);
  }

  /**
   * 将日期对象转换为本地时区的 `YYYY-MM-DD` 比较键。
   *
   * @param date - 需要标准化的日期对象
   * @returns 适合做字符串比较的本地日期键
   */
  private toDateKey(date: Date): string {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  /**
   * 生成当前月份第一天的日期键，供本月回款统计复用。
   *
   * @param date - 作为月份基准的当前时间
   * @returns 对应月份第一天的 `YYYY-MM-DD` 字符串
   */
  private toMonthStartKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  }

  /**
   * 计算列表中金额字段的数值总和，兼容空值与字符串化金额。
   *
   * @param items - 含 `totalAmount` 字段的实体列表
   * @returns 金额字段累加后的数值结果
   */
  private sumAmounts(items: AmountCarrier[]): number {
    return items.reduce((sum, item) => sum + Number(item.totalAmount ?? 0), 0);
  }

  /**
   * 计算目标日期距离基准日期的剩余整天数。
   *
   * @param targetDate - 待比较的到期日期
   * @param baseDate - 作为比较起点的当前日期
   * @returns 向上取整后的剩余天数
   */
  private calculateDaysLeft(targetDate: Date, baseDate: Date): number {
    return Math.ceil(
      (targetDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  /**
   * 将行政案件实体转换为首页到期提醒条目。
   *
   * @param adminCase - 已加载客户关联的行政案件实体
   * @param today - 当前时间，用于计算剩余天数
   * @param futureDateKey - 查询窗口结束日的本地日期键
   * @returns 命中查询窗口时返回提醒条目，否则返回 null
   */
  private buildAdminCaseExpiringItem(
    adminCase: AdminCase,
    today: Date,
    futureDateKey: string,
  ): ExpiringItem | null {
    if (!adminCase.expireDate) {
      return null;
    }

    const expireDate = new Date(adminCase.expireDate);
    const expireDateKey = this.toDateKey(expireDate);

    if (expireDateKey > futureDateKey) {
      return null;
    }

    return {
      id: adminCase.id,
      type: 'admin_case',
      title: adminCase.caseName,
      customerName: adminCase.customer?.customerName ?? '',
      customerId: adminCase.customerId,
      deadline: expireDateKey,
      daysLeft: this.calculateDaysLeft(expireDate, today),
      status: adminCase.status,
    };
  }

  /**
   * 将税务月次实体转换为首页申报告警条目。
   *
   * @param taxPeriod - 已加载客户关联的税务月次实体
   * @param today - 当前时间，用于计算剩余天数
   * @param futureDateKey - 查询窗口结束日的本地日期键
   * @returns 命中查询窗口时返回提醒条目，否则返回 null
   */
  private buildTaxPeriodExpiringItem(
    taxPeriod: TaxPeriod,
    today: Date,
    futureDateKey: string,
  ): ExpiringItem | null {
    if (!taxPeriod.declarationDeadline) {
      return null;
    }

    const deadline = new Date(taxPeriod.declarationDeadline);
    const deadlineKey = this.toDateKey(deadline);

    if (deadlineKey > futureDateKey) {
      return null;
    }

    return {
      id: taxPeriod.id,
      type: 'tax_deadline',
      title: `${taxPeriod.periodYm} 申告期限`,
      customerName: taxPeriod.customer?.customerName ?? '',
      customerId: taxPeriod.customerId,
      deadline: deadlineKey,
      daysLeft: this.calculateDaysLeft(deadline, today),
      status: taxPeriod.monthlyStatus,
    };
  }

  /**
   * 统一备注活动流的标题、摘要与创建人展示字段。
   *
   * @param note - 已加载客户与创建人关联的备注实体
   * @returns 可直接用于首页活动流展示的备注条目
   */
  private buildRecentNoteItem(note: Note): RecentActivityItem {
    return {
      id: note.id,
      type: 'note',
      title: `${note.noteType} メモ`,
      description: this.truncateText(note.content, 80),
      customerName: note.customer?.customerName ?? null,
      customerId: note.customerId,
      createdAt: note.createdAt.toISOString(),
      creatorName: note.creator?.displayName ?? null,
    };
  }

  /**
   * 统一文件活动流的标题、说明与上传人展示字段。
   *
   * @param file - 已加载上传人关联的文件实体
   * @returns 可直接用于首页活动流展示的文件条目
   */
  private buildRecentFileItem(file: FileEntity): RecentActivityItem {
    return {
      id: file.id,
      type: 'file',
      title: file.fileName,
      description: file.description || `${file.fileExt ?? ''} ファイル`,
      customerName: null,
      customerId: file.customerId,
      createdAt: file.createdAt.toISOString(),
      creatorName: file.uploader?.displayName ?? null,
    };
  }

  /**
   * 截断首页活动流中的长文本，避免备注摘要挤占卡片空间。
   *
   * @param text - 原始备注内容
   * @param maxLength - 允许保留的最大字符数
   * @returns 超长时追加省略号的文本摘要
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength)}...`;
  }
}
