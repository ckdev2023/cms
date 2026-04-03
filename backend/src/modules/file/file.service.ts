import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Brackets, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { BusinessType, FileAccessAction } from '../../common/constants/enums';
import { QueryFileDto } from './dto/query-file.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { FileEntity } from './entities/file.entity';
import { FileAccessLog } from './entities/file-access-log.entity';

const DEFAULT_MAX_FILE_SIZE = 52_428_800;

const ALLOWED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
  '.xlsx',
  '.xls',
  '.docx',
  '.doc',
  '.txt',
  '.csv',
]);

const PREVIEWABLE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.pdf',
]);

const ALLOWED_SORT_FIELDS = [
  'fileName',
  'fileSize',
  'businessType',
  'createdAt',
  'updatedAt',
] as const;

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

type FileSortField = (typeof ALLOWED_SORT_FIELDS)[number];

interface FileTransferInfo {
  absPath: string;
  fileName: string;
  mimeType: string;
}

export interface FileResponseDto {
  id: string;
  customerId: string | null;
  businessType: BusinessType;
  relatedId: string | null;
  fileName: string;
  description: string | null;
  fileExt: string | null;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  uploaderName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileListResult {
  items: FileResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private readonly uploadDir: string;
  private readonly maxSize: number;

  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepo: Repository<FileEntity>,
    @InjectRepository(FileAccessLog)
    private readonly accessLogRepo: Repository<FileAccessLog>,
    private readonly configService: ConfigService,
  ) {
    this.uploadDir = this.configService.get<string>(
      'FILE_UPLOAD_DIR',
      './uploads',
    );
    this.maxSize = this.configService.get<number>(
      'FILE_MAX_SIZE',
      DEFAULT_MAX_FILE_SIZE,
    );
  }

  /**
   * 校验上传文件后写入正式目录并持久化附件元数据。
   *
   * @param file - Multer 暂存文件对象
   * @param businessType - 附件所属业务类型
   * @param userId - 当前上传人的用户 ID
   * @param customerId - 关联客户 ID，可为空
   * @param relatedId - 关联业务记录 ID，可为空
   * @param description - 附件说明，可为空
   * @returns 带上传人关系的最新附件实体
   * @throws {BadRequestException} 文件扩展名不被允许或大小超限时抛出
   */
  async upload(
    file: Express.Multer.File,
    businessType: BusinessType,
    userId: string,
    customerId?: string,
    relatedId?: string,
    description?: string,
  ): Promise<FileEntity> {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      this.cleanupTempFile(file.path);
      throw new BadRequestException(`許可されていないファイル形式です: ${ext}`);
    }

    if (file.size > this.maxSize) {
      this.cleanupTempFile(file.path);
      throw new BadRequestException(
        `ファイルサイズが上限（${Math.round(this.maxSize / 1024 / 1024)}MB）を超えています`,
      );
    }

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileUuid = uuidv4();
    const storedName = `${fileUuid}${ext}`;

    const relDir = path.join(businessType, year, month);
    const absDir = path.resolve(this.uploadDir, relDir);
    fs.mkdirSync(absDir, { recursive: true });

    const absPath = path.join(absDir, storedName);
    fs.renameSync(file.path, absPath);

    const relPath = path.join(relDir, storedName);
    const entity = this.fileRepo.create({
      customerId: customerId ?? null,
      businessType,
      relatedId: relatedId ?? null,
      fileName: file.originalname,
      description: description ?? null,
      filePath: relPath,
      fileExt: ext,
      fileSize: file.size,
      mimeType: MIME_MAP[ext] ?? file.mimetype,
      uploadedBy: userId,
    });

    const saved = await this.fileRepo.save(entity);
    this.logger.log(
      `File uploaded: ${saved.id} (${file.originalname}) by user ${userId}`,
    );

