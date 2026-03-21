import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { ConfigService } from '@nestjs/config'
import { Repository, Brackets } from 'typeorm'
import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { FileEntity } from './entities/file.entity'
import { FileAccessLog } from './entities/file-access-log.entity'
import { QueryFileDto } from './dto/query-file.dto'
import { UpdateFileDto } from './dto/update-file.dto'
import { BusinessType, FileAccessAction } from '../../common/constants/enums'

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.pdf',
  '.xlsx', '.xls', '.docx', '.doc',
  '.txt', '.csv',
])

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name)
  private readonly uploadDir: string
  private readonly maxSize: number

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(FileAccessLog)
    private readonly accessLogRepo: Repository<FileAccessLog>,
    private readonly configService: ConfigService,
  ) {
    this.uploadDir = this.configService.get<string>('FILE_UPLOAD_DIR', './uploads')
    this.maxSize = this.configService.get<number>('FILE_MAX_SIZE', 52_428_800) // 50MB
  }

  async upload(
    file: Express.Multer.File,
    businessType: BusinessType,
    userId: string,
    customerId?: string,
    relatedId?: string,
    description?: string,
  ): Promise<FileEntity> {
    const ext = path.extname(file.originalname).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      this.cleanupTempFile(file.path)
      throw new BadRequestException(
        `許可されていないファイル形式です: ${ext}`,
      )
    }

    if (file.size > this.maxSize) {
      this.cleanupTempFile(file.path)
      throw new BadRequestException(
        `ファイルサイズが上限（${Math.round(this.maxSize / 1024 / 1024)}MB）を超えています`,
      )
    }

    const now = new Date()
    const year = now.getFullYear().toString()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const fileUuid = uuidv4()
    const storedName = `${fileUuid}${ext}`

    const relDir = path.join(businessType, year, month)
    const absDir = path.resolve(this.uploadDir, relDir)
    fs.mkdirSync(absDir, { recursive: true })

    const absPath = path.join(absDir, storedName)
    fs.renameSync(file.path, absPath)

    const relPath = path.join(relDir, storedName)

    const entity = this.fileRepo.create({
      customerId: customerId || null,
      businessType,
      relatedId: relatedId || null,
      fileName: file.originalname,
      description: description || null,
      filePath: relPath,
      fileExt: ext,
      fileSize: file.size,
      mimeType: MIME_MAP[ext] || file.mimetype,
      uploadedBy: userId,
    })

    const saved = await this.fileRepo.save(entity)
    this.logger.log(`File uploaded: ${saved.id} (${file.originalname}) by user ${userId}`)
    return this.findOne(saved.id)
  }

  async findAll(query: QueryFileDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      sortBy,
      sortOrder = 'DESC',
    } = query

    const qb = this.fileRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.uploader', 'u')

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('f.fileName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('f.description ILIKE :kw', { kw: `%${keyword}%` })
        }),
      )
    }

    if (query.businessType) {
      qb.andWhere('f.businessType = :bt', { bt: query.businessType })
    }

    if (query.customerId) {
      qb.andWhere('f.customerId = :cid', { cid: query.customerId })
    }

    if (query.relatedId) {
      qb.andWhere('f.relatedId = :rid', { rid: query.relatedId })
    }

    if (query.uploadedBy) {
      qb.andWhere('f.uploadedBy = :uid', { uid: query.uploadedBy })
    }

    if (query.fileExt) {
      qb.andWhere('f.fileExt = :ext', { ext: query.fileExt })
    }

    const allowedSortFields = [
      'fileName',
      'fileSize',
      'businessType',
      'createdAt',
      'updatedAt',
    ]
    const orderField =
      sortBy && allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'
    qb.orderBy(`f.${orderField}`, sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((f) => this.toResponseDto(f)),
      total,
      page,
      pageSize,
    }
  }

  async findOne(id: string): Promise<FileEntity> {
    const file = await this.fileRepo.findOne({
      where: { id },
      relations: ['uploader'],
    })

    if (!file) {
      throw new NotFoundException('ファイルが見つかりません')
    }

    return file
  }

  async getDownloadInfo(
    id: string,
    userId: string,
    ip?: string,
  ): Promise<{ absPath: string; fileName: string; mimeType: string }> {
    const file = await this.findOne(id)
    const absPath = path.resolve(this.uploadDir, file.filePath)

    if (!fs.existsSync(absPath)) {
      throw new NotFoundException('ファイルの実体が見つかりません')
    }

    await this.logAccess(id, userId, FileAccessAction.DOWNLOAD, ip)

    return {
      absPath,
      fileName: file.fileName,
      mimeType: file.mimeType || 'application/octet-stream',
    }
  }

  async getPreviewInfo(
    id: string,
    userId: string,
    ip?: string,
  ): Promise<{ absPath: string; fileName: string; mimeType: string }> {
    const file = await this.findOne(id)
    const absPath = path.resolve(this.uploadDir, file.filePath)

    if (!fs.existsSync(absPath)) {
      throw new NotFoundException('ファイルの実体が見つかりません')
    }

    const previewable = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf']
    if (!file.fileExt || !previewable.includes(file.fileExt)) {
      throw new BadRequestException('このファイル形式はプレビューに対応していません')
    }

    await this.logAccess(id, userId, FileAccessAction.VIEW, ip)

    return {
      absPath,
      fileName: file.fileName,
      mimeType: file.mimeType || 'application/octet-stream',
    }
  }

  async update(id: string, dto: UpdateFileDto): Promise<FileEntity> {
    const file = await this.findOne(id)

    if (dto.fileName !== undefined) file.fileName = dto.fileName
    if (dto.description !== undefined) file.description = dto.description
    if (dto.businessType !== undefined) file.businessType = dto.businessType

    await this.fileRepo.save(file)
    this.logger.log(`File metadata updated: ${id}`)
    return this.findOne(id)
  }

  async remove(id: string, userId: string, ip?: string): Promise<void> {
    const file = await this.findOne(id)
    await this.logAccess(id, userId, FileAccessAction.DELETE, ip)
    await this.fileRepo.softRemove(file)
    this.logger.log(`File soft-deleted: ${id} (${file.fileName})`)
  }

  private async logAccess(
    fileId: string,
    userId: string,
    action: FileAccessAction,
    ip?: string,
  ): Promise<void> {
    const log = this.accessLogRepo.create({
      fileId,
      userId,
      action,
      ipAddress: ip || null,
    })
    await this.accessLogRepo.save(log)
  }

  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch {
      this.logger.warn(`Failed to cleanup temp file: ${filePath}`)
    }
  }

  private toResponseDto(file: FileEntity) {
    return {
      id: file.id,
      customerId: file.customerId,
      businessType: file.businessType,
      relatedId: file.relatedId,
      fileName: file.fileName,
      description: file.description,
      fileExt: file.fileExt,
      fileSize: file.fileSize ? Number(file.fileSize) : null,
      mimeType: file.mimeType,
      uploadedBy: file.uploadedBy,
      uploaderName: file.uploader?.displayName ?? null,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    }
  }
}
