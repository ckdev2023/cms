import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';

import {
  CustomerStatus,
  FamilyLinkMode,
  FamilyRelation,
  FilePathType,
  MaterialStatus,
  VisaCaseFeeStatus,
  VisaCaseLogType,
  VisaCaseMemberRole,
  VisaCaseStatus,
} from '../../common/constants/enums';
import { Customer } from '../customer/entities/customer.entity';
import { VisaCase } from './entities/visa-case.entity';
import {
  VISA_CASE_IMPORT_REQUIRED_HEADERS,
  VisaCaseImportErrorCode,
  VisaCaseImportRecordType,
  type VisaCaseImportRecordTypeValue,
  VisaCaseImportRowStatus,
  type VisaCaseImportRowStatusValue,
  VisaCaseImportWarningCode,
} from './import/visa-case-import.constants';
import { parseImportCsvWithLineNumbers } from './import/visa-case-import-csv.util';

/* eslint-disable max-lines, max-lines-per-function, complexity, jsdoc/require-jsdoc -- P1-S3b 导入预览 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 单行预览结果中的结构化解析结果，供 S3d 表格展示。 */
export interface VisaCaseImportResolvedPreview {
  serviceCustomerId: string;
  legacyCaseRef: string | null;
  case?: {
    isFamilyCase: boolean;
    familyLinkMode: FamilyLinkMode | null;
    internalPrimaryCustomerId: string | null;
    externalPrimaryName: string | null;
    externalPrimaryCaseType: string | null;
    externalPrimaryExpireDate: string | null;
    externalPrimaryRelationToApplicant: FamilyRelation | null;
    caseType: string | null;
    caseStatus: VisaCaseStatus;
    expireDate: string | null;
    nextFollowUpAt: string | null;
    materialStatus: MaterialStatus | null;
    feeStatus: VisaCaseFeeStatus | null;
    memo: string | null;
    assignedTo: string | null;
  };
  familyMember?: {
    memberCustomerId: string;
    memberRole: VisaCaseMemberRole;
    isPrimary: boolean;
    displayNameSnapshot: string;
  };
  filePath?: {
    filePath: string;
    pathType: FilePathType;
    displayName: string | null;
    remark: string | null;
    scopedToCase: boolean;
  };
  caseLog?: {
    logType: VisaCaseLogType;
    content: string;
    submittedItems: string | null;
    missingItems: string | null;
    nextAction: string | null;
    nextFollowUpAt: string | null;
  };
}

/** 单行 CSV 预览结果。 */
export interface VisaCaseImportPreviewRowDto {
  rowNumber: number;
  recordType: string;
  status: VisaCaseImportRowStatusValue;
  errors: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
  resolved?: VisaCaseImportResolvedPreview;
}

/** dry-run 预览整体响应。 */
export interface VisaCaseImportPreviewResultDto {
  dryRun: true;
  contentSha256: string;
  blockingFileErrors: Array<{ code: string; message: string }>;
  summary: {
    rowCount: number;
    okRowCount: number;
    errorRowCount: number;
    warningRowCount: number;
    duplicateSkippedRowCount: number;
    canProceed: boolean;
  };
  rows: VisaCaseImportPreviewRowDto[];
}

/**
 * 解析历史签证导入 CSV 并做只读校验，输出可提交性摘要与行级错误码，不写库。
 */
