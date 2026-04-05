/* eslint-disable max-lines-per-function -- P2-S3d 行政→ビザ補録编排方法体较长 */
import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import {
  AdminCaseStatus,
  AuditActionType,
  AuditTargetType,
  OperationResult,
  VisaCaseStatus,
} from '../../common/constants/enums';
import { AdminCase } from '../admin-case/entities/admin-case.entity';
import { LogService } from '../log/log.service';
import {
  AdminCaseVisaSupplementCommitOutcome,
  AdminCaseVisaSupplementErrorCode,
  AdminCaseVisaSupplementRowStatus,
  AdminCaseVisaSupplementWarningCode,
} from './admin-case-visa-supplement.constants';
import { CreateVisaCaseDto } from './dto/create-visa-case.dto';
import { AdminCaseVisaSupplementBatch } from './entities/admin-case-visa-supplement-batch.entity';
import { VisaCase } from './entities/visa-case.entity';
import { VisaCaseService } from './visa-case.service';

/** 预览单行 DTO，供 dry-run 与提交阶段共用。 */
export interface AdminCaseVisaSupplementPreviewRowDto {
  rowNumber: number;
  adminCaseId: string;
  status: string;
  errors: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  customerId: string | null;
  adminCaseName: string | null;
  existingVisaCaseId?: string;
  proposed?: {
    caseType: string | null;
    caseStatus: VisaCaseStatus;
    expireDate: string | null;
    assignedTo: string | null;
    importReference: string;
    memoPreview: string;
  };
  /** 仅 status=OK 时用于提交。 */
  createDto?: CreateVisaCaseDto;
}

/** 预览汇总与内容哈希。 */
export interface AdminCaseVisaSupplementPreviewResultDto {
  contentSha256: string;
  summary: {
    rowCount: number;
    okCount: number;
    warningRowCount: number;
    errorCount: number;
    duplicateSkippedCount: number;
    canProceed: boolean;
  };
  rows: AdminCaseVisaSupplementPreviewRowDto[];
}

/** 提交单行结果。 */
export interface AdminCaseVisaSupplementCommitRowResultDto {
  adminCaseId: string;
  outcome: string;
  message?: string;
  errorCode?: string;
  visaCaseId?: string;
}

/** 提交整批响应。 */
export interface AdminCaseVisaSupplementCommitResultDto {
  supplementBatchId: string;
  contentSha256: string;
  summary: {
    rowCount: number;
    createdCaseCount: number;
    skippedDuplicateCount: number;
    failedRowCount: number;
  };
  rows: AdminCaseVisaSupplementCommitRowResultDto[];
}

/**
 * 将行政案件启发式补录为签证案件（P2-S3d）：预览 dry-run、import_reference 行级幂等、批次 SHA 去重与审计。
 */
@Injectable()
export class AdminCaseVisaSupplementService {
  constructor(
    private readonly visaCaseService: VisaCaseService,
    private readonly auditLogService: LogService,
    @InjectRepository(AdminCase)
    private readonly adminCaseRepo: Repository<AdminCase>,
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
    @InjectRepository(AdminCaseVisaSupplementBatch)
    private readonly batchRepo: Repository<AdminCaseVisaSupplementBatch>,
  ) {}

  /**
   * 对所选行政案件做 dry-run：解析映射、检测幂等冲突，不写库。
   *
   * @param adminCaseIds - 行政案件主键列表（任意顺序，服务端去重后按字典序处理）
   * @returns 内容哈希、行级状态与 `canProceed`（存在 ERROR 行时为 false）
   */
  async preview(
    adminCaseIds: string[],
  ): Promise<AdminCaseVisaSupplementPreviewResultDto> {
    const sortedUnique = this.normalizeIds(adminCaseIds);
    const contentSha256 = this.computeContentSha256(sortedUnique);
    const rows = await this.buildRows(sortedUnique);
    return {
      contentSha256,
      summary: this.summarizeRows(rows),
      rows,
    };
  }

