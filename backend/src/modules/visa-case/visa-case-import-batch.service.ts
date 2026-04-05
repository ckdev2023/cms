import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { User } from '../auth/entities/user.entity';
import { VisaCaseImportBatch } from './entities/visa-case-import-batch.entity';

/** 批次表 `summary` JSON 与 commit 响应、`audit_logs.afterValue` 对齐的汇总形状。 */
export interface VisaCaseImportBatchSummaryDto {
  fileName: string | null;
  rowCount: number;
  createdCaseCount: number;
  skippedDuplicateCaseCount: number;
  addedMemberCount: number;
  createdFilePathCount: number;
  createdLogCount: number;
  failedRowCount: number;
}

/**
 * 只读 API 返回的批次审计信息，与 `docs/23` §6.4、`docs/24` §3.5 JSON 报告对账字段一致。
 */
export interface VisaCaseImportBatchAuditDto {
  importBatchId: string;
  contentSha256: string;
  createdBy: string | null;
  /** 操作者表示名；用户不存在或未加载时为 null */
  createdByDisplayName: string | null;
  createdAt: string;
  summary: VisaCaseImportBatchSummaryDto | null;
}

/**
 * 将 `visa_case_import_batches.summary` 规范为与提交响应一致的汇总 DTO，兼容历史或残缺 JSON。
 *
 * @param raw - 批次表 jsonb 字段原始值
 * @returns 规范化后的汇总对象，无法解析时返回 null
 */
function mapImportBatchSummary(
  raw: Record<string, unknown> | null | undefined,
): VisaCaseImportBatchSummaryDto | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    return null;
  }
  const n = (k: string): number => {
    const v = raw[k];
    return typeof v === 'number' && !Number.isNaN(v) ? v : Number(v) || 0;
  };
  const fn = raw.fileName;
  return {
    fileName: typeof fn === 'string' ? fn : null,
    rowCount: n('rowCount'),
    createdCaseCount: n('createdCaseCount'),
    skippedDuplicateCaseCount: n('skippedDuplicateCaseCount'),
    addedMemberCount: n('addedMemberCount'),
    createdFilePathCount: n('createdFilePathCount'),
    createdLogCount: n('createdLogCount'),
    failedRowCount: n('failedRowCount'),
  };
}

/**
 * 将批次实体映射为只读审计 DTO。
 *
 * @param batch - 批次实体
 * @param displayNameByUserId - 操作者 UUID → 表示名（可空）
 * @returns API 用批次审计载荷
 */
function toAuditDto(
  batch: VisaCaseImportBatch,
  displayNameByUserId: Map<string, string>,
): VisaCaseImportBatchAuditDto {
  const uid = batch.createdBy;
  return {
    importBatchId: batch.id,
    contentSha256: batch.contentSha256,
    createdBy: uid,
    createdByDisplayName:
      uid !== null && displayNameByUserId.has(uid)
        ? (displayNameByUserId.get(uid) ?? null)
        : null,
    createdAt: batch.createdAt.toISOString(),
    summary: mapImportBatchSummary(batch.summary ?? null),
  };
}

/**
 * 提供导入成功批次的只读查询，支撑与 `audit_logs` 及前端 JSON 下载字段对账。
 */
@Injectable()
export class VisaCaseImportBatchService {
  constructor(
    @InjectRepository(VisaCaseImportBatch)
    private readonly batchRepo: Repository<VisaCaseImportBatch>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * 按创建时间倒序分页返回已成功导入批次及操作者表示名。
   *
   * @param page - 页码（从 1 起）
   * @param pageSize - 每页条数
   * @returns 当前页批次列表与总条数
   */
  async list(
    page: number,
    pageSize: number,
  ): Promise<{ items: VisaCaseImportBatchAuditDto[]; total: number }> {
    const safePage = page > 0 ? page : 1;
    const safeSize = pageSize > 0 ? pageSize : 20;
    const [batches, total] = await this.batchRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeSize,
      take: safeSize,
    });
    const nameMap = await this.resolveCreatorDisplayNames(batches);
    return {
      items: batches.map((b) => toAuditDto(b, nameMap)),
      total,
    };
  }

  /**
   * 按主键查询单条批次审计信息，不存在时返回 null。
   *
   * @param id - 批次 UUID（`import_batch_id`）
   * @returns 审计 DTO 或 null
   */
  async findOneById(id: string): Promise<VisaCaseImportBatchAuditDto | null> {
    const batch = await this.batchRepo.findOne({ where: { id } });
    if (!batch) {
      return null;
    }
    const nameMap = await this.resolveCreatorDisplayNames([batch]);
    return toAuditDto(batch, nameMap);
  }

  /**
   * 批量解析 `createdBy` 对应用户的 `displayName`，减少 N+1 查询。
   *
   * @param batches - 批次实体列表
   * @returns 用户 ID → 表示名映射
   */
  private async resolveCreatorDisplayNames(
    batches: VisaCaseImportBatch[],
  ): Promise<Map<string, string>> {
    const ids = [
      ...new Set(
        batches.map((b) => b.createdBy).filter((x): x is string => !!x),
      ),
    ];
    if (ids.length === 0) {
      return new Map();
    }
    const users = await this.userRepo.find({
      where: { id: In(ids) },
      select: ['id', 'displayName'],
    });
    return new Map(users.map((u) => [u.id, u.displayName]));
  }
}
