/* eslint-disable max-lines-per-function, complexity -- CASE 行写入分支与导入提交流程一致 */
import { QueryFailedError, Repository } from 'typeorm';

import { CreateCustomerFilePathDto } from './dto/create-customer-file-path.dto';
import { CreateVisaCaseDto } from './dto/create-visa-case.dto';
import { CreateVisaCaseFamilyMemberDto } from './dto/create-visa-case-family-member.dto';
import { CreateVisaCaseLogDto } from './dto/create-visa-case-log.dto';
import { VisaCase } from './entities/visa-case.entity';
import {
  VisaCaseImportCommitOutcome,
  VisaCaseImportRowStatus,
} from './import/visa-case-import.constants';
import { VisaCaseService } from './visa-case.service';
import { VisaCaseFamilyMemberService } from './visa-case-family-member.service';
import { VisaCaseFilePathService } from './visa-case-file-path.service';
import type { VisaCaseImportCommitRowResultDto } from './visa-case-import-commit.types';
import type { VisaCaseImportPreviewRowDto } from './visa-case-import-preview.service';
import { VisaCaseLogService } from './visa-case-log.service';

/**
 * 将预览行映射为案件/家属/路径/日志的写库调用，供导入提交主服务组合使用。
 */
export class VisaCaseImportCommitRowWriter {
  constructor(
    private readonly visaCaseService: VisaCaseService,
    private readonly familyMemberService: VisaCaseFamilyMemberService,
    private readonly filePathService: VisaCaseFilePathService,
    private readonly visaCaseLogService: VisaCaseLogService,
    private readonly visaCaseRepo: Repository<VisaCase>,
  ) {}

  caseRefKey(
    serviceCustomerId: string,
    legacyRef: string | null,
  ): string | null {
    if (!legacyRef) {
      return null;
    }
    return `${serviceCustomerId}\t${legacyRef}`;
  }

  isPgUniqueViolation(err: unknown): boolean {
    return (
      err instanceof QueryFailedError &&
      (err as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    );
  }

  async commitCaseRow(
    base: { rowNumber: number; recordType: string },
    pr: VisaCaseImportPreviewRowDto,
    userId: string,
    legacyKeyToVisaCaseId: Map<string, string>,
  ): Promise<{ row: VisaCaseImportCommitRowResultDto }> {
    const r = pr.resolved!;
    const key = this.caseRefKey(r.serviceCustomerId, r.legacyCaseRef);

    if (pr.status === VisaCaseImportRowStatus.DUPLICATE_SKIPPED) {
      if (r.legacyCaseRef) {
        const existing = await this.visaCaseRepo.findOne({
          where: {
            customerId: r.serviceCustomerId,
            importReference: r.legacyCaseRef,
          },
        });
        if (existing && key) {
          legacyKeyToVisaCaseId.set(key, existing.id);
        }
        return {
          row: {
            ...base,
            outcome: VisaCaseImportCommitOutcome.SKIPPED_DUPLICATE,
            message: '既存案件のため案件行をスキップ',
            visaCaseId: existing?.id,
          },
        };
      }
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.SKIPPED_DUPLICATE,
          message: '重複スキップ（legacy_case_ref なし）',
        },
      };
    }

    const c = r.case!;
    const dto: CreateVisaCaseDto = {
      customerId: r.serviceCustomerId,
      caseType: c.caseType ?? undefined,
      caseStatus: c.caseStatus,
      isFamilyCase: c.isFamilyCase,
      familyLinkMode: c.familyLinkMode ?? undefined,
      internalPrimaryCustomerId: c.internalPrimaryCustomerId ?? undefined,
      externalPrimaryName: c.externalPrimaryName ?? undefined,
      externalPrimaryCaseType: c.externalPrimaryCaseType ?? undefined,
      externalPrimaryExpireDate: c.externalPrimaryExpireDate ?? undefined,
      externalPrimaryRelationToApplicant:
        c.externalPrimaryRelationToApplicant ?? undefined,
      expireDate: c.expireDate ?? undefined,
      nextFollowUpAt: c.nextFollowUpAt ?? undefined,
      materialStatus: c.materialStatus ?? undefined,
      feeStatus: c.feeStatus ?? undefined,
      memo: c.memo ?? undefined,
      assignedTo: c.assignedTo ?? undefined,
      importReference: r.legacyCaseRef ?? undefined,
    };

