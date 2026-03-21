import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, Brackets } from 'typeorm'
import { AdminCase } from './entities/admin-case.entity'
import { AdminCaseInterview } from './entities/admin-case-interview.entity'
import { AdminCaseDocument } from './entities/admin-case-document.entity'
import { CreateAdminCaseDto } from './dto/create-admin-case.dto'
import { UpdateAdminCaseDto } from './dto/update-admin-case.dto'
import { QueryAdminCaseDto } from './dto/query-admin-case.dto'
import { CreateInterviewDto } from './dto/create-interview.dto'
import { UpdateInterviewDto } from './dto/update-interview.dto'
import { QueryInterviewDto } from './dto/query-interview.dto'
import { CreateAdminCaseDocumentDto } from './dto/create-document.dto'
import { UpdateAdminCaseDocumentDto } from './dto/update-document.dto'
import { AdminCaseStatus } from '../../common/constants/enums'

const STATUS_TRANSITIONS: Record<AdminCaseStatus, AdminCaseStatus[]> = {
  [AdminCaseStatus.DRAFT]: [AdminCaseStatus.ACCEPTED, AdminCaseStatus.CANCELLED],
  [AdminCaseStatus.ACCEPTED]: [AdminCaseStatus.MATERIAL_PENDING, AdminCaseStatus.CANCELLED],
  [AdminCaseStatus.MATERIAL_PENDING]: [AdminCaseStatus.SUBMITTED, AdminCaseStatus.CANCELLED],
  [AdminCaseStatus.SUBMITTED]: [AdminCaseStatus.APPROVED, AdminCaseStatus.REJECTED],
  [AdminCaseStatus.APPROVED]: [AdminCaseStatus.COMPLETED],
  [AdminCaseStatus.REJECTED]: [AdminCaseStatus.MATERIAL_PENDING, AdminCaseStatus.CANCELLED],
  [AdminCaseStatus.COMPLETED]: [],
  [AdminCaseStatus.CANCELLED]: [],
}

@Injectable()
export class AdminCaseService {
  private readonly logger = new Logger(AdminCaseService.name)

  constructor(
    @InjectRepository(AdminCase)
    private readonly caseRepo: Repository<AdminCase>,
    @InjectRepository(AdminCaseInterview)
    private readonly interviewRepo: Repository<AdminCaseInterview>,
    @InjectRepository(AdminCaseDocument)
    private readonly documentRepo: Repository<AdminCaseDocument>,
  ) {}

  // ── Cases ─────────────────────────────────────────────

  async create(dto: CreateAdminCaseDto, userId?: string): Promise<AdminCase> {
    const adminCase = this.caseRepo.create({
      customerId: dto.customerId,
      caseName: dto.caseName,
      applicantName: dto.applicantName ?? null,
      residenceStatus: dto.residenceStatus ?? null,
      status: dto.status ?? AdminCaseStatus.DRAFT,
      expireDate: dto.expireDate ? new Date(dto.expireDate) : null,
      ownerUserId: dto.ownerUserId ?? null,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    })

    const saved = await this.caseRepo.save(adminCase)
    this.logger.log(`AdminCase "${saved.id}" created by user ${userId}`)
    return this.findOne(saved.id)
  }