@Injectable()
export class VisaCaseImportPreviewService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(VisaCase)
    private readonly visaCaseRepo: Repository<VisaCase>,
  ) {}

  /**
   * 对上传文件缓冲区执行 UTF-8 解码、SHA-256 摘要、行级解析与客户/案件只读校验。
   *
   * @param buffer - 原始 CSV 文件二进制内容
   * @returns 含 `canProceed` 与各数据行状态的 dry-run 结果
   */
  async previewFromBuffer(
    buffer: Buffer,
  ): Promise<VisaCaseImportPreviewResultDto> {
    const contentSha256 = createHash('sha256').update(buffer).digest('hex');
    const text = buffer.toString('utf8');
    const { headers, dataRows } = parseImportCsvWithLineNumbers(text);

    const blockingFileErrors: Array<{ code: string; message: string }> = [];

    if (headers.length === 0 && dataRows.length === 0) {
      blockingFileErrors.push({
        code: VisaCaseImportErrorCode.EMPTY_FILE,
        message: 'CSV が空です',
      });
      return this.emptyResult(contentSha256, blockingFileErrors);
    }

    const missingHeader = VISA_CASE_IMPORT_REQUIRED_HEADERS.filter(
      (h) => !headers.includes(h),
    );
    if (missingHeader.length > 0) {
      blockingFileErrors.push({
        code: VisaCaseImportErrorCode.MISSING_RECORD_TYPE_COLUMN,
        message: `必須列がありません: ${missingHeader.join(', ')}`,
      });
      return this.emptyResult(contentSha256, blockingFileErrors);
    }

    const rowObjects = dataRows.map((dr) => ({
      sourceLineNumber: dr.sourceLineNumber,
      obj: this.rowToObject(headers, dr.cells),
    }));

    const legacyKeyCounts = new Map<string, number>();
    for (const { obj } of rowObjects) {
      const rt = this.normalizeRecordType(obj.record_type);
      if (rt !== VisaCaseImportRecordType.CASE) {
        continue;
      }
      const ref = this.trimOrNull(obj.legacy_case_ref);
      if (!ref) {
        continue;
      }
      const custRes = await this.resolveServiceCustomer(obj);
      if (!custRes.ok) {
        continue;
      }
      const k = `${custRes.customerId}\t${ref}`;
      legacyKeyCounts.set(k, (legacyKeyCounts.get(k) ?? 0) + 1);
    }

    for (const [, n] of legacyKeyCounts) {
      if (n > 1) {
        blockingFileErrors.push({
          code: VisaCaseImportErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
          message:
            '同一顧客・legacy_case_ref の CASE 行が CSV 内で重複しています',
        });
        break;
      }
    }

    const caseGroups = new Set<string>();
    for (const { obj } of rowObjects) {
      const rt = this.normalizeRecordType(obj.record_type);
      if (rt !== VisaCaseImportRecordType.CASE) {
        continue;
      }
      const ref = this.trimOrNull(obj.legacy_case_ref);
      if (!ref) {
        continue;
      }
      const custRes = await this.resolveServiceCustomer(obj);
      if (custRes.ok) {
        caseGroups.add(`${custRes.customerId}\t${ref}`);
      }
    }

    const filePathKeys = new Map<string, number>();
    const rows: VisaCaseImportPreviewRowDto[] = [];

    for (const { sourceLineNumber, obj } of rowObjects) {
      const rowResult = await this.validateRow({
        rowNumber: sourceLineNumber,
        obj,
        caseGroups,
        filePathKeys,
        blockingDuplicateLegacy: blockingFileErrors.some(
          (e) =>
            e.code === VisaCaseImportErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
        ),
      });
      rows.push(rowResult);
    }

    let okRowCount = 0;
    let errorRowCount = 0;
    let warningRowCount = 0;
    let duplicateSkippedRowCount = 0;

    for (const r of rows) {
      if (r.status === VisaCaseImportRowStatus.OK) {
        okRowCount += 1;
      } else if (r.status === VisaCaseImportRowStatus.WARNING) {
        warningRowCount += 1;
      } else if (r.status === VisaCaseImportRowStatus.DUPLICATE_SKIPPED) {
        duplicateSkippedRowCount += 1;
      } else if (r.status === VisaCaseImportRowStatus.ERROR) {
        errorRowCount += 1;
      }
    }

    const canProceed = blockingFileErrors.length === 0 && errorRowCount === 0;

    return {
      dryRun: true,
      contentSha256,
      blockingFileErrors,
      summary: {
        rowCount: rows.length,
        okRowCount,
        errorRowCount,
        warningRowCount,
        duplicateSkippedRowCount,
        canProceed,
      },
      rows,
    };
  }

  private emptyResult(
    contentSha256: string,
    blockingFileErrors: Array<{ code: string; message: string }>,
  ): VisaCaseImportPreviewResultDto {
    return {
      dryRun: true,
      contentSha256,
      blockingFileErrors,
      summary: {
        rowCount: 0,
        okRowCount: 0,
        errorRowCount: 0,
        warningRowCount: 0,
        duplicateSkippedRowCount: 0,
        canProceed: false,
      },
      rows: [],
    };
  }

  private rowToObject(
    headers: string[],
    cells: string[],
  ): Record<string, string> {
    const o: Record<string, string> = {};
    for (let i = 0; i < headers.length; i += 1) {
      const key = headers[i];
      if (!key) {
        continue;
      }
      o[key] = (cells[i] ?? '').trim();
    }
    return o;
  }

  private normalizeRecordType(raw: string): VisaCaseImportRecordTypeValue | '' {
    const u = raw.trim().toUpperCase();
    if (
      u === VisaCaseImportRecordType.CASE ||
      u === VisaCaseImportRecordType.FAMILY_MEMBER ||
      u === VisaCaseImportRecordType.FILE_PATH ||
      u === VisaCaseImportRecordType.CASE_LOG
    ) {
      return u as VisaCaseImportRecordTypeValue;
    }
    return '';
  }

  private trimOrNull(v: string | undefined): string | null {
    const t = v?.trim() ?? '';
    return t.length > 0 ? t : null;
  }

  private async validateRow(params: {
    rowNumber: number;
    obj: Record<string, string>;
    caseGroups: Set<string>;
    filePathKeys: Map<string, number>;
    blockingDuplicateLegacy: boolean;
  }): Promise<VisaCaseImportPreviewRowDto> {
    const {
      rowNumber,
      obj,
      caseGroups,
      filePathKeys,
      blockingDuplicateLegacy,
    } = params;

    const errors: Array<{ code: string; message: string }> = [];
    const warnings: Array<{ code: string; message: string }> = [];

    const rtNorm = this.normalizeRecordType(obj.record_type);
    if (!rtNorm) {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_RECORD_TYPE,
        message: 'record_type が無効です',
      });
      return {
        rowNumber,
        recordType: obj.record_type ?? '',
        status: VisaCaseImportRowStatus.ERROR,
        errors,
        warnings,
      };
    }

    const customerResult = await this.resolveServiceCustomer(obj);
    if (!customerResult.ok) {
      errors.push({
        code: customerResult.code,
        message: customerResult.message,
      });
      return {
        rowNumber,
        recordType: rtNorm,
        status: VisaCaseImportRowStatus.ERROR,
        errors,
        warnings,
      };
    }

    const serviceCustomerId = customerResult.customerId;
    const legacyRef = this.trimOrNull(obj.legacy_case_ref);

    if (legacyRef && legacyRef.length > 100) {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_ENUM,
        message: 'legacy_case_ref は 100 文字以内にしてください',
      });
    }

    if (rtNorm === VisaCaseImportRecordType.CASE) {
      return this.validateCaseRow({
        rowNumber,
        recordType: rtNorm,
        obj,
        serviceCustomerId,
        legacyRef,
        errors,
        warnings,
        blockingDuplicateLegacy,
      });
    }

    if (rtNorm === VisaCaseImportRecordType.FAMILY_MEMBER) {
      return this.validateFamilyRow({
        rowNumber,
        recordType: rtNorm,
        obj,
        serviceCustomerId,
        legacyRef,
        caseGroups,
        errors,
        warnings,
      });
    }

    if (rtNorm === VisaCaseImportRecordType.FILE_PATH) {
      return this.validateFilePathRow({
        rowNumber,
        recordType: rtNorm,
        obj,
        serviceCustomerId,
        legacyRef,
        caseGroups,
        filePathKeys,
        errors,
        warnings,
      });
    }

    return this.validateCaseLogRow({
      rowNumber,
      recordType: rtNorm,
      obj,
      serviceCustomerId,
      legacyRef,
      caseGroups,
      errors,
      warnings,
    });
  }

  private async resolveServiceCustomer(
    obj: Record<string, string>,
  ): Promise<
    | { ok: true; customerId: string }
    | { ok: false; code: string; message: string }
  > {
    const idRaw = obj.customer_id?.trim() ?? '';
    const codeRaw = obj.customer_code?.trim() ?? '';

    if (!idRaw && !codeRaw) {
      return {
        ok: false,
        code: VisaCaseImportErrorCode.MISSING_SERVICE_CUSTOMER,
        message: 'customer_id または customer_code のいずれかが必要です',
      };
    }

    if (idRaw) {
      if (!UUID_RE.test(idRaw)) {
        return {
          ok: false,
          code: VisaCaseImportErrorCode.INVALID_UUID,
          message: 'customer_id の UUID 形式が無効です',
        };
      }
      const c = await this.customerRepo.findOne({ where: { id: idRaw } });
      if (!c) {
        return {
          ok: false,
          code: VisaCaseImportErrorCode.CUSTOMER_NOT_FOUND,
          message: '顧客が見つかりません',
        };
      }
      if (c.status !== CustomerStatus.ACTIVE) {
        return {
          ok: false,
          code: VisaCaseImportErrorCode.CUSTOMER_INACTIVE,
          message: '顧客が無効または非アクティブです',
        };
      }
      return { ok: true, customerId: c.id };
    }

    const list = await this.customerRepo.find({
      where: { customerCode: codeRaw },
      take: 2,
    });
    if (list.length === 0) {
      return {
        ok: false,
        code: VisaCaseImportErrorCode.CUSTOMER_NOT_FOUND,
        message: 'customer_code に一致する顧客がありません',
      };
    }
    if (list.length > 1) {
      return {
        ok: false,
        code: VisaCaseImportErrorCode.CUSTOMER_CODE_AMBIGUOUS,
        message: 'customer_code が複数件に一致しました',
      };
    }
    const c = list[0];
    if (c.status !== CustomerStatus.ACTIVE) {
      return {
        ok: false,
        code: VisaCaseImportErrorCode.CUSTOMER_INACTIVE,
        message: '顧客が無効または非アクティブです',
      };
    }
    return { ok: true, customerId: c.id };
  }

  private parseBool(raw: string | undefined): boolean | null {
    const v = raw?.trim().toLowerCase() ?? '';
    if (v === 'true' || v === '1' || v === 'yes') {
      return true;
    }
    if (v === 'false' || v === '0' || v === 'no' || v === '') {
      return v === '' ? null : false;
    }
    return null;
  }

  private parseOptionalDate(raw: string | undefined): string | null {
    const t = raw?.trim() ?? '';
    if (!t) {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      return 'INVALID';
    }
    return t;
  }

  private parseOptionalDateTime(raw: string | undefined): string | null {
    const t = raw?.trim() ?? '';
    if (!t) {
      return null;
    }
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) {
      return 'INVALID';
    }
    return t;
  }

  private pickEnum<T extends string>(
    raw: string | undefined,
    enumObj: Record<string, T>,
    emptyOk: boolean,
  ): T | '' | 'INVALID' {
    const t = raw?.trim() ?? '';
    if (!t) {
      return emptyOk ? '' : 'INVALID';
    }
    const hit = (Object.values(enumObj) as string[]).find(
      (v) => v.toLowerCase() === t.toLowerCase(),
    );
    return (hit as T) ?? 'INVALID';
  }

  private async validateCaseRow(ctx: {
    rowNumber: number;
    recordType: VisaCaseImportRecordTypeValue;
    obj: Record<string, string>;
    serviceCustomerId: string;
    legacyRef: string | null;
    errors: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
    blockingDuplicateLegacy: boolean;
  }): Promise<VisaCaseImportPreviewRowDto> {
    const {
      rowNumber,
      recordType,
      obj,
      serviceCustomerId,
      legacyRef,
      errors,
      warnings,
      blockingDuplicateLegacy,
    } = ctx;

    const isFamily = this.parseBool(obj.is_family_case);
    if (isFamily === null && (obj.is_family_case ?? '').trim() !== '') {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_BOOLEAN,
        message: 'is_family_case が無効です',
      });
    }
    const isFamilyCase = isFamily === true;

    let familyLinkMode: FamilyLinkMode | null = null;
    if (isFamilyCase) {
      const m = this.pickEnum(obj.family_link_mode, FamilyLinkMode, false);
      if (m === 'INVALID' || m === '') {
        errors.push({
          code: VisaCaseImportErrorCode.INVALID_ENUM,
          message: 'family_link_mode が無効です',
        });
      } else {
        familyLinkMode = m as FamilyLinkMode;
      }
    }

    let internalPrimaryCustomerId: string | null = null;
    if (isFamilyCase && familyLinkMode === FamilyLinkMode.INTERNAL) {
      const pId = obj.internal_primary_customer_id?.trim() ?? '';
      const pCode = obj.internal_primary_customer_code?.trim() ?? '';
      if (pId) {
        if (!UUID_RE.test(pId)) {
          errors.push({
            code: VisaCaseImportErrorCode.INVALID_UUID,
            message: 'internal_primary_customer_id が無効です',
          });
        } else {
          const pr = await this.resolveServiceCustomer({
            customer_id: pId,
            customer_code: '',
          });
          if (!pr.ok) {
            errors.push({
              code: VisaCaseImportErrorCode.INTERNAL_REQUIRES_PRIMARY,
              message: '主申請者顧客を解決できません',
            });
          } else {
            internalPrimaryCustomerId = pr.customerId;
          }
        }
      } else if (pCode) {
        const pr = await this.resolveServiceCustomer({
          customer_id: '',
          customer_code: pCode,
        });
        if (!pr.ok) {
          errors.push({
            code: VisaCaseImportErrorCode.INTERNAL_REQUIRES_PRIMARY,
            message: '主申請者 customer_code を解決できません',
          });
        } else {
          internalPrimaryCustomerId = pr.customerId;
        }
      } else {
        errors.push({
          code: VisaCaseImportErrorCode.INTERNAL_REQUIRES_PRIMARY,
          message: 'INTERNAL 家族案件では主申請者の ID または code が必要です',
        });
      }
    }

    let externalPrimaryName: string | null = null;
    let externalPrimaryCaseType: string | null = null;
    let externalPrimaryExpireDate: string | null = null;
    let externalPrimaryRelationToApplicant: FamilyRelation | null = null;
    if (isFamilyCase && familyLinkMode === FamilyLinkMode.EXTERNAL) {
      externalPrimaryName = obj.external_primary_name?.trim() ?? null;
      if (!externalPrimaryName) {
        errors.push({
          code: VisaCaseImportErrorCode.EXTERNAL_REQUIRES_NAME,
          message: 'EXTERNAL 家族案件では external_primary_name が必須です',
        });
      }
      externalPrimaryCaseType =
        this.trimOrNull(obj.external_primary_case_type) ?? null;
      const extEx = this.parseOptionalDate(obj.external_primary_expire_date);
      if (extEx === 'INVALID') {
        errors.push({
          code: VisaCaseImportErrorCode.INVALID_DATE,
          message: 'external_primary_expire_date の形式が無効です',
        });
      } else {
        externalPrimaryExpireDate = extEx;
      }
      const relRaw = this.pickEnum(
        obj.external_primary_relation_to_applicant,
        FamilyRelation,
        true,
      );
      if (relRaw === 'INVALID') {
        errors.push({
          code: VisaCaseImportErrorCode.INVALID_ENUM,
          message:
            'external_primary_relation_to_applicant が無効です（SPOUSE/CHILD/PARENT/OTHER または空）',
        });
      } else if (relRaw !== '') {
        externalPrimaryRelationToApplicant = relRaw as FamilyRelation;
      }
    }

    let caseStatus = VisaCaseStatus.DRAFT;
    const cs = this.pickEnum(obj.case_status, VisaCaseStatus, true);
    if (cs === 'INVALID') {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_ENUM,
        message: 'case_status が無効です',
      });
    } else if (cs !== '') {
      caseStatus = cs as VisaCaseStatus;
    }

    let materialStatus: MaterialStatus | null = null;
    const ms = this.pickEnum(obj.material_status, MaterialStatus, true);
    if (ms === 'INVALID') {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_ENUM,
        message: 'material_status が無効です',
      });
    } else if (ms !== '') {
      materialStatus = ms as MaterialStatus;
    }

    let feeStatus: VisaCaseFeeStatus | null = null;
    const fs = this.pickEnum(obj.fee_status, VisaCaseFeeStatus, true);
    if (fs === 'INVALID') {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_ENUM,
        message: 'fee_status が無効です',
      });
    } else if (fs !== '') {
      feeStatus = fs as VisaCaseFeeStatus;
    }

    const expireDate = this.parseOptionalDate(obj.expire_date);
    if (expireDate === 'INVALID') {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_DATE,
        message: 'expire_date の形式が無効です',
      });
    }

    const nextFollowUpAt = this.parseOptionalDateTime(obj.next_follow_up_at);
    if (nextFollowUpAt === 'INVALID') {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_DATE,
        message: 'next_follow_up_at の形式が無効です',
      });
    }

    const assignedRaw = obj.assigned_to?.trim() ?? '';
    if (assignedRaw && !UUID_RE.test(assignedRaw)) {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_UUID,
        message: 'assigned_to の UUID 形式が無効です',
      });
    }

    if (blockingDuplicateLegacy && legacyRef) {
      errors.push({
        code: VisaCaseImportErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
        message: 'CSV 内 legacy_case_ref 重複のため本行は無効です',
      });
    }

    let duplicateSkipped = false;
    if (legacyRef && errors.length === 0 && !blockingDuplicateLegacy) {
      const existing = await this.visaCaseRepo.findOne({
        where: {
          customerId: serviceCustomerId,
          importReference: legacyRef,
        },
      });
      if (existing) {
        duplicateSkipped = true;
      }
    }

    const resolved: VisaCaseImportResolvedPreview = {
      serviceCustomerId,
      legacyCaseRef: legacyRef,
      case: {
        isFamilyCase,
        familyLinkMode,
        internalPrimaryCustomerId,
        externalPrimaryName,
        externalPrimaryCaseType,
        externalPrimaryExpireDate,
        externalPrimaryRelationToApplicant,
        caseType: this.trimOrNull(obj.case_type),
        caseStatus,
        expireDate: expireDate === 'INVALID' ? null : expireDate,
        nextFollowUpAt: nextFollowUpAt === 'INVALID' ? null : nextFollowUpAt,
        materialStatus,
        feeStatus,
        memo: this.trimOrNull(obj.memo),
        assignedTo: assignedRaw ? assignedRaw : null,
      },
    };

    if (duplicateSkipped) {
      return {
        rowNumber,
        recordType,
        status: VisaCaseImportRowStatus.DUPLICATE_SKIPPED,
        errors: [],
        warnings,
        resolved,
      };
    }

    if (errors.length > 0) {
      return {
        rowNumber,
        recordType,
        status: VisaCaseImportRowStatus.ERROR,
        errors,
        warnings,
      };
    }

    return {
      rowNumber,
      recordType,
      status: VisaCaseImportRowStatus.OK,
      errors,
      warnings,
      resolved,
    };
  }

  private async validateFamilyRow(ctx: {
    rowNumber: number;
    recordType: VisaCaseImportRecordTypeValue;
    obj: Record<string, string>;
    serviceCustomerId: string;
    legacyRef: string | null;
    caseGroups: Set<string>;
    errors: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
  }): Promise<VisaCaseImportPreviewRowDto> {
    const {
      rowNumber,
      recordType,
      obj,
      serviceCustomerId,
      legacyRef,
      caseGroups,
      errors,
      warnings,
    } = ctx;

    if (!legacyRef) {
      errors.push({
        code: VisaCaseImportErrorCode.LEGACY_REF_REQUIRED,
        message: 'FAMILY_MEMBER 行では legacy_case_ref が必須です',
      });
    } else if (!caseGroups.has(`${serviceCustomerId}\t${legacyRef}`)) {
      errors.push({
        code: VisaCaseImportErrorCode.ORPHAN_FAMILY_ROW,
        message: '同一 CSV 内に対応する CASE 行がありません',
      });
    }

    const mId = obj.member_customer_id?.trim() ?? '';
    const mCode = obj.member_customer_code?.trim() ?? '';
    if (!mId && !mCode) {
      errors.push({
        code: VisaCaseImportErrorCode.MEMBER_CUSTOMER_REQUIRED,
        message: 'member_customer_id または member_customer_code が必要です',
      });
    }

    let memberCustomerId = '';
    if (mId) {
      if (!UUID_RE.test(mId)) {
        errors.push({
          code: VisaCaseImportErrorCode.INVALID_UUID,
          message: 'member_customer_id が無効です',
        });
      } else {
        const mr = await this.resolveServiceCustomer({
          customer_id: mId,
          customer_code: '',
        });
        if (!mr.ok) {
          errors.push({
            code: mr.code,
            message: mr.message,
          });
        } else {
          memberCustomerId = mr.customerId;
        }
      }
    } else if (mCode) {
      const mr = await this.resolveServiceCustomer({
        customer_id: '',
        customer_code: mCode,
      });
      if (!mr.ok) {
        errors.push({
          code: mr.code,
          message: mr.message,
        });
      } else {
        memberCustomerId = mr.customerId;
      }
    }

    const role = this.pickEnum(obj.member_role, VisaCaseMemberRole, false);
    if (role === 'INVALID' || role === '') {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_ENUM,
        message: 'member_role が無効です',
      });
    }

    const isPrimaryRaw = this.parseBool(obj.is_primary);
    if (isPrimaryRaw === null && (obj.is_primary ?? '').trim() !== '') {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_BOOLEAN,
        message: 'is_primary が無効です',
      });
    }
    const isPrimary = isPrimaryRaw === true;

    const displayName = obj.display_name_snapshot?.trim() ?? '';
    if (!displayName) {
      errors.push({
        code: VisaCaseImportErrorCode.DISPLAY_NAME_REQUIRED,
        message: 'display_name_snapshot が必須です',
      });
    }

    const resolved: VisaCaseImportResolvedPreview = {
      serviceCustomerId,
      legacyCaseRef: legacyRef,
      familyMember: {
        memberCustomerId,
        memberRole: role as VisaCaseMemberRole,
        isPrimary,
        displayNameSnapshot: displayName,
      },
    };

    if (errors.length > 0) {
      return {
        rowNumber,
        recordType,
        status: VisaCaseImportRowStatus.ERROR,
        errors,
        warnings,
      };
    }

    return {
      rowNumber,
      recordType,
      status: VisaCaseImportRowStatus.OK,
      errors,
      warnings,
      resolved,
    };
  }

  private validateFilePathRow(ctx: {
    rowNumber: number;
    recordType: VisaCaseImportRecordTypeValue;
    obj: Record<string, string>;
    serviceCustomerId: string;
    legacyRef: string | null;
    caseGroups: Set<string>;
    filePathKeys: Map<string, number>;
    errors: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
  }): VisaCaseImportPreviewRowDto {
    const {
      rowNumber,
      recordType,
      obj,
      serviceCustomerId,
      legacyRef,
      caseGroups,
      filePathKeys,
      errors,
      warnings,
    } = ctx;

    const filePath = obj.file_path?.trim() ?? '';
    if (!filePath) {
      errors.push({
        code: VisaCaseImportErrorCode.FILE_PATH_REQUIRED,
        message: 'file_path が必須です',
      });
    }

    if (legacyRef && !caseGroups.has(`${serviceCustomerId}\t${legacyRef}`)) {
      errors.push({
        code: VisaCaseImportErrorCode.ORPHAN_FILE_PATH_ROW,
        message: '案件スコープのパスに対応する CASE 行がありません',
      });
    }

    const pathTypeRaw = this.pickEnum(obj.path_type, FilePathType, true);
    let pathType = FilePathType.OTHER;
    if (pathTypeRaw === 'INVALID') {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_ENUM,
        message: 'path_type が無効です',
      });
    } else if (pathTypeRaw !== '') {
      pathType = pathTypeRaw as FilePathType;
    }

    const fpKey = `${serviceCustomerId}\t${legacyRef ?? ''}\t${filePath}`;
    const prev = filePathKeys.get(fpKey) ?? 0;
    if (prev >= 1 && filePath) {
      warnings.push({
        code: VisaCaseImportWarningCode.FILE_PATH_DUPLICATE_IN_FILE,
        message: '同一顧客・案件キー・file_path の行が CSV 内に重複しています',
      });
    }
    if (filePath) {
      filePathKeys.set(fpKey, prev + 1);
    }

    const resolved: VisaCaseImportResolvedPreview = {
      serviceCustomerId,
      legacyCaseRef: legacyRef,
      filePath: {
        filePath,
        pathType,
        displayName: this.trimOrNull(obj.display_name),
        remark: this.trimOrNull(obj.path_remark ?? obj.remark),
        scopedToCase: Boolean(legacyRef),
      },
    };

    if (errors.length > 0) {
      return {
        rowNumber,
        recordType,
        status: VisaCaseImportRowStatus.ERROR,
        errors,
        warnings,
      };
    }

    const status =
      warnings.length > 0
        ? VisaCaseImportRowStatus.WARNING
        : VisaCaseImportRowStatus.OK;

    return {
      rowNumber,
      recordType,
      status,
      errors,
      warnings,
      resolved,
    };
  }

  private validateCaseLogRow(ctx: {
    rowNumber: number;
    recordType: VisaCaseImportRecordTypeValue;
    obj: Record<string, string>;
    serviceCustomerId: string;
    legacyRef: string | null;
    caseGroups: Set<string>;
    errors: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
  }): VisaCaseImportPreviewRowDto {
    const {
      rowNumber,
      recordType,
      obj,
      serviceCustomerId,
      legacyRef,
      caseGroups,
      errors,
      warnings,
    } = ctx;

    if (!legacyRef) {
      errors.push({
        code: VisaCaseImportErrorCode.LEGACY_REF_REQUIRED,
        message: 'CASE_LOG 行では legacy_case_ref が必須です',
      });
    } else if (!caseGroups.has(`${serviceCustomerId}\t${legacyRef}`)) {
      errors.push({
        code: VisaCaseImportErrorCode.ORPHAN_LOG_ROW,
        message: '同一 CSV 内に対応する CASE 行がありません',
      });
    }

    const logType = this.pickEnum(obj.log_type, VisaCaseLogType, false);
    if (logType === 'INVALID' || logType === '') {
      errors.push({
        code: VisaCaseImportErrorCode.LOG_TYPE_REQUIRED,
        message: 'log_type が無効または空です',
      });
    }

    const content = obj.log_content?.trim() ?? obj.content?.trim() ?? '';
    if (!content) {
      errors.push({
        code: VisaCaseImportErrorCode.LOG_CONTENT_REQUIRED,
        message: 'log_content（または content）が必須です',
      });
    }

    const nextFollowUpAt = this.parseOptionalDateTime(
      obj.log_next_follow_up_at,
    );
    if (nextFollowUpAt === 'INVALID') {
      errors.push({
        code: VisaCaseImportErrorCode.INVALID_DATE,
        message: 'log_next_follow_up_at の形式が無効です',
      });
    }

    const resolved: VisaCaseImportResolvedPreview = {
      serviceCustomerId,
      legacyCaseRef: legacyRef,
      caseLog: {
        logType: logType as VisaCaseLogType,
        content,
        submittedItems: this.trimOrNull(obj.submitted_items),
        missingItems: this.trimOrNull(obj.missing_items),
        nextAction: this.trimOrNull(obj.next_action),
        nextFollowUpAt: nextFollowUpAt === 'INVALID' ? null : nextFollowUpAt,
      },
    };

    if (errors.length > 0) {
      return {
        rowNumber,
        recordType,
        status: VisaCaseImportRowStatus.ERROR,
        errors,
        warnings,
      };
    }

    return {
      rowNumber,
      recordType,
      status: VisaCaseImportRowStatus.OK,
      errors,
      warnings,
      resolved,
    };
  }
}
