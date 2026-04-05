import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { NoteType } from '../../common/constants/enums';
import { CreateNoteDto } from './dto/create-note.dto';
import { QueryNoteDto } from './dto/query-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { Customer } from './entities/customer.entity';
import { Note } from './entities/note.entity';

type NoteResponseDto = {
  id: string;
  customerId: string;
  content: string;
  noteType: NoteType;
  submittedItems: string | null;
  missingItems: string | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type NoteListResponse = {
  items: NoteResponseDto[];
  total: number;
  page: number;
  pageSize: number;
};

@Injectable()
export class NoteService {
  private readonly logger = new Logger(NoteService.name);

  constructor(
    @InjectRepository(Note)
    private readonly noteRepo: Repository<Note>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
  ) {}

  /**
   * 为指定客户创建一条新备注并返回带创建人信息的最新实体。
   *
   * @param customerId - 备注所属客户 ID
   * @param dto - 包含备注内容与备注类型的创建参数
   * @param userId - 当前登录用户 ID，省略时按匿名来源写入空值
   * @returns 已持久化且加载了创建人关联信息的备注实体
   * @throws {NotFoundException} 目标客户不存在时
   */
  async create(
    customerId: string,
    dto: CreateNoteDto,
    userId?: string,
  ): Promise<Note> {
    await this.ensureCustomerExists(customerId);

    const note = this.noteRepo.create({
      customerId,
      content: dto.content,
      noteType: dto.noteType ?? NoteType.GENERAL,
      submittedItems: this.normalizeOptionalText(dto.submittedItems),
      missingItems: this.normalizeOptionalText(dto.missingItems),
      nextAction: this.normalizeOptionalText(dto.nextAction),
      nextFollowUpAt: this.parseNextFollowUpAt(dto.nextFollowUpAt),
      createdBy: userId ?? null,
    });

    const saved = await this.noteRepo.save(note);
    this.logger.log(
      `Note created for customer ${customerId} by user ${userId}`,
    );
    return this.findOne(customerId, saved.id);
  }

  /**
   * 分页查询指定客户的备注列表并展开创建人展示名称。
   *
   * @param customerId - 备注所属客户 ID
   * @param query - 分页、类型过滤与排序方向查询参数
   * @returns 包含备注列表和分页信息的结果对象
   * @throws {NotFoundException} 目标客户不存在时
   */
  async findAll(
    customerId: string,
    query: QueryNoteDto,
  ): Promise<NoteListResponse> {
    await this.ensureCustomerExists(customerId);

    const { page = 1, pageSize = 20, noteType, sortOrder = 'DESC' } = query;

    const qb = this.noteRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.creator', 'creator')
      .where('n.customerId = :customerId', { customerId })
      .andWhere('n.visaCaseId IS NULL');

    if (noteType) {
      qb.andWhere('n.noteType = :noteType', { noteType });
    }

    qb.orderBy('n.createdAt', sortOrder);
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((n) => this.toResponseDto(n)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 按客户范围读取单条备注详情，避免跨客户访问越权数据。
   *
   * @param customerId - 备注所属客户 ID
   * @param noteId - 备注主键 ID
   * @returns 匹配客户范围且已加载创建人信息的备注实体
   * @throws {NotFoundException} 备注不存在或不属于该客户时
   */
  async findOne(customerId: string, noteId: string): Promise<Note> {
    const note = await this.noteRepo.findOne({
      where: { id: noteId, customerId, visaCaseId: IsNull() },
      relations: ['creator'],
    });

    if (!note) {
      throw new NotFoundException('メモが見つかりません');
    }

    return note;
  }

  /**
   * 更新指定客户备注的内容或类型并返回最新实体。
   *
   * @param customerId - 备注所属客户 ID
   * @param noteId - 需要更新的备注 ID
   * @param dto - 包含可选更新字段的备注修改参数
   * @returns 更新完成后重新加载的备注实体
   * @throws {NotFoundException} 备注不存在或不属于该客户时
   */
  async update(
    customerId: string,
    noteId: string,
    dto: UpdateNoteDto,
  ): Promise<Note> {
    const note = await this.findOne(customerId, noteId);

    if (dto.content !== undefined) note.content = dto.content;
    if (dto.noteType !== undefined) note.noteType = dto.noteType;
    if (dto.submittedItems !== undefined) {
      note.submittedItems = this.normalizeOptionalText(dto.submittedItems);
    }
    if (dto.missingItems !== undefined) {
      note.missingItems = this.normalizeOptionalText(dto.missingItems);
    }
    if (dto.nextAction !== undefined) {
      note.nextAction = this.normalizeOptionalText(dto.nextAction);
    }
    if (dto.nextFollowUpAt !== undefined) {
      note.nextFollowUpAt = this.parseNextFollowUpAt(dto.nextFollowUpAt);
    }

    await this.noteRepo.save(note);
    this.logger.log(`Note ${noteId} updated for customer ${customerId}`);
    return this.findOne(customerId, noteId);
  }

  /**
   * 对指定客户备注执行逻辑删除，保留审计追踪数据。
   *
   * @param customerId - 备注所属客户 ID
   * @param noteId - 需要逻辑删除的备注 ID
   * @throws {NotFoundException} 备注不存在或不属于该客户时
   */
  async remove(customerId: string, noteId: string): Promise<void> {
    const note = await this.findOne(customerId, noteId);
    await this.noteRepo.softRemove(note);
    this.logger.log(`Note ${noteId} soft-deleted for customer ${customerId}`);
  }

  /**
   * 校验备注操作目标客户是否存在，避免写入孤儿备注。
   *
   * @param customerId - 需要校验的客户 ID
   * @throws {NotFoundException} 客户不存在时
   */
  private async ensureCustomerExists(customerId: string): Promise<void> {
    const exists = await this.customerRepo.count({ where: { id: customerId } });
    if (!exists) {
      throw new NotFoundException('顧客が見つかりません');
    }
  }

  /**
   * 将备注实体压平成控制器列表接口所需的响应结构。
   *
   * @param note - 已加载创建人关联信息的备注实体
   * @returns 适用于前端展示的备注响应对象
   */
  private toResponseDto(note: Note): NoteResponseDto {
    return {
      id: note.id,
      customerId: note.customerId,
      content: note.content,
      noteType: note.noteType,
      submittedItems: note.submittedItems ?? null,
      missingItems: note.missingItems ?? null,
      nextAction: note.nextAction ?? null,
      nextFollowUpAt: note.nextFollowUpAt
        ? note.nextFollowUpAt.toISOString()
        : null,
      createdBy: note.createdBy,
      creatorName: note.creator?.displayName ?? null,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }

  /**
   * 将可选多行文本入参规范为数据库可写入的空串或裁剪后内容。
   *
   * @param value - 请求体中的可选字符串字段
   * @returns 去除首尾空白后的非空串，否则为 null
   */
  private normalizeOptionalText(value: string | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const t = value.trim();
    return t.length > 0 ? t : null;
  }

  /**
   * 将 ISO8601 跟进时间字符串解析为可持久化的日期或空值。
   *
   * @param value - 可选日期时间字符串；空串与 null 视为清空
   * @returns 有效时区时间戳，未提供或无法解析时为 null
   */
  private parseNextFollowUpAt(value: string | undefined | null): Date | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
}