  /**
   * 在预览无 ERROR 且批次 SHA 未落库时，逐行创建签证案件；失败行跳过并记入报告。
   *
   * @param adminCaseIds - 与预览相同的行政案件 ID 集合（顺序无关，以稳定哈希为准）
   * @param userId - 当前用户 ID
   * @param ipAddress - 客户端 IP（可空）
   * @param deviceInfo - UA 等（可空）
   * @returns 批次主键、汇总与逐行 outcome
   * @throws {BadRequestException} 预览存在 ERROR 行时
   * @throws {ConflictException} 同一内容哈希已提交过时
   */
  async commit(
    adminCaseIds: string[],
    userId: string,
    ipAddress: string | null,
    deviceInfo: string | null,
  ): Promise<AdminCaseVisaSupplementCommitResultDto> {
    const preview = await this.preview(adminCaseIds);
    if (!preview.summary.canProceed) {
      throw new BadRequestException(
        'プレビューにエラー行があるため確定できません。行政案件IDを修正してください',
      );
    }

    const existingBatch = await this.batchRepo.findOne({
      where: { contentSha256: preview.contentSha256 },
    });
    if (existingBatch) {
      throw new ConflictException(
        `同一選択の補録は既に実行済みです（supplement_batch_id=${existingBatch.id}, code=${AdminCaseVisaSupplementErrorCode.BATCH_ALREADY_COMMITTED}）`,
      );
    }

    const commitRows: AdminCaseVisaSupplementCommitRowResultDto[] = [];
    let createdCaseCount = 0;
    let skippedDuplicateCount = 0;
    let failedRowCount = 0;

    for (const pr of preview.rows) {
      if (pr.status === AdminCaseVisaSupplementRowStatus.DUPLICATE_SKIPPED) {
        commitRows.push({
          adminCaseId: pr.adminCaseId,
          outcome: AdminCaseVisaSupplementCommitOutcome.SKIPPED_DUPLICATE,
          visaCaseId: pr.existingVisaCaseId,
          message: 'import_reference により既存ビザ案件が存在するためスキップ',
        });
        skippedDuplicateCount += 1;
        continue;
      }

      if (pr.status !== AdminCaseVisaSupplementRowStatus.OK || !pr.createDto) {
        commitRows.push({
          adminCaseId: pr.adminCaseId,
          outcome: AdminCaseVisaSupplementCommitOutcome.FAILED,
          message: 'プレビュー状態が不正のためスキップ',
        });
        failedRowCount += 1;
        continue;
      }

      const createDto = pr.createDto;
      const rowCustomerId = createDto.customerId;
      const rowImportReference = this.buildImportReference(pr.adminCaseId);

      try {
        const created = await this.visaCaseService.create(
          rowCustomerId,
          createDto,
          userId,
        );
        commitRows.push({
          adminCaseId: pr.adminCaseId,
          outcome: AdminCaseVisaSupplementCommitOutcome.CASE_CREATED,
          visaCaseId: created.id,
        });
        createdCaseCount += 1;
      } catch (caught: unknown) {
        if (this.isPgUniqueViolation(caught)) {
          const existing = await this.findVisaCaseBySupplementImportKey(
            rowCustomerId,
            rowImportReference,
          );
          commitRows.push({
            adminCaseId: pr.adminCaseId,
            outcome: AdminCaseVisaSupplementCommitOutcome.SKIPPED_DUPLICATE,
            message: '作成時の一意制約により既存案件に合流',
            visaCaseId: existing?.id,
          });
          skippedDuplicateCount += 1;
          continue;
        }
        const msg = caught instanceof Error ? caught.message : String(caught);
        commitRows.push({
          adminCaseId: pr.adminCaseId,
          outcome: AdminCaseVisaSupplementCommitOutcome.FAILED,
          message: msg,
        });
        failedRowCount += 1;
      }
    }

    let savedBatch: AdminCaseVisaSupplementBatch;
    try {
      savedBatch = await this.batchRepo.save(
        this.batchRepo.create({
          contentSha256: preview.contentSha256,
          createdBy: userId,
          summary: {
            rowCount: preview.rows.length,
            createdCaseCount,
            skippedDuplicateCount,
            failedRowCount,
          },
        }),
      );
    } catch (e) {
      if (this.isPgUniqueViolation(e)) {
        throw new ConflictException(
          `同一選択の補録は既に実行済みです（code=${AdminCaseVisaSupplementErrorCode.BATCH_ALREADY_COMMITTED}）`,
        );
      }
      throw e;
    }

    await this.auditLogService.createAuditLog({
      userId,
      actionType: AuditActionType.IMPORT,
      targetType: AuditTargetType.VISA_CASE_ADMIN_SUPPLEMENT,
      targetId: savedBatch.id,
      afterValue: {
        supplementBatchId: savedBatch.id,
        contentSha256: preview.contentSha256,
        ...(savedBatch.summary ?? {}),
        rowOutcomes: commitRows,
      },
      result: OperationResult.SUCCESS,
      ipAddress,
      deviceInfo,
    });

    return {
      supplementBatchId: savedBatch.id,
      contentSha256: preview.contentSha256,
      summary: {
        rowCount: preview.rows.length,
        createdCaseCount,
        skippedDuplicateCount,
        failedRowCount,
      },
      rows: commitRows,
    };
  }

  /**
   * 将行政案件 ID 列表 trim、去重并按字典序排序，使同一集合在不同输入顺序下批次哈希一致。
   *
   * @param adminCaseIds - 用户提交的原始 UUID 字符串列表
   * @returns 去重后按字典序排列的行政案件 ID 数组
   */
  private normalizeIds(adminCaseIds: string[]): string[] {
    const uniq = [...new Set(adminCaseIds.map((id) => id.trim()))].filter(
      Boolean,
    );
    return [...uniq].sort((a, b) => a.localeCompare(b));
  }