  async findAll(query: QueryAdminCaseDto) {
    const { page = 1, pageSize = 20, keyword, sortBy, sortOrder = 'DESC' } = query

    const qb = this.caseRepo
      .createQueryBuilder('ac')
      .leftJoinAndSelect('ac.customer', 'customer')
      .leftJoinAndSelect('ac.owner', 'owner')

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('ac.caseName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('ac.applicantName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('customer.customerName ILIKE :kw', { kw: `%${keyword}%` })
        }),
      )
    }

    if (query.status) {
      qb.andWhere('ac.status = :status', { status: query.status })
    }

    if (query.customerId) {
      qb.andWhere('ac.customerId = :customerId', { customerId: query.customerId })
    }

    if (query.ownerUserId) {
      qb.andWhere('ac.ownerUserId = :ownerUserId', { ownerUserId: query.ownerUserId })
    }

    if (query.expireDateFrom) {
      qb.andWhere('ac.expireDate >= :from', { from: query.expireDateFrom })
    }

    if (query.expireDateTo) {
      qb.andWhere('ac.expireDate <= :to', { to: query.expireDateTo })
    }

    const allowedSortFields = [
      'caseName',
      'status',
      'expireDate',
      'createdAt',
      'updatedAt',
    ]
    const orderField = sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    qb.orderBy(`ac.${orderField}`, sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((c) => this.toCaseListDto(c)),
      total,
      page,
      pageSize,
    }
  }

  async findOne(id: string): Promise<AdminCase> {
    const adminCase = await this.caseRepo.findOne({
      where: { id },
      relations: ['customer', 'owner', 'interviews', 'interviews.creator'],
    })

    if (!adminCase) {
      throw new NotFoundException('案件が見つかりません')
    }

    return adminCase
  }

  async update(id: string, dto: UpdateAdminCaseDto, userId?: string): Promise<AdminCase> {
    const adminCase = await this.findOne(id)

    if (dto.caseName !== undefined) adminCase.caseName = dto.caseName
    if (dto.applicantName !== undefined) adminCase.applicantName = dto.applicantName ?? null
    if (dto.residenceStatus !== undefined) adminCase.residenceStatus = dto.residenceStatus ?? null
    if (dto.expireDate !== undefined) adminCase.expireDate = dto.expireDate ? new Date(dto.expireDate) : null
    if (dto.ownerUserId !== undefined) adminCase.ownerUserId = dto.ownerUserId ?? null
    if (dto.customerId !== undefined) adminCase.customerId = dto.customerId
    adminCase.updatedBy = userId ?? null

    await this.caseRepo.save(adminCase)
    this.logger.log(`AdminCase "${id}" updated by user ${userId}`)
    return this.findOne(id)
  }

  async updateStatus(
    id: string,
    newStatus: AdminCaseStatus,
    userId?: string,
  ): Promise<AdminCase> {
    const adminCase = await this.findOne(id)
    const allowed = STATUS_TRANSITIONS[adminCase.status]

    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `ステータスを「${adminCase.status}」から「${newStatus}」に変更できません`,
      )
    }

    adminCase.status = newStatus
    adminCase.updatedBy = userId ?? null
    await this.caseRepo.save(adminCase)

    this.logger.log(`AdminCase "${id}" status changed to ${newStatus} by user ${userId}`)
    return this.findOne(id)
  }

  async remove(id: string): Promise<void> {
    const adminCase = await this.findOne(id)
    await this.caseRepo.softRemove(adminCase)
    this.logger.log(`AdminCase "${id}" soft-deleted`)
  }

  async restore(id: string) {
    const adminCase = await this.caseRepo.findOne({
      where: { id },
      withDeleted: true,
    })
    if (!adminCase) throw new NotFoundException('案件が見つかりません')
    if (!adminCase.deletedAt) throw new BadRequestException('この案件は削除されていません')
    await this.caseRepo.recover(adminCase)
    this.logger.log(`AdminCase "${id}" restored`)
    return this.findOne(id)
  }

  getAvailableTransitions(status: AdminCaseStatus): AdminCaseStatus[] {
    return STATUS_TRANSITIONS[status] ?? []
  }

  async findByCustomer(customerId: string, query: QueryAdminCaseDto) {
    return this.findAll({ ...query, customerId })
  }

  // ── Interviews ────────────────────────────────────────

  async createInterview(
    caseId: string,
    dto: CreateInterviewDto,
    userId?: string,
  ): Promise<AdminCaseInterview> {
    const adminCase = await this.findOne(caseId)

    const interview = this.interviewRepo.create({
      adminCaseId: caseId,
      customerId: dto.customerId ?? adminCase.customerId,
      interviewDate: new Date(dto.interviewDate),
      interviewLocation: dto.interviewLocation ?? null,
      content: dto.content,
      createdBy: userId ?? null,
    })

    const saved = await this.interviewRepo.save(interview)
    this.logger.log(`Interview "${saved.id}" created for case "${caseId}" by user ${userId}`)
    return this.findInterview(saved.id)
  }

  async findInterviews(caseId: string, query: QueryInterviewDto) {
    const { page = 1, pageSize = 20, sortOrder = 'DESC' } = query

    const qb = this.interviewRepo
      .createQueryBuilder('iv')
      .leftJoinAndSelect('iv.creator', 'creator')
      .where('iv.adminCaseId = :caseId', { caseId })

    if (query.dateFrom) {
      qb.andWhere('iv.interviewDate >= :dateFrom', { dateFrom: query.dateFrom })
    }

    if (query.dateTo) {
      qb.andWhere('iv.interviewDate <= :dateTo', { dateTo: query.dateTo })
    }

    qb.orderBy('iv.interviewDate', sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((iv) => this.toInterviewDto(iv)),
      total,
      page,
      pageSize,
    }
  }

  async findInterview(id: string): Promise<AdminCaseInterview> {
    const interview = await this.interviewRepo.findOne({
      where: { id },
      relations: ['creator'],
    })

    if (!interview) {
      throw new NotFoundException('面談記録が見つかりません')
    }

    return interview
  }

  async updateInterview(
    id: string,
    dto: UpdateInterviewDto,
    userId?: string,
  ): Promise<AdminCaseInterview> {
    const interview = await this.findInterview(id)

    if (dto.interviewDate !== undefined) interview.interviewDate = new Date(dto.interviewDate)
    if (dto.interviewLocation !== undefined) interview.interviewLocation = dto.interviewLocation ?? null
    if (dto.content !== undefined) interview.content = dto.content
    if (dto.customerId !== undefined) interview.customerId = dto.customerId

    await this.interviewRepo.save(interview)
    this.logger.log(`Interview "${id}" updated by user ${userId}`)
    return this.findInterview(id)
  }

  async removeInterview(id: string): Promise<void> {
    const interview = await this.findInterview(id)
    await this.interviewRepo.softRemove(interview)
    this.logger.log(`Interview "${id}" soft-deleted`)
  }

  // ── Documents ────────────────────────────────────────

  async findDocuments(caseId: string): Promise<AdminCaseDocument[]> {
    await this.findOne(caseId)
    return this.documentRepo.find({
      where: { adminCaseId: caseId },
      relations: ['file', 'file.uploader'],
      order: { createdAt: 'DESC' },
    })
  }

  async createDocument(
    caseId: string,
    dto: CreateAdminCaseDocumentDto,
  ): Promise<AdminCaseDocument> {
    await this.findOne(caseId)

    const doc = this.documentRepo.create({
      adminCaseId: caseId,
      fileId: dto.fileId,
      documentType: dto.documentType ?? null,
      remark: dto.remark ?? null,
    })

    const saved = await this.documentRepo.save(doc)
    this.logger.log(`AdminCaseDocument "${saved.id}" created for case "${caseId}"`)
    return this.findDocument(saved.id)
  }

  async findDocument(docId: string): Promise<AdminCaseDocument> {
    const doc = await this.documentRepo.findOne({
      where: { id: docId },
      relations: ['file', 'file.uploader'],
    })
    if (!doc) {
      throw new NotFoundException('書類が見つかりません')
    }
    return doc
  }

  async updateDocument(
    docId: string,
    dto: UpdateAdminCaseDocumentDto,
  ): Promise<AdminCaseDocument> {
    const doc = await this.findDocument(docId)
    if (dto.documentType !== undefined) doc.documentType = dto.documentType ?? null
    if (dto.remark !== undefined) doc.remark = dto.remark ?? null
    await this.documentRepo.save(doc)
    this.logger.log(`AdminCaseDocument "${docId}" updated`)
    return this.findDocument(docId)
  }

  async removeDocument(docId: string): Promise<void> {
    const doc = await this.findDocument(docId)
    await this.documentRepo.remove(doc)
    this.logger.log(`AdminCaseDocument "${docId}" removed`)
  }

  // ── Response Mappers ──────────────────────────────────

  private toCaseListDto(ac: AdminCase) {
    return {
      id: ac.id,
      customerId: ac.customerId,
      customerName: ac.customer?.customerName ?? null,
      caseName: ac.caseName,
      applicantName: ac.applicantName,
      residenceStatus: ac.residenceStatus,
      status: ac.status,
      expireDate: ac.expireDate,
      ownerUserId: ac.ownerUserId,
      ownerName: ac.owner?.displayName ?? null,
      createdBy: ac.createdBy,
      updatedBy: ac.updatedBy,
      createdAt: ac.createdAt,
      updatedAt: ac.updatedAt,
    }
  }

  private toInterviewDto(iv: AdminCaseInterview) {
    return {
      id: iv.id,
      adminCaseId: iv.adminCaseId,
      customerId: iv.customerId,
      interviewDate: iv.interviewDate,
      interviewLocation: iv.interviewLocation,
      content: iv.content,
      createdBy: iv.createdBy,
      creatorName: iv.creator?.displayName ?? null,
      createdAt: iv.createdAt,
      updatedAt: iv.updatedAt,
    }
  }

  toDocumentDto(doc: AdminCaseDocument) {
    return {
      id: doc.id,
      adminCaseId: doc.adminCaseId,
      fileId: doc.fileId,
      documentType: doc.documentType,
      remark: doc.remark,
      createdAt: doc.createdAt,
      file: doc.file
        ? {
            id: doc.file.id,
            fileName: doc.file.fileName,
            fileExt: doc.file.fileExt,
            fileSize: doc.file.fileSize ? Number(doc.file.fileSize) : null,
            mimeType: doc.file.mimeType,
            description: doc.file.description,
            uploaderName: doc.file.uploader?.displayName ?? null,
            createdAt: doc.file.createdAt,
          }
        : null,
    }
  }
}
