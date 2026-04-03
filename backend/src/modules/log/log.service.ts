import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type {
  AuditActionType,
  AuditTargetType,
  OperationResult,
} from '../../common/constants/enums';
import type { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { QueryLoginLogDto } from './dto/query-login-log.dto';
import { AuditLog } from './entities/audit-log.entity';
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

type AuditLogSortField = (typeof AUDIT_LOG_SORT_FIELDS)[number];
type LoginLogSortField = (typeof LOGIN_LOG_SORT_FIELDS)[number];

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
 * 提供日志领域的写入与分页查询能力。
 *
 * 服务统一处理审计日志、登录日志的筛选条件、排序白名单与列表映射逻辑，
 * 以保证日志相关接口在多个控制器和拦截器之间复用同一套契约。
 */
@Injectable()
export class LogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(LoginLog)
    private readonly loginLogRepo: Repository<LoginLog>,
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
}
