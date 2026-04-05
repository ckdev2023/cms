import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { SelectQueryBuilder } from 'typeorm';
import { Repository } from 'typeorm';

import {
  AuditActionType,
  AuditTargetType,
  ExportType,
  OperationResult,
} from '../../common/constants/enums';
import type { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import type { QueryAuditLogExportDto } from './dto/query-audit-log-export.dto';
import { QueryExportLogDto } from './dto/query-export-log.dto';
import { QueryLoginLogDto } from './dto/query-login-log.dto';
import { AuditLog } from './entities/audit-log.entity';
import { ExportLog } from './entities/export-log.entity';
import { LoginLog } from './entities/login-log.entity';

const AUDIT_LOG_SORT_FIELDS = [
  'occurredAt',
  'actionType',
  'targetType',
  'result',
] as const;

const LOGIN_LOG_SORT_FIELDS = [
  'occurredAt',
  'loginType',
  'result',
  'username',
] as const;

const EXPORT_LOG_SORT_FIELDS = ['occurredAt', 'exportType', 'status'] as const;

type AuditLogSortField = (typeof AUDIT_LOG_SORT_FIELDS)[number];
type LoginLogSortField = (typeof LOGIN_LOG_SORT_FIELDS)[number];

/** 审计列表与导出共用的筛选字段（不含分页）。 */
type AuditLogFilterInput = Pick<
  QueryAuditLogDto,
  | 'userId'
  | 'actionType'
  | 'targetType'
  | 'targetId'
  | 'startDate'
  | 'endDate'
  | 'result'
  | 'keyword'
>;
type ExportLogSortField = (typeof EXPORT_LOG_SORT_FIELDS)[number];

/**
 * 描述写入审计日志时允许透传的业务字段。
 *
 * 该输入契约同时服务于业务服务主动记日志和拦截器自动补写日志的场景，
 * 统一约束目标对象、前后快照与请求来源信息的字段语义。
 */
export interface CreateAuditLogInput {
  userId: string | null;
  actionType: AuditActionType | string;
  targetType: AuditTargetType | string;
  targetId?: string | null;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  deviceInfo?: string | null;
  result: OperationResult | string;
}

/**
 * 描述写入导出日志时允许透传的业务字段，与 `export_logs` 表结构一致。
 */
export interface CreateExportLogInput {
  userId: string;
  exportType: string;
  exportParams?: Record<string, unknown> | null;
  fileName?: string | null;
  status: OperationResult | string;
}

/**
 * 描述审计日志列表接口单条记录的稳定返回结构。
 */
export interface AuditLogListItem {
  id: string;
  userId: string | null;
  username: string | null;
  displayName: string | null;
  actionType: string;
  targetType: string | null;
  targetId: string | null;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  result: string | null;
  occurredAt: Date;
}

/**
 * 描述登录日志列表接口单条记录的稳定返回结构。
 */
export interface LoginLogListItem {
  id: string;
  userId: string | null;
  username: string;
  displayName: string | null;
  loginType: string;
  ipAddress: string | null;
  deviceInfo: string | null;
  result: string;
  failureReason: string | null;
  occurredAt: Date;
}

/**
 * 描述导出日志列表接口单条记录的稳定返回结构。
 */
export interface ExportLogListItem {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  exportType: string;
  exportParams: Record<string, unknown> | null;
  fileName: string | null;
  status: string;
  occurredAt: Date;
}

/**
 * 提供日志领域的写入与分页查询能力。
 *
 * 服务统一处理审计日志、登录日志的筛选条件、排序白名单与列表映射逻辑，
 * 以保证日志相关接口在多个控制器和拦截器之间复用同一套契约。
 */
@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(LoginLog)
    private readonly loginLogRepo: Repository<LoginLog>,
    @InjectRepository(ExportLog)
    private readonly exportLogRepo: Repository<ExportLog>,
  ) {}

  /**
   * 持久化一条审计日志记录，统一补齐可空字段的默认值。
   *
   * @param input - 审计日志的业务载荷，包含动作、目标对象与来源信息
   * @returns 已保存的审计日志实体，可用于后续链路追踪或断言测试
   */
  async createAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
    const log = this.auditLogRepo.create({
      userId: input.userId,
      actionType: input.actionType,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      beforeValue: input.beforeValue ?? null,
      afterValue: input.afterValue ?? null,
      ipAddress: input.ipAddress ?? null,
      deviceInfo: input.deviceInfo ?? null,
      result: input.result,
    });
    return this.auditLogRepo.save(log);
  }

  /**
   * 持久化一条导出日志记录，用于附件流式下载等离境类动作留痕。
   *
   * @param input - 导出动作的操作者、类型、参数摘要与结果状态
   * @returns 已保存的导出日志实体
   */
  async createExportLog(input: CreateExportLogInput): Promise<ExportLog> {
    const log = this.exportLogRepo.create({
      userId: input.userId,
      exportType: input.exportType,
      exportParams: input.exportParams ?? null,
      fileName: input.fileName ?? null,
      status: input.status as OperationResult,
    });
    return this.exportLogRepo.save(log);
  }

  /**
   * 按筛选条件查询导出日志列表，并拼装操作者显示名等列表字段。
   *
   * @param query - 导出日志分页、筛选与排序条件
   * @returns 包含导出日志条目与分页元数据的列表结果
   */
  async findExportLogs(
    query: QueryExportLogDto,
  ): Promise<PaginatedResult<ExportLogListItem>> {
    const {
      page = 1,
      pageSize = 20,
      userId,
      exportType,
      status,
      startDate,
      endDate,
      keyword,
      sortBy,
      sortOrder = 'DESC',
    } = query;

    const qb = this.exportLogRepo
      .createQueryBuilder('el')
      .leftJoin('el.user', 'u')
      .addSelect(['u.id', 'u.username', 'u.displayName']);

    if (userId) {
      qb.andWhere('el.userId = :userId', { userId });
    }
    if (exportType) {
      qb.andWhere('el.exportType = :exportType', { exportType });
    }
    if (status) {
      qb.andWhere('el.status = :status', { status });
    }
    if (startDate) {
      qb.andWhere('el.occurredAt >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('el.occurredAt <= :endDate', { endDate });
    }
    if (keyword) {
      qb.andWhere('(u.username ILIKE :kw OR u.displayName ILIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }

    const orderField = this.resolveExportLogSortField(sortBy);
    qb.orderBy(`el.${orderField}`, sortOrder);

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => this.mapExportLogItem(item)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 按筛选条件查询审计日志列表，并拼装前端列表页所需的展示字段。
   *
   * @param query - 审计日志分页、筛选与排序条件
   * @returns 包含审计日志条目与分页元数据的列表结果
   */
  async findAuditLogs(
    query: QueryAuditLogDto,
  ): Promise<PaginatedResult<AuditLogListItem>> {
    const {
      page = 1,
      pageSize = 20,
      userId,
      actionType,
      targetType,
      targetId,
      startDate,
      endDate,
      result,
      keyword,
      sortBy,
      sortOrder = 'DESC',
    } = query;

    const qb = this.auditLogRepo
      .createQueryBuilder('al')
      .leftJoin('al.user', 'u')
      .addSelect(['u.id', 'u.username', 'u.displayName']);

    this.applyAuditLogFilters(qb, {
      userId,
      actionType,
      targetType,
      targetId,
      startDate,
      endDate,
      result,
      keyword,
    });

    const orderField = this.resolveAuditLogSortField(sortBy);
    qb.orderBy(`al.${orderField}`, sortOrder);

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => this.mapAuditLogItem(item)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 按与列表相同的筛选条件导出最多 `limit` 条审计日志为 CSV，并写入 `export_logs` 留痕。
   *
   * @param query - 筛选、排序与单次导出行数上限（默认 2000，最大 5000）
   * @param operatorUserId - 发起导出的登录用户 ID
   * @returns UTF-8 CSV 正文（不含 BOM）、实际行数与建议文件名
   */
  async exportAuditLogsAsCsv(
    query: QueryAuditLogExportDto,
    operatorUserId: string,
  ): Promise<{ csv: string; rowCount: number; fileName: string }> {
    const limit = Math.min(Math.max(query.limit ?? 2000, 1), 5000);
    const {
      userId,
      actionType,
      targetType,
      targetId,
      startDate,
      endDate,
      result,
      keyword,
      sortBy,
      sortOrder = 'DESC',
    } = query;

    const qb = this.auditLogRepo
      .createQueryBuilder('al')
      .leftJoin('al.user', 'u')
      .addSelect(['u.id', 'u.username', 'u.displayName']);

    this.applyAuditLogFilters(qb, {
      userId,
      actionType,
      targetType,
      targetId,
      startDate,
      endDate,
      result,
      keyword,
    });

    const orderField = this.resolveAuditLogSortField(sortBy);
    qb.orderBy(`al.${orderField}`, sortOrder).take(limit);

    const rows = await qb.getMany();
    const items = rows.map((row) => this.mapAuditLogItem(row));
    const csv = LogService.buildAuditLogsCsv(items);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `audit-logs-${ts}.csv`;

    try {
      await this.createExportLog({
        userId: operatorUserId,
        exportType: ExportType.AUDIT_LOG_CSV,
        exportParams: {
          limit,
          userId: userId ?? null,
          actionType: actionType ?? null,
          targetType: targetType ?? null,
          targetId: targetId ?? null,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          result: result ?? null,
          keyword: keyword ?? null,
          sortBy: sortBy ?? null,
          sortOrder,
        },
        fileName,
        status: OperationResult.SUCCESS,
      });
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to record export log: ${reason}`);
    }

    return { csv, rowCount: items.length, fileName };
  }

  /**
   * 按筛选条件查询登录日志列表，并透出用户显示名等补充展示字段。
   *
   * @param query - 登录日志分页、筛选与排序条件
   * @returns 包含登录日志条目与分页元数据的列表结果
   */
  async findLoginLogs(
    query: QueryLoginLogDto,
  ): Promise<PaginatedResult<LoginLogListItem>> {
    const {
      page = 1,
      pageSize = 20,
      userId,
      username,
      loginType,
      result,
      startDate,
      endDate,
      keyword,
      sortBy,
      sortOrder = 'DESC',
    } = query;

    const qb = this.loginLogRepo
      .createQueryBuilder('ll')
      .leftJoin('ll.user', 'u')
      .addSelect(['u.id', 'u.username', 'u.displayName']);

    if (userId) {
      qb.andWhere('ll.userId = :userId', { userId });
    }
    if (username) {
      qb.andWhere('ll.username ILIKE :username', { username: `%${username}%` });
    }
    if (loginType) {
      qb.andWhere('ll.loginType = :loginType', { loginType });
    }
    if (result) {
      qb.andWhere('ll.result = :result', { result });
    }
    if (startDate) {
      qb.andWhere('ll.occurredAt >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('ll.occurredAt <= :endDate', { endDate });
    }
    if (keyword) {
      qb.andWhere('(ll.username ILIKE :kw)', { kw: `%${keyword}%` });
    }

    const orderField = this.resolveLoginLogSortField(sortBy);
    qb.orderBy(`ll.${orderField}`, sortOrder);

    qb.skip((page - 1) * pageSize).take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((item) => this.mapLoginLogItem(item)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 校验审计日志排序字段是否在白名单内，避免把任意字符串拼入 SQL 片段。
   *
   * @param sortBy - 客户端传入的排序字段
   * @returns 可安全用于查询构造器的审计日志排序字段
   */
  private resolveAuditLogSortField(sortBy?: string): AuditLogSortField {
    return sortBy && AUDIT_LOG_SORT_FIELDS.includes(sortBy as AuditLogSortField)
      ? (sortBy as AuditLogSortField)
      : 'occurredAt';
  }

  /**
   * 校验登录日志排序字段是否在白名单内，避免列表查询出现非法排序参数。
   *
   * @param sortBy - 客户端传入的排序字段
   * @returns 可安全用于查询构造器的登录日志排序字段
   */
  private resolveLoginLogSortField(sortBy?: string): LoginLogSortField {
    return sortBy && LOGIN_LOG_SORT_FIELDS.includes(sortBy as LoginLogSortField)
      ? (sortBy as LoginLogSortField)
      : 'occurredAt';
  }

  /**
   * 校验导出日志排序字段是否在白名单内，避免列表查询出现非法排序参数。
   *
   * @param sortBy - 客户端传入的排序字段
   * @returns 可安全用于查询构造器的导出日志排序字段
   */
  private resolveExportLogSortField(sortBy?: string): ExportLogSortField {
    return sortBy &&
      EXPORT_LOG_SORT_FIELDS.includes(sortBy as ExportLogSortField)
      ? (sortBy as ExportLogSortField)
      : 'occurredAt';
  }

  /**
   * 为审计日志查询构造器叠加列表与导出共用的 WHERE 条件。
   *
   * @param qb - 已关联 `al.user` 别名为 `u` 的查询构造器
   * @param filters - 操作者、目标维度与时间关键字等筛选入参
   */
  private applyAuditLogFilters(
    qb: SelectQueryBuilder<AuditLog>,
    filters: AuditLogFilterInput,
  ): void {
    const {
      userId,
      actionType,
      targetType,
      targetId,
      startDate,
      endDate,
      result,
      keyword,
    } = filters;

    if (userId) {
      qb.andWhere('al.userId = :userId', { userId });
    }
    if (actionType) {
      qb.andWhere('al.actionType = :actionType', { actionType });
    }
    if (targetType) {
      qb.andWhere('al.targetType = :targetType', { targetType });
    }
    if (targetId) {
      qb.andWhere('al.targetId = :targetId', { targetId });
    }
    if (result) {
      qb.andWhere('al.result = :result', { result });
    }
    if (startDate) {
      qb.andWhere('al.occurredAt >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('al.occurredAt <= :endDate', { endDate });
    }
    if (keyword) {
      qb.andWhere('(u.username ILIKE :kw OR u.displayName ILIKE :kw)', {
        kw: `%${keyword}%`,
      });
    }
  }

  /**
   * 将审计日志列表项序列化为单行 CSV 所需的单元格转义文本。
   *
   * @param raw - 原始单元格字符串
   * @returns 按需加引号与转义双引号后的单元格
   */
  private static escapeCsvCell(raw: string): string {
    if (/[",\n\r]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  }

  /**
   * 将 JSON 快照列编码为 CSV 安全字符串。
   *
   * @param value - 审计前后快照对象，空时输出空单元格
   * @returns 经 `JSON.stringify` 与 CSV 转义后的文本
   */
  private static jsonForCsv(value: Record<string, unknown> | null): string {
    if (value === null) {
      return '';
    }
    return LogService.escapeCsvCell(JSON.stringify(value));
  }

  /**
   * 将审计日志列表项数组拼接为不含 BOM 的 CSV 正文。
   *
   * @param items - 已映射为列表 DTO 的审计记录集合
   * @returns 以换行分隔、首行为英文字段名的 CSV 文本
   */
  private static buildAuditLogsCsv(items: AuditLogListItem[]): string {
    const headers = [
      'id',
      'occurredAt',
      'userId',
      'username',
      'displayName',
      'actionType',
      'targetType',
      'targetId',
      'result',
      'ipAddress',
      'deviceInfo',
      'beforeValue',
      'afterValue',
    ];
    const lines = [headers.join(',')];
    for (const item of items) {
      const occurred =
        item.occurredAt instanceof Date
          ? item.occurredAt.toISOString()
          : String(item.occurredAt);
      lines.push(
        [
          LogService.escapeCsvCell(item.id),
          LogService.escapeCsvCell(occurred),
          LogService.escapeCsvCell(item.userId ?? ''),
          LogService.escapeCsvCell(item.username ?? ''),
          LogService.escapeCsvCell(item.displayName ?? ''),
          LogService.escapeCsvCell(item.actionType),
          LogService.escapeCsvCell(item.targetType ?? ''),
          LogService.escapeCsvCell(item.targetId ?? ''),
          LogService.escapeCsvCell(item.result ?? ''),
          LogService.escapeCsvCell(item.ipAddress ?? ''),
          LogService.escapeCsvCell(item.deviceInfo ?? ''),
          LogService.jsonForCsv(item.beforeValue),
          LogService.jsonForCsv(item.afterValue),
        ].join(','),
      );
    }
    return lines.join('\n');
  }

  /**
   * 将审计日志实体转换为列表接口稳定输出的 DTO 结构。
   *
   * @param item - 从数据库查询出的审计日志实体
   * @returns 供控制器直接返回的审计日志列表项
   */
  private mapAuditLogItem(item: AuditLog): AuditLogListItem {
    return {
      id: item.id,
      userId: item.userId,
      username: item.user?.username ?? null,
      displayName: item.user?.displayName ?? null,
      actionType: item.actionType,
      targetType: item.targetType,
      targetId: item.targetId,
      beforeValue: item.beforeValue,
      afterValue: item.afterValue,
      ipAddress: item.ipAddress,
      deviceInfo: item.deviceInfo,
      result: item.result,
      occurredAt: item.occurredAt,
    };
  }

  /**
   * 将登录日志实体转换为列表接口稳定输出的 DTO 结构。
   *
   * @param item - 从数据库查询出的登录日志实体
   * @returns 供控制器直接返回的登录日志列表项
   */
  private mapLoginLogItem(item: LoginLog): LoginLogListItem {
    return {
      id: item.id,
      userId: item.userId,
      username: item.username,
      displayName: item.user?.displayName ?? null,
      loginType: item.loginType,
      ipAddress: item.ipAddress,
      deviceInfo: item.deviceInfo,
      result: item.result,
      failureReason: item.failureReason,
      occurredAt: item.occurredAt,
    };
  }

  /**
   * 将导出日志实体转换为列表接口稳定输出的 DTO 结构。
   *
   * @param item - 从数据库查询出的导出日志实体
   * @returns 供控制器直接返回的导出日志列表项
   */
  private mapExportLogItem(item: ExportLog): ExportLogListItem {
    return {
      id: item.id,
      userId: item.userId,
      username: item.user?.username ?? null,
      displayName: item.user?.displayName ?? null,
      exportType: item.exportType,
      exportParams: item.exportParams,
      fileName: item.fileName,
      status: item.status,
      occurredAt: item.occurredAt,
    };
  }
}
