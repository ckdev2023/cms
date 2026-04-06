/* eslint-disable max-lines-per-function -- S3c 分批写入编排 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  AuditActionType,
  AuditTargetType,
  OperationResult,
} from '../../common/constants/enums';
import { LogService } from '../log/log.service';
import { VisaCase } from './entities/visa-case.entity';
import { VisaCaseImportBatch } from './entities/visa-case-import-batch.entity';
import {
  VisaCaseImportCommitErrorCode,
  VisaCaseImportCommitOutcome,
  VisaCaseImportRecordType,
  VisaCaseImportRowStatus,
} from './import/visa-case-import.constants';
import { VisaCaseService } from './visa-case.service';
import { VisaCaseFamilyMemberService } from './visa-case-family-member.service';
import { VisaCaseFilePathService } from './visa-case-file-path.service';
import type {
  VisaCaseImportCommitResultDto,
  VisaCaseImportCommitRowResultDto,
} from './visa-case-import-commit.types';
import { VisaCaseImportCommitRowWriter } from './visa-case-import-commit-row-writer';
import type { VisaCaseImportPreviewRowDto } from './visa-case-import-preview.service';
import { VisaCaseImportPreviewService } from './visa-case-import-preview.service';
import { VisaCaseLogService } from './visa-case-log.service';

export type {
  VisaCaseImportCommitResultDto,
  VisaCaseImportCommitRowResultDto,
} from './visa-case-import-commit.types';

/**
 * 将校验通过的 CSV 按行落库，复用案件/家属/路径/日志既有服务，并登记批次与审计。
 */
@Injectable()
export class VisaCaseImportCommitService {
  private readonly rowWriter: VisaCaseImportCommitRowWriter;

  constructor(
    private readonly previewService: VisaCaseImportPreviewService,
    private readonly visaCaseService: VisaCaseService,
    private readonly familyMemberService: VisaCaseFamilyMemberService,
    private readonly filePathService: VisaCaseFilePathService,
    private readonly visaCaseLogService: VisaCaseLogService,
    private readonly auditLogService: LogService,
    @InjectRepository(VisaCaseImportBatch)
    private readonly batchRepo: Repository<VisaCaseImportBatch>,
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
  ) {
    this.rowWriter = new VisaCaseImportCommitRowWriter(
      visaCaseService,
      familyMemberService,
      filePathService,
      visaCaseLogService,
      visaCaseRepo,
    );
  }

