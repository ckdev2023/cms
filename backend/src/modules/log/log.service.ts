import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AuditLog } from './entities/audit-log.entity'
import { LoginLog } from './entities/login-log.entity'
import { QueryAuditLogDto } from './dto/query-audit-log.dto'
import { QueryLoginLogDto } from './dto/query-login-log.dto'
import type { AuditActionType, AuditTargetType, OperationResult } from '../../common/constants/enums'

export interface CreateAuditLogInput {
  userId: string | null
  actionType: AuditActionType | string
  targetType: AuditTargetType | string
  targetId?: string | null
  beforeValue?: Record<string, unknown> | null
  afterValue?: Record<string, unknown> | null
  ipAddress?: string | null
  deviceInfo?: string | null
  result: OperationResult | string
}

@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name)

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(LoginLog)
    private readonly loginLogRepo: Repository<LoginLog>,
  ) {}

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
    })
    return this.auditLogRepo.save(log)
  }

  async findAuditLogs(query: QueryAuditLogDto) {
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
    } = query

    const qb = this.auditLogRepo
      .createQueryBuilder('al')
      .leftJoin('al.user', 'u')
      .addSelect(['u.id', 'u.username', 'u.displayName'])

    if (userId) {
      qb.andWhere('al.userId = :userId', { userId })
    }
    if (actionType) {
      qb.andWhere('al.actionType = :actionType', { actionType })
    }
    if (targetType) {
      qb.andWhere('al.targetType = :targetType', { targetType })
    }
    if (targetId) {
      qb.andWhere('al.targetId = :targetId', { targetId })
    }
    if (result) {
      qb.andWhere('al.result = :result', { result })
    }
    if (startDate) {
      qb.andWhere('al.occurredAt >= :startDate', { startDate })
    }
    if (endDate) {
      qb.andWhere('al.occurredAt <= :endDate', { endDate })
    }
    if (keyword) {
      qb.andWhere('(u.username ILIKE :kw OR u.displayName ILIKE :kw)', {
        kw: `%${keyword}%`,
      })
    }

    const allowedSorts = ['occurredAt', 'actionType', 'targetType', 'result']
    const orderField =
      sortBy && allowedSorts.includes(sortBy) ? sortBy : 'occurredAt'
    qb.orderBy(`al.${orderField}`, sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((item) => ({
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
      })),
      total,
      page,
      pageSize,
    }
  }

  async findLoginLogs(query: QueryLoginLogDto) {
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
    } = query

    const qb = this.loginLogRepo
      .createQueryBuilder('ll')
      .leftJoin('ll.user', 'u')
      .addSelect(['u.id', 'u.username', 'u.displayName'])

    if (userId) {
      qb.andWhere('ll.userId = :userId', { userId })
    }
    if (username) {
      qb.andWhere('ll.username ILIKE :username', { username: `%${username}%` })
    }
    if (loginType) {
      qb.andWhere('ll.loginType = :loginType', { loginType })
    }
    if (result) {
      qb.andWhere('ll.result = :result', { result })
    }
    if (startDate) {
      qb.andWhere('ll.occurredAt >= :startDate', { startDate })
    }
    if (endDate) {
      qb.andWhere('ll.occurredAt <= :endDate', { endDate })
    }
    if (keyword) {
      qb.andWhere('(ll.username ILIKE :kw)', { kw: `%${keyword}%` })
    }

    const allowedSorts = ['occurredAt', 'loginType', 'result', 'username']
    const orderField =
      sortBy && allowedSorts.includes(sortBy) ? sortBy : 'occurredAt'
    qb.orderBy(`ll.${orderField}`, sortOrder)

    qb.skip((page - 1) * pageSize).take(pageSize)

    const [items, total] = await qb.getManyAndCount()

    return {
      items: items.map((item) => ({
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
      })),
      total,
      page,
      pageSize,
    }
  }
}