  /**
   * 对排序后的行政案件 ID 拼接串计算 SHA-256，用作补录批次幂等与审计关联键。
   *
   * @param sortedUniqueIds - 已排序且去重的行政案件 ID 列表
   * @returns 64 位十六进制小写摘要字符串
   */
  private computeContentSha256(sortedUniqueIds: string[]): string {
    return createHash('sha256')
      .update(sortedUniqueIds.join(','), 'utf8')
      .digest('hex');
  }

  /**
   * 统计预览各行终态计数，并得出 ERROR 行数为 0 时 `canProceed` 为 true。
   *
   * @param rows - `buildRows` 产出的预览行列表
   * @returns 含行数、OK/警告/错误/重复跳过计数及可提交标志的摘要对象
   */
  private summarizeRows(
    rows: AdminCaseVisaSupplementPreviewRowDto[],
  ): AdminCaseVisaSupplementPreviewResultDto['summary'] {
    let okCount = 0;
    let warningRowCount = 0;
    let errorCount = 0;
    let duplicateSkippedCount = 0;
    for (const r of rows) {
      if (r.status === AdminCaseVisaSupplementRowStatus.OK) {
        okCount += 1;
        if (r.warnings.length) {
          warningRowCount += 1;
        }
      } else if (r.status === AdminCaseVisaSupplementRowStatus.WARNING) {
        warningRowCount += 1;
      } else if (r.status === AdminCaseVisaSupplementRowStatus.ERROR) {
        errorCount += 1;
      } else if (
        r.status === AdminCaseVisaSupplementRowStatus.DUPLICATE_SKIPPED
      ) {
        duplicateSkippedCount += 1;
      }
    }
    return {
      rowCount: rows.length,
      okCount,
      warningRowCount,
      errorCount,
      duplicateSkippedCount,
      canProceed: errorCount === 0,
    };
  }

  /**
   * 按稳定顺序逐条加载行政案件、检测 `import_reference` 幂等冲突并组装预览行与创建 DTO。
   *
   * @param sortedUniqueIds - 已排序去重的行政案件主键列表
   * @returns 每行含状态、告警、拟写入字段及可提交时 `createDto` 的预览数组
   */
  private async buildRows(
    sortedUniqueIds: string[],
  ): Promise<AdminCaseVisaSupplementPreviewRowDto[]> {
    const rows: AdminCaseVisaSupplementPreviewRowDto[] = [];
    let rowNumber = 0;
    for (const adminCaseId of sortedUniqueIds) {
      rowNumber += 1;
      const admin = await this.adminCaseRepo.findOne({
        where: { id: adminCaseId },
      });
      if (!admin) {
        rows.push({
          rowNumber,
          adminCaseId,
          status: AdminCaseVisaSupplementRowStatus.ERROR,
          errors: [
            {
              code: AdminCaseVisaSupplementErrorCode.ADMIN_CASE_NOT_FOUND,
              message: '行政案件が見つかりません',
            },
          ],
          warnings: [],
          customerId: null,
          adminCaseName: null,
        });
        continue;
      }

      const importRef = this.buildImportReference(adminCaseId);
      const existing = await this.visaCaseRepo.findOne({
        where: {
          customerId: admin.customerId,
          importReference: importRef,
        },
      });
      if (existing) {
        rows.push({
          rowNumber,
          adminCaseId,
          status: AdminCaseVisaSupplementRowStatus.DUPLICATE_SKIPPED,
          errors: [],
          warnings: [],
          customerId: admin.customerId,
          adminCaseName: admin.caseName,
          existingVisaCaseId: existing.id,
        });
        continue;
      }

      const mapped = this.mapAdminStatusToVisa(admin.status);
      const createDto = this.buildCreateDto(admin, importRef);
      const warnings = mapped.weakMap
        ? [
            {
              code: AdminCaseVisaSupplementWarningCode.ADMIN_STATUS_WEAKLY_MAPPED,
              message:
                '行政ステータスをビザ案件ステータスへ弱い対応で初期化しました（要確認）',
            },
          ]
        : [];

      rows.push({
        rowNumber,
        adminCaseId,
        status: AdminCaseVisaSupplementRowStatus.OK,
        errors: [],
        warnings,
        customerId: admin.customerId,
        adminCaseName: admin.caseName,
        proposed: {
          caseType: createDto.caseType ?? null,
          caseStatus: createDto.caseStatus ?? VisaCaseStatus.DRAFT,
          expireDate: createDto.expireDate ?? null,
          assignedTo: createDto.assignedTo ?? null,
          importReference: importRef,
          memoPreview:
            createDto.memo && createDto.memo.length > 200
              ? `${createDto.memo.slice(0, 200)}…`
              : (createDto.memo ?? ''),
        },
        createDto,
      });
    }
    return rows;
  }

