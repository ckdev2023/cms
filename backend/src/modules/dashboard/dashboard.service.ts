import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, In, LessThanOrEqual, MoreThanOrEqual, IsNull, Not } from 'typeorm'
import { Customer } from '../customer/entities/customer.entity'
import { AdminCase } from '../admin-case/entities/admin-case.entity'
import { TaxPeriod } from '../tax/entities/tax-period.entity'
import { TaxContract } from '../tax/entities/tax-contract.entity'
import { Invoice } from '../finance/entities/invoice.entity'
import { Note } from '../customer/entities/note.entity'
import { FileEntity } from '../file/entities/file.entity'
import {
  CustomerStatus,
  AdminCaseStatus,
  InvoiceStatus,
  TaxContractStatus,
  MonthlyStatus,
} from '../../common/constants/enums'

export interface DashboardSummary {
  activeCustomers: number
  activeCases: number
  pendingInvoices: number
  activeContracts: number
}

export interface ExpiringItem {
  id: string
  type: 'admin_case' | 'tax_deadline'
  title: string
  customerName: string
  customerId: string
  deadline: string
  daysLeft: number
  status: string
}

export interface FinanceSummary {
  draftCount: number
  draftAmount: number
  sentCount: number
  sentAmount: number
  partialCount: number
  partialAmount: number
  overdueCount: number
  overdueAmount: number
  monthlyCollected: number
  monthlyCollectedCount: number
}

export interface RecentActivityItem {
  id: string
  type: 'note' | 'file'
  title: string
  description: string
  customerName: string | null
  customerId: string | null
  createdAt: string
  creatorName: string | null
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

  async getSummary(): Promise<DashboardSummary> {
    const [activeCustomers, activeCases, pendingInvoices, activeContracts] =
      await Promise.all([
        this.customerRepo.count({
          where: { status: CustomerStatus.ACTIVE },
        }),
        this.adminCaseRepo.count({
          where: {
            status: In([
              AdminCaseStatus.DRAFT,
              AdminCaseStatus.ACCEPTED,
              AdminCaseStatus.MATERIAL_PENDING,
              AdminCaseStatus.SUBMITTED,
            ]),
          },
        }),
        this.invoiceRepo.count({
          where: {
            status: In([
              InvoiceStatus.DRAFT,
              InvoiceStatus.SENT,
              InvoiceStatus.PARTIAL,
            ]),
          },
        }),
        this.taxContractRepo.count({
          where: { contractStatus: TaxContractStatus.ACTIVE },
        }),
      ])

    return { activeCustomers, activeCases, pendingInvoices, activeContracts }
  }

  async getExpiringItems(days = 30): Promise<ExpiringItem[]> {
    const today = new Date()
    const futureDate = new Date()
    futureDate.setDate(today.getDate() + days)
    const todayStr = today.toISOString().split('T')[0]
    const futureStr = futureDate.toISOString().split('T')[0]

    const [adminCases, taxPeriods] = await Promise.all([
      this.adminCaseRepo.find({
        where: {
          expireDate: Not(IsNull()),
          status: In([
            AdminCaseStatus.DRAFT,
            AdminCaseStatus.ACCEPTED,
            AdminCaseStatus.MATERIAL_PENDING,
            AdminCaseStatus.SUBMITTED,
          ]),
        },
        relations: ['customer'],
        order: { expireDate: 'ASC' },
      }),
      this.taxPeriodRepo.find({
        where: {
          declarationDeadline: Not(IsNull()),
          monthlyStatus: In([
            MonthlyStatus.NOT_STARTED,
            MonthlyStatus.IN_PROGRESS,
          ]),
        },
        relations: ['customer'],
        order: { declarationDeadline: 'ASC' },
      }),
    ])

    const items: ExpiringItem[] = []

    for (const ac of adminCases) {
      if (!ac.expireDate) continue
      const expDate = new Date(ac.expireDate)
      const expStr = expDate.toISOString().split('T')[0]
      if (expStr > futureStr) continue
      const daysLeft = Math.ceil(
        (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      )
      items.push({
        id: ac.id,
        type: 'admin_case',
        title: ac.caseName,
        customerName: ac.customer?.customerName ?? '',
        customerId: ac.customerId,
        deadline: expStr,
        daysLeft,
        status: ac.status,
      })
    }

    for (const tp of taxPeriods) {
      if (!tp.declarationDeadline) continue
      const dlDate = new Date(tp.declarationDeadline)
      const dlStr = dlDate.toISOString().split('T')[0]
      if (dlStr > futureStr) continue
      const daysLeft = Math.ceil(
        (dlDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      )
      items.push({
        id: tp.id,
        type: 'tax_deadline',
        title: `${tp.periodYm} 申告期限`,
        customerName: tp.customer?.customerName ?? '',
        customerId: tp.customerId,
        deadline: dlStr,
        daysLeft,
        status: tp.monthlyStatus,
      })
    }

    items.sort((a, b) => a.daysLeft - b.daysLeft)
    return items.slice(0, 20)
  }

  async getFinanceSummary(): Promise<FinanceSummary> {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`

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
      ])

    const sumAmount = (list: { totalAmount: number }[]) =>
      list.reduce((sum, i) => sum + Number(i.totalAmount || 0), 0)

    const overdueList = [...sentInvoices, ...partialInvoices].filter(
      (inv) => inv.dueDate && new Date(inv.dueDate).toISOString().split('T')[0] < todayStr,
    )

    const monthlyPaid = allSentOrPartial.filter(
      (inv) => inv.updatedAt && inv.updatedAt.toISOString().split('T')[0] >= monthStart,
    )

    return {
      draftCount: draftInvoices.length,
      draftAmount: sumAmount(draftInvoices),
      sentCount: sentInvoices.length,
      sentAmount: sumAmount(sentInvoices),
      partialCount: partialInvoices.length,
      partialAmount: sumAmount(partialInvoices),
      overdueCount: overdueList.length,
      overdueAmount: sumAmount(overdueList),
      monthlyCollected: sumAmount(monthlyPaid),
      monthlyCollectedCount: monthlyPaid.length,
    }
  }

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
    ])

    const items: RecentActivityItem[] = []

    for (const note of recentNotes) {
      items.push({
        id: note.id,
        type: 'note',
        title: `${note.noteType} メモ`,
        description:
          note.content.length > 80
            ? note.content.slice(0, 80) + '...'
            : note.content,
        customerName: note.customer?.customerName ?? null,
        customerId: note.customerId,
        createdAt: note.createdAt.toISOString(),
        creatorName: note.creator?.displayName ?? null,
      })
    }

    for (const file of recentFiles) {
      items.push({
        id: file.id,
        type: 'file',
        title: file.fileName,
        description: file.description || `${file.fileExt ?? ''} ファイル`,
        customerName: null,
        customerId: file.customerId,
        createdAt: file.createdAt.toISOString(),
        creatorName: file.uploader?.displayName ?? null,
      })
    }

    items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    return items.slice(0, limit)
  }
}
