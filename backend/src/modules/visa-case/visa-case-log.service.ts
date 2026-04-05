import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Note } from '../customer/entities/note.entity';
import { CreateVisaCaseLogDto } from './dto/create-visa-case-log.dto';
import { QueryVisaCaseLogDto } from './dto/query-visa-case-log.dto';
import { UpdateVisaCaseLogDto } from './dto/update-visa-case-log.dto';
import { VisaCase } from './entities/visa-case.entity';
import { mapNoteToVisaCaseLogResponseDto } from './visa-case.mapper';
import type {
  VisaCaseLogListResponse,
  VisaCaseLogResponseDto,
} from './visa-case.types';
import { VisaCaseLookupService } from './visa-case-lookup.service';

/**
 * 管理签证案件在 notes 表上的结构化日志 CRUD，与案件主表解耦以降低 visa-case.service 体积。
 */
@Injectable()
export class VisaCaseLogService {
  private readonly logger = new Logger(VisaCaseLogService.name);

  constructor(
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
    @InjectRepository(Note)
    private readonly noteRepo: Repository<Note>,
    private readonly lookup: VisaCaseLookupService,
  ) {}

  /**
   * 为指定签证案件创建一条日志，写入 notes 表并关联 visa_case_id。
   *
   * 不修改 `visa_cases` 行：`dto.nextFollowUpAt` 仅存于 note，与客户详情主展示/列表 DISTINCT ON 使用的案件字段
   * `visa_cases.next_follow_up_at` 非同一列；两路并存时的产品口径与是否同步由需求单独定义。
   *
   * @param visaCaseId - 日志归属的签证案件 ID
   * @param dto - 包含日志类型、内容与结构化跟进字段的创建参数
   * @param userId - 当前登录用户 ID
   * @returns 已持久化且加载了创建人信息的日志响应对象
   * @throws {NotFoundException} 目标签证案件不存在时
   */
  async createLog(
    visaCaseId: string,
    dto: CreateVisaCaseLogDto,
    userId: string,
  ): Promise<VisaCaseLogResponseDto> {
    const visaCase = await this.visaCaseRepo.findOne({
      where: { id: visaCaseId },
    });
    if (!visaCase) {
      throw new NotFoundException('ビザ案件が見つかりません');
    }

    const note = this.noteRepo.create({
      customerId: visaCase.customerId,
      visaCaseId,
      logType: dto.logType,
      content: dto.content,
      submittedItems: dto.submittedItems ?? null,
      missingItems: dto.missingItems ?? null,
      nextAction: dto.nextAction ?? null,
      nextFollowUpAt: dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null,
      createdBy: userId,
    });

    const saved = await this.noteRepo.save(note);
    this.logger.log(
      `Case log created for visa case ${visaCaseId} by user ${userId}`,
    );
    return this.findOneLog(visaCaseId, saved.id);
  }

  /**
   * 分页查询指定签证案件的日志列表并展开创建人展示名称。
   *
   * @param visaCaseId - 日志归属的签证案件 ID
   * @param query - 分页、日志类型筛选查询参数
   * @returns 包含日志列表和分页信息的结果对象
   * @throws {NotFoundException} 目标签证案件不存在时
   */
  async findLogs(
    visaCaseId: string,
    query: QueryVisaCaseLogDto,
  ): Promise<VisaCaseLogListResponse> {
    await this.lookup.ensureVisaCaseExists(visaCaseId);

    const { page = 1, pageSize = 20, logType, sortOrder = 'DESC' } = query;

    const qb = this.noteRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.creator', 'creator')
      .where('n.visaCaseId = :visaCaseId', { visaCaseId })
      .andWhere('n.deletedAt IS NULL');

    if (logType) {
      qb.andWhere('n.logType = :logType', { logType });
    }

    qb.orderBy('n.createdAt', sortOrder);
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((n) => mapNoteToVisaCaseLogResponseDto(n)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 按案件范围读取单条日志详情，避免跨案件访问越权数据。
   *
   * @param visaCaseId - 日志归属的签证案件 ID
   * @param logId - 日志主键 ID
   * @returns 匹配案件范围且已加载创建人信息的日志响应对象
   * @throws {NotFoundException} 日志不存在或不属于该案件时
   */
  async findOneLog(
    visaCaseId: string,
    logId: string,
  ): Promise<VisaCaseLogResponseDto> {
    const note = await this.noteRepo.findOne({
      where: { id: logId, visaCaseId },
      relations: ['creator'],
    });

    if (!note) {
      throw new NotFoundException('案件ログが見つかりません');
    }

    return mapNoteToVisaCaseLogResponseDto(note);
  }

  /**
   * 更新指定签证案件日志的内容或结构化字段并返回最新实体。
   *
   * 与 `createLog` 相同：仅更新 note，不写入 `visa_cases`。
   *
   * @param visaCaseId - 日志归属的签证案件 ID
   * @param logId - 需要更新的日志 ID
   * @param dto - 包含可选更新字段的日志修改参数
   * @returns 更新完成后重新加载的日志响应对象
   * @throws {NotFoundException} 日志不存在或不属于该案件时
   */
  async updateLog(
    visaCaseId: string,
    logId: string,
    dto: UpdateVisaCaseLogDto,
  ): Promise<VisaCaseLogResponseDto> {
    const note = await this.noteRepo.findOne({
      where: { id: logId, visaCaseId },
    });

    if (!note) {
      throw new NotFoundException('案件ログが見つかりません');
    }

    if (dto.logType !== undefined) note.logType = dto.logType;
    if (dto.content !== undefined) note.content = dto.content;
    if (dto.submittedItems !== undefined)
      note.submittedItems = dto.submittedItems ?? null;
    if (dto.missingItems !== undefined)
      note.missingItems = dto.missingItems ?? null;
    if (dto.nextAction !== undefined) note.nextAction = dto.nextAction ?? null;
    if (dto.nextFollowUpAt !== undefined)
      note.nextFollowUpAt = dto.nextFollowUpAt
        ? new Date(dto.nextFollowUpAt)
        : null;

    await this.noteRepo.save(note);
    this.logger.log(`Case log ${logId} updated for visa case ${visaCaseId}`);
    return this.findOneLog(visaCaseId, logId);
  }

  /**
   * 对指定签证案件日志执行逻辑删除，保留审计追踪数据。
   *
   * @param visaCaseId - 日志归属的签证案件 ID
   * @param logId - 需要逻辑删除的日志 ID
   * @throws {NotFoundException} 日志不存在或不属于该案件时
   */
  async removeLog(visaCaseId: string, logId: string): Promise<void> {
    const note = await this.noteRepo.findOne({
      where: { id: logId, visaCaseId },
    });

    if (!note) {
      throw new NotFoundException('案件ログが見つかりません');
    }

    await this.noteRepo.softRemove(note);
    this.logger.log(
      `Case log ${logId} soft-deleted for visa case ${visaCaseId}`,
    );
  }
}