    try {
      const created = await this.visaCaseService.create(
        r.serviceCustomerId,
        dto,
        userId,
      );
      if (key) {
        legacyKeyToVisaCaseId.set(key, created.id);
      }
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.CASE_CREATED,
          visaCaseId: created.id,
          entityId: created.id,
        },
      };
    } catch (e) {
      if (this.isPgUniqueViolation(e) && r.legacyCaseRef) {
        const existing = await this.visaCaseRepo.findOne({
          where: {
            customerId: r.serviceCustomerId,
            importReference: r.legacyCaseRef,
          },
        });
        if (existing && key) {
          legacyKeyToVisaCaseId.set(key, existing.id);
        }
        return {
          row: {
            ...base,
            outcome: VisaCaseImportCommitOutcome.SKIPPED_DUPLICATE,
            message: '作成時に重複制約により既存案件に合流',
            visaCaseId: existing?.id,
          },
        };
      }
      const msg = e instanceof Error ? e.message : String(e);
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.FAILED,
          message: msg,
        },
      };
    }
  }

  async commitFamilyRow(
    base: { rowNumber: number; recordType: string },
    r: NonNullable<VisaCaseImportPreviewRowDto['resolved']>,
    legacyKeyToVisaCaseId: Map<string, string>,
  ): Promise<{ row: VisaCaseImportCommitRowResultDto }> {
    const key = this.caseRefKey(r.serviceCustomerId, r.legacyCaseRef);
    const visaCaseId = key ? legacyKeyToVisaCaseId.get(key) : undefined;
    if (!visaCaseId) {
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.FAILED,
          message:
            '案件 ID を解決できません（先頭の CASE 行の失敗または順序不整合の可能性）',
        },
      };
    }
    const fm = r.familyMember!;
    const dto: CreateVisaCaseFamilyMemberDto = {
      customerId: fm.memberCustomerId,
      memberRole: fm.memberRole,
      isPrimary: fm.isPrimary,
      displayNameSnapshot: fm.displayNameSnapshot,
    };
    try {
      const created = await this.familyMemberService.addFamilyMember(
        visaCaseId,
        dto,
      );
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.MEMBER_ADDED,
          visaCaseId,
          entityId: created.id,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.FAILED,
          message: msg,
        },
      };
    }
  }

  async commitFilePathRow(
    base: { rowNumber: number; recordType: string },
    r: NonNullable<VisaCaseImportPreviewRowDto['resolved']>,
    userId: string,
    legacyKeyToVisaCaseId: Map<string, string>,
  ): Promise<{ row: VisaCaseImportCommitRowResultDto }> {
    const fp = r.filePath!;
    let visaCaseId: string | undefined;
    if (fp.scopedToCase && r.legacyCaseRef) {
      const key = this.caseRefKey(r.serviceCustomerId, r.legacyCaseRef);
      visaCaseId = key ? legacyKeyToVisaCaseId.get(key) : undefined;
      if (!visaCaseId) {
        return {
          row: {
            ...base,
            outcome: VisaCaseImportCommitOutcome.FAILED,
            message: '案件スコープのパスに対応する案件 ID が未解決です',
          },
        };
      }
    }
    const dto: CreateCustomerFilePathDto = {
      customerId: r.serviceCustomerId,
      visaCaseId,
      pathType: fp.pathType,
      filePath: fp.filePath,
      displayName: fp.displayName ?? undefined,
      remark: fp.remark ?? undefined,
    };
    try {
      const created = await this.filePathService.createFilePath(
        r.serviceCustomerId,
        dto,
        userId,
      );
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.FILE_PATH_CREATED,
          visaCaseId,
          entityId: created.id,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.FAILED,
          message: msg,
        },
      };
    }
  }

  async commitCaseLogRow(
    base: { rowNumber: number; recordType: string },
    r: NonNullable<VisaCaseImportPreviewRowDto['resolved']>,
    userId: string,
    legacyKeyToVisaCaseId: Map<string, string>,
  ): Promise<{ row: VisaCaseImportCommitRowResultDto }> {
    const key = this.caseRefKey(r.serviceCustomerId, r.legacyCaseRef);
    const visaCaseId = key ? legacyKeyToVisaCaseId.get(key) : undefined;
    if (!visaCaseId) {
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.FAILED,
          message: '案件ログに対応する案件 ID が未解決です',
        },
      };
    }
    const log = r.caseLog!;
    const dto: CreateVisaCaseLogDto = {
      logType: log.logType,
      content: log.content,
      submittedItems: log.submittedItems ?? undefined,
      missingItems: log.missingItems ?? undefined,
      nextAction: log.nextAction ?? undefined,
      nextFollowUpAt: log.nextFollowUpAt ?? undefined,
    };
    try {
      const created = await this.visaCaseLogService.createLog(
        visaCaseId,
        dto,
        userId,
      );
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.CASE_LOG_CREATED,
          visaCaseId,
          entityId: created.id,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        row: {
          ...base,
          outcome: VisaCaseImportCommitOutcome.FAILED,
          message: msg,
        },
      };
    }
  }
}