  /**
   * 先执行与预览相同的校验，再逐行调用既有写接口；失败行记入报告但不回滚已成功行。
   *
   * @param buffer - CSV 原始バイト列
   * @param userId - 当前登录用户 ID
   * @param fileName - 上传时的原始文件名（审计用）
   * @param ipAddress - 客户端 IP（可空）
   * @param deviceInfo - UA 等端末摘要（可空）
   * @returns 批次主键、内容哈希、操作者、批次创建时刻 ISO8601、汇总与逐行 outcome
   * @throws {BadRequestException} 预览 `canProceed` 为 false 时
   * @throws {ConflictException} 同一 `contentSha256` 已成功取込済みのとき
   */
  async commitFromBuffer(
    buffer: Buffer,
    userId: string,
    fileName: string | null,
    ipAddress: string | null,
    deviceInfo: string | null,
  ): Promise<VisaCaseImportCommitResultDto> {
    const preview = await this.previewService.previewFromBuffer(buffer);
    if (!preview.summary.canProceed) {
      throw new BadRequestException(
        'プレビューでエラー行があるため取り込めません。先に CSV を修正してください',
      );
    }

    const existingBatch = await this.batchRepo.findOne({
      where: { contentSha256: preview.contentSha256 },
    });
    if (existingBatch) {
      throw new ConflictException(
        `同一内容の CSV は既に取り込み済みです（import_batch_id=${existingBatch.id}, code=${VisaCaseImportCommitErrorCode.CSV_ALREADY_IMPORTED}）`,
      );
    }

    const legacyKeyToVisaCaseId = new Map<string, string>();
    const rows: VisaCaseImportCommitRowResultDto[] = [];

    let createdCaseCount = 0;
    let skippedDuplicateCaseCount = 0;
    let addedMemberCount = 0;
    let createdFilePathCount = 0;
    let createdLogCount = 0;
    let failedRowCount = 0;

    for (const pr of preview.rows) {
      const { row } = await this.processPreviewRow(
        pr,
        userId,
        legacyKeyToVisaCaseId,
      );
      rows.push(row);
      switch (row.outcome) {
        case VisaCaseImportCommitOutcome.CASE_CREATED:
          createdCaseCount += 1;
          break;
        case VisaCaseImportCommitOutcome.SKIPPED_DUPLICATE:
          if (pr.recordType === VisaCaseImportRecordType.CASE) {
            skippedDuplicateCaseCount += 1;
          }
          break;
        case VisaCaseImportCommitOutcome.MEMBER_ADDED:
          addedMemberCount += 1;
          break;
        case VisaCaseImportCommitOutcome.FILE_PATH_CREATED:
          createdFilePathCount += 1;
          break;
        case VisaCaseImportCommitOutcome.CASE_LOG_CREATED:
          createdLogCount += 1;
          break;
        case VisaCaseImportCommitOutcome.FAILED:
          failedRowCount += 1;
          break;
        default:
          break;
      }
    }

    let savedBatch: VisaCaseImportBatch;
    try {
      savedBatch = await this.batchRepo.save(
        this.batchRepo.create({
          contentSha256: preview.contentSha256,
          createdBy: userId,
          summary: {
            fileName,
            rowCount: preview.rows.length,
            createdCaseCount,
            skippedDuplicateCaseCount,
            addedMemberCount,
            createdFilePathCount,
            createdLogCount,
            failedRowCount,
          },
        }),
      );
    } catch (e) {
      if (this.rowWriter.isPgUniqueViolation(e)) {
        throw new ConflictException(
          `同一内容の CSV は既に取り込み済みです（code=${VisaCaseImportCommitErrorCode.CSV_ALREADY_IMPORTED}）`,
        );
      }
      throw e;
    }

    await this.auditLogService.createAuditLog({
      userId,
      actionType: AuditActionType.IMPORT,
      targetType: AuditTargetType.VISA_CASE_IMPORT,
      targetId: savedBatch.id,
      afterValue: {
        importBatchId: savedBatch.id,
        contentSha256: preview.contentSha256,
        fileName,
        ...(savedBatch.summary ?? {}),
      },
      result: OperationResult.SUCCESS,
      ipAddress,
      deviceInfo,
    });

    return {
      importBatchId: savedBatch.id,
      contentSha256: preview.contentSha256,
      fileName,
      createdBy: savedBatch.createdBy,
      createdAt: savedBatch.createdAt.toISOString(),
      summary: {
        rowCount: preview.rows.length,
        createdCaseCount,
        skippedDuplicateCaseCount,
        addedMemberCount,
        createdFilePathCount,
        createdLogCount,
        failedRowCount,
      },
      rows,
    };
  }

  /**
   * 将单行预览结果映射为写库动作并返回 outcome。
   *
   * @param pr - 预览服务输出的单行 DTO
   * @param userId - 当前用户 ID
   * @param legacyKeyToVisaCaseId - 顧客+legacy_ref から案件 ID への実行時マップ
   * @returns 单行提交结果
   */
  private async processPreviewRow(
    pr: VisaCaseImportPreviewRowDto,
    userId: string,
    legacyKeyToVisaCaseId: Map<string, string>,
  ): Promise<{ row: VisaCaseImportCommitRowResultDto }> {
    const base = {
      rowNumber: pr.rowNumber,
      recordType: pr.recordType,
    };

    if (pr.status === VisaCaseImportRowStatus.ERROR || !pr.resolved) {
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.FAILED,
          message: 'プレビュー時点でエラー行のためスキップ',
          errorCode: pr.errors[0]?.code,
        },
      };
    }

    const rt = pr.recordType.trim().toUpperCase();
    const r = pr.resolved;

    if (rt === VisaCaseImportRecordType.CASE) {
      return this.rowWriter.commitCaseRow(
        base,
        pr,
        userId,
        legacyKeyToVisaCaseId,
      );
    }
    if (rt === VisaCaseImportRecordType.FAMILY_MEMBER) {
      return this.rowWriter.commitFamilyRow(base, r, legacyKeyToVisaCaseId);
    }
    if (rt === VisaCaseImportRecordType.FILE_PATH) {
      return this.rowWriter.commitFilePathRow(
        base,
        r,
        userId,
        legacyKeyToVisaCaseId,
      );
    }
    if (rt === VisaCaseImportRecordType.CASE_LOG) {
      return this.rowWriter.commitCaseLogRow(
        base,
        r,
        userId,
        legacyKeyToVisaCaseId,
      );
    }

    return {
      row: {
        ...base,
        outcome: VisaCaseImportCommitOutcome.FAILED,
        message: `未対応の record_type: ${pr.recordType}`,
      },
    };
  }
}