    return this.findOne(saved.id);
  }

  /**
   * 按关键字、业务归属和分页条件查询附件列表。
   *
   * @param query - 附件分页筛选参数
   * @returns 包含列表数据与分页信息的结果对象
   */
  async findAll(query: QueryFileDto): Promise<FileListResult> {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      sortBy,
      sortOrder = 'DESC',
    } = query;

    const qb = this.fileRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.uploader', 'u');

    if (keyword) {
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('f.fileName ILIKE :kw', { kw: `%${keyword}%` })
            .orWhere('f.description ILIKE :kw', { kw: `%${keyword}%` });
        }),
      );
    }

    if (query.businessType) {
      qb.andWhere('f.businessType = :bt', { bt: query.businessType });
    }

    if (query.customerId) {
      qb.andWhere('f.customerId = :cid', { cid: query.customerId });
    }

    if (query.relatedId) {
      qb.andWhere('f.relatedId = :rid', { rid: query.relatedId });
    }

    if (query.uploadedBy) {
      qb.andWhere('f.uploadedBy = :uid', { uid: query.uploadedBy });
    }

    if (query.fileExt) {
      qb.andWhere('f.fileExt = :ext', { ext: query.fileExt });
    }

    const orderField = this.resolveSortField(sortBy);
    qb.orderBy(`f.${orderField}`, sortOrder);
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((fileEntity) => this.toResponseDto(fileEntity)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 根据主键读取附件实体及上传人信息。
   *
   * @param id - 附件主键 UUID
   * @returns 对应的附件实体
   * @throws {NotFoundException} 附件不存在时抛出
   */
  async findOne(id: string): Promise<FileEntity> {
    const file = await this.fileRepo.findOne({
      where: { id },
      relations: ['uploader'],
    });

    if (!file) {
      throw new NotFoundException('ファイルが見つかりません');
    }

    return file;
  }

  /**
   * 读取附件下载所需的物理路径与响应头信息，并记录下载日志。
   *
   * @param id - 附件主键 UUID
   * @param userId - 执行下载的用户 ID
   * @param ip - 请求来源 IP，可为空
   * @returns 下载接口直接使用的文件路径与 MIME 信息
   * @throws {NotFoundException} 附件记录或实体文件不存在时抛出
   */
  async getDownloadInfo(
    id: string,
    userId: string,
    ip?: string,
  ): Promise<FileTransferInfo> {
    const file = await this.resolveExistingFile(id);
    await this.logAccess(id, userId, FileAccessAction.DOWNLOAD, ip);

    return {
      absPath: path.resolve(this.uploadDir, file.filePath),
      fileName: file.fileName,
      mimeType: file.mimeType ?? 'application/octet-stream',
    };
  }

  /**
   * 校验附件可预览性后返回预览流所需信息，并记录查看日志。
   *
   * @param id - 附件主键 UUID
   * @param userId - 执行预览的用户 ID
   * @param ip - 请求来源 IP，可为空
   * @returns 预览接口直接使用的文件路径与 MIME 信息
   * @throws {NotFoundException} 附件记录或实体文件不存在时抛出
   * @throws {BadRequestException} 文件扩展名不支持在线预览时抛出
   */
  async getPreviewInfo(
    id: string,
    userId: string,
    ip?: string,
  ): Promise<FileTransferInfo> {
    const file = await this.resolveExistingFile(id);
    if (!file.fileExt || !PREVIEWABLE_EXTENSIONS.has(file.fileExt)) {
      throw new BadRequestException(
        'このファイル形式はプレビューに対応していません',
      );
    }

    await this.logAccess(id, userId, FileAccessAction.VIEW, ip);

    return {
      absPath: path.resolve(this.uploadDir, file.filePath),
      fileName: file.fileName,
      mimeType: file.mimeType ?? 'application/octet-stream',
    };
  }

  /**
   * 更新附件名称、说明和业务归属等可编辑元数据。
   *
   * @param id - 待更新附件的 UUID
   * @param dto - 允许修改的附件字段
   * @returns 更新后的附件实体
   * @throws {NotFoundException} 附件不存在时抛出
   */
  async update(id: string, dto: UpdateFileDto): Promise<FileEntity> {
    const file = await this.findOne(id);

    if (dto.fileName !== undefined) {
      file.fileName = dto.fileName;
    }

    if (dto.description !== undefined) {
      file.description = dto.description;
    }

    if (dto.businessType !== undefined) {
      file.businessType = dto.businessType;
    }

    await this.fileRepo.save(file);
    this.logger.log(`File metadata updated: ${id}`);

    return this.findOne(id);
  }

  /**
   * 软删除指定附件并补记删除访问日志。
   *
   * @param id - 待删除附件的 UUID
   * @param userId - 执行删除的用户 ID
   * @param ip - 请求来源 IP，可为空
   * @throws {NotFoundException} 附件不存在时抛出
   */
  async remove(id: string, userId: string, ip?: string): Promise<void> {
    const file = await this.findOne(id);
    await this.logAccess(id, userId, FileAccessAction.DELETE, ip);
    await this.fileRepo.softRemove(file);
    this.logger.log(`File soft-deleted: ${id} (${file.fileName})`);
  }

  /**
   * 解析排序字段，避免查询层接受未授权的动态列名。
   *
   * @param sortBy - 请求传入的排序字段
   * @returns 经白名单校验后的排序字段
   */
  private resolveSortField(sortBy?: string): FileSortField {
    return sortBy && ALLOWED_SORT_FIELDS.includes(sortBy as FileSortField)
      ? (sortBy as FileSortField)
      : 'createdAt';
  }

  /**
   * 读取附件并确认磁盘实体存在，供下载和预览流程复用。
   *
   * @param id - 附件主键 UUID
   * @returns 已确认实体文件存在的附件记录
   * @throws {NotFoundException} 附件记录或实体文件不存在时抛出
   */
  private async resolveExistingFile(id: string): Promise<FileEntity> {
    const file = await this.findOne(id);
    const absPath = path.resolve(this.uploadDir, file.filePath);

    if (!fs.existsSync(absPath)) {
      throw new NotFoundException('ファイルの実体が見つかりません');
    }

    return file;
  }

  /**
   * 写入附件访问日志，记录用户对附件的查看、下载和删除行为。
   *
   * @param fileId - 被访问附件的 UUID
   * @param userId - 当前操作用户的 UUID
   * @param action - 访问动作枚举
   * @param ip - 请求来源 IP，可为空
   */
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
      ipAddress: ip ?? null,
    });

    await this.accessLogRepo.save(log);
  }

  /**
   * 清理上传失败后遗留的 Multer 暂存文件，避免磁盘残留。
   *
   * @param filePath - 需要删除的临时文件绝对路径
   */
  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      this.logger.warn(`Failed to cleanup temp file: ${filePath}`);
    }
  }

  /**
   * 将附件实体映射为接口层返回的精简 DTO 结构。
   *
   * @param file - 带可选上传人关系的附件实体
   * @returns 供列表接口返回的附件响应对象
   */
  private toResponseDto(file: FileEntity): FileResponseDto {
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
    };
  }
}