  /**
   * 生成与 `visa_cases.import_reference` 唯一索引对齐的行政案件幂等键字符串。
   *
   * @param adminCaseId - 行政案件主键 UUID
   * @returns 形如 `admin:{uuid}` 且长度符合列上限的引用串
   */
  private buildImportReference(adminCaseId: string): string {
    return `admin:${adminCaseId}`;
  }

  /**
   * 将行政案件状态弱映射为签证案件状态，同名枚举直通其余映射为进行中并标记需人工确认。
   *
   * @param status - 行政案件当前 `AdminCaseStatus` 枚举值
   * @returns 目标 `VisaCaseStatus` 及是否为启发式弱映射的标志
   */
  private mapAdminStatusToVisa(status: AdminCaseStatus): {
    visaStatus: VisaCaseStatus;
    weakMap: boolean;
  } {
    const direct: Partial<Record<AdminCaseStatus, VisaCaseStatus>> = {
      [AdminCaseStatus.DRAFT]: VisaCaseStatus.DRAFT,
      [AdminCaseStatus.SUBMITTED]: VisaCaseStatus.SUBMITTED,
      [AdminCaseStatus.APPROVED]: VisaCaseStatus.APPROVED,
      [AdminCaseStatus.REJECTED]: VisaCaseStatus.REJECTED,
      [AdminCaseStatus.COMPLETED]: VisaCaseStatus.COMPLETED,
      [AdminCaseStatus.CANCELLED]: VisaCaseStatus.CANCELLED,
    };
    const hit = direct[status];
    if (hit) {
      return { visaStatus: hit, weakMap: false };
    }
    if (
      status === AdminCaseStatus.ACCEPTED ||
      status === AdminCaseStatus.MATERIAL_PENDING
    ) {
      return { visaStatus: VisaCaseStatus.IN_PROGRESS, weakMap: true };
    }
    return { visaStatus: VisaCaseStatus.DRAFT, weakMap: true };
  }

  /**
   * 从行政案件行组装 `CreateVisaCaseDto`，写入溯源 memo 与非家族签默认字段。
   *
   * @param admin - 已加载的行政案件实体
   * @param importRef - 与 `buildImportReference` 一致的幂等引用串
   * @returns 可直接交给 `VisaCaseService.create` 的创建载荷
   */
  private buildCreateDto(
    admin: AdminCase,
    importRef: string,
  ): CreateVisaCaseDto {
    const { visaStatus } = this.mapAdminStatusToVisa(admin.status);
    const memoLines = [
      '[admin_case→visa 補録]',
      `行政案件名: ${admin.caseName}`,
      `admin_case_id=${admin.id}`,
    ];
    if (admin.applicantName?.trim()) {
      memoLines.push(`申請者名(行政): ${admin.applicantName.trim()}`);
    }
    const dto: CreateVisaCaseDto = {
      customerId: admin.customerId,
      caseType: admin.residenceStatus?.trim() || undefined,
      caseStatus: visaStatus,
      isFamilyCase: false,
      assignedTo: admin.ownerUserId ?? undefined,
      expireDate: this.formatDateOnly(admin.expireDate),
      importReference: importRef,
      memo: memoLines.join('\n'),
    };
    return dto;
  }

  /**
   * 将数据库日期或 Date 实例格式化为 `YYYY-MM-DD` 供 DTO 日期校验使用。
   *
   * @param d - 行政案件到期日，可空
   * @returns ISO 日期前缀或 undefined（无到期日时）
   */
  private formatDateOnly(d: Date | null): string | undefined {
    if (!d) {
      return undefined;
    }
    const iso = d instanceof Date ? d.toISOString() : String(d);
    return iso.slice(0, 10);
  }

  /**
   * 按补录幂等键与客户 ID 查询已存在的签证案件，供创建时唯一冲突后的对账。
   *
   * @param customerId - 案件归属客户主键
   * @param importReference - `admin:{uuid}` 等 import_reference，空串视为无键
   * @returns 命中行的实体；无键或未找到时返回 null
   */
  private async findVisaCaseBySupplementImportKey(
    customerId: string,
    importReference: string | undefined,
  ): Promise<VisaCase | null> {
    if (importReference === undefined || importReference === '') {
      return null;
    }
    return this.visaCaseRepo.findOne({
      where: { customerId, importReference },
    });
  }

  /**
   * 判断 TypeORM 抛出异常是否为 PostgreSQL 唯一约束冲突（SQLSTATE 23505）。
   *
   * @param err - 捕获的未知类型错误对象
   * @returns 命中唯一违反错误码时 true，否则 false
   */
  private isPgUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    );
  }
}
