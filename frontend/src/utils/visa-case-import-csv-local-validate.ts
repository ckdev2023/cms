/**
 * 签证 CSV 本地结构校验：按记录类型分发到 CASE / 家属 / 路径 / 日志行规则（无 DB）。
 */

/* eslint-disable max-lines-per-function, complexity -- 本地校验分支与后端 preview 逐项对齐（docs/24） */

import {
  FamilyLinkMode,
  FamilyRelation,
  FilePathType,
  MaterialStatus,
  VisaCaseFeeStatus,
  VisaCaseLogType,
  VisaCaseMemberRole,
  VisaCaseStatus,
} from '@/constants/enums'

import {
  VISA_CASE_IMPORT_LOCAL_UUID_RE,
  VISA_CASE_IMPORT_RT_CASE,
  VISA_CASE_IMPORT_RT_FAMILY,
  VISA_CASE_IMPORT_RT_FILE_PATH,
  visaCaseImportLocalNormalizeRecordType,
  visaCaseImportLocalParseBool,
  visaCaseImportLocalParseOptionalDate,
  visaCaseImportLocalParseOptionalDateTime,
  visaCaseImportLocalPickEnum,
  visaCaseImportLocalResolveCustomerKey,
  visaCaseImportLocalTrimOrNull,
} from './visa-case-import-csv-local-helpers'
import type { VisaCaseImportLocalAnalyzeRow } from './visa-case-import-csv-local-types'
import { VisaCaseImportPreviewErrorCode, VisaCaseImportPreviewWarningCode } from './visa-case-import-preview-codes'

/**
 * 校验单行 CSV 对象并汇总 errors/warnings。
 *
 * @param params - 单行校验入参对象
 * @param params.sourceLineNumber - 物理行号（1-based）
 * @param params.obj - 列名到小写后的字段映射
 * @param params.caseGroups - 本文件内已出现的「客户键 + legacy ref」CASE 组
 * @param params.filePathKeys - 路径去重计数（用于 §6.1 警告）
 * @param params.blockingDuplicateLegacy - 是否已判定整表 legacy 重复阻断
 * @returns 该行本地结果
 */
export function visaCaseImportLocalValidateRow(params: {
  sourceLineNumber: number
  obj: Record<string, string>
  caseGroups: ReadonlySet<string>
  filePathKeys: Map<string, number>
  blockingDuplicateLegacy: boolean
}): VisaCaseImportLocalAnalyzeRow {
  const { sourceLineNumber, obj, caseGroups, filePathKeys, blockingDuplicateLegacy } =
    params

  const errors: Array<{ code: string; message: string }> = []
  const warnings: Array<{ code: string; message: string }> = []

  const rtNorm = visaCaseImportLocalNormalizeRecordType(obj.record_type)
  if (!rtNorm) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_RECORD_TYPE,
      message: 'record_type が無効です',
    })
    return { sourceLineNumber, recordType: obj.record_type ?? '', errors, warnings }
  }

  const customerResult = visaCaseImportLocalResolveCustomerKey(obj)
  if (!customerResult.ok) {
    errors.push({ code: customerResult.code, message: customerResult.message })
    return { sourceLineNumber, recordType: rtNorm, errors, warnings }
  }

  const serviceCustomerKey = customerResult.key
  const legacyRef = visaCaseImportLocalTrimOrNull(obj.legacy_case_ref)

  if (legacyRef && legacyRef.length > 100) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_ENUM,
      message: 'legacy_case_ref は 100 文字以内にしてください',
    })
  }

  if (rtNorm === VISA_CASE_IMPORT_RT_CASE) {
    validateCaseRowLocal({
      obj,
      legacyRef,
      errors,
      blockingDuplicateLegacy,
    })
  } else if (rtNorm === VISA_CASE_IMPORT_RT_FAMILY) {
    validateFamilyRowLocal({
      obj,
      serviceCustomerKey,
      legacyRef,
      caseGroups,
      errors,
    })
  } else if (rtNorm === VISA_CASE_IMPORT_RT_FILE_PATH) {
    validateFilePathRowLocal({
      obj,
      serviceCustomerKey,
      legacyRef,
      caseGroups,
      filePathKeys,
      errors,
      warnings,
    })
  } else {
    validateCaseLogRowLocal({
      obj,
      serviceCustomerKey,
      legacyRef,
      caseGroups,
      errors,
    })
  }

  return { sourceLineNumber, recordType: rtNorm, errors, warnings }
}

/**
 * 校验 CASE 行字段（家族签、枚举、日期、assigned_to、legacy 重复行级标记）。
 *
 * @param ctx - CASE 行校验上下文
 * @param ctx.obj - 列名到小写后的字段映射
 * @param ctx.legacyRef - 规范化后的 legacy ref 或 null
 * @param ctx.errors - 行级错误收集数组
 * @param ctx.blockingDuplicateLegacy - 整表 legacy 重复时对本行追加 DUPLICATE 码
 */
function validateCaseRowLocal(ctx: {
  obj: Record<string, string>
  legacyRef: string | null
  errors: Array<{ code: string; message: string }>
  blockingDuplicateLegacy: boolean
}): void {
  const { obj, legacyRef, errors, blockingDuplicateLegacy } = ctx

  const isFamily = visaCaseImportLocalParseBool(obj.is_family_case)
  if (isFamily === null && (obj.is_family_case ?? '').trim() !== '') {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_BOOLEAN,
      message: 'is_family_case が無効です',
    })
  }
  const isFamilyCase = isFamily === true

  let familyLinkMode: FamilyLinkMode | null = null
  if (isFamilyCase) {
    const m = visaCaseImportLocalPickEnum(obj.family_link_mode, FamilyLinkMode, false)
    if (m === 'INVALID' || m === '') {
      errors.push({
        code: VisaCaseImportPreviewErrorCode.INVALID_ENUM,
        message: 'family_link_mode が無効です',
      })
    } else {
      familyLinkMode = m as FamilyLinkMode
    }
  }

  if (isFamilyCase && familyLinkMode === FamilyLinkMode.INTERNAL) {
    const pId = obj.internal_primary_customer_id?.trim() ?? ''
    const pCode = obj.internal_primary_customer_code?.trim() ?? ''
    if (pId) {
      if (!VISA_CASE_IMPORT_LOCAL_UUID_RE.test(pId)) {
        errors.push({
          code: VisaCaseImportPreviewErrorCode.INVALID_UUID,
          message: 'internal_primary_customer_id が無効です',
        })
      }
    } else if (!pCode) {
      errors.push({
        code: VisaCaseImportPreviewErrorCode.INTERNAL_REQUIRES_PRIMARY,
        message: 'INTERNAL 家族案件では主申請者の ID または code が必要です',
      })
    }
  }

  if (isFamilyCase && familyLinkMode === FamilyLinkMode.EXTERNAL) {
    const externalPrimaryName = obj.external_primary_name?.trim() ?? ''
    if (!externalPrimaryName) {
      errors.push({
        code: VisaCaseImportPreviewErrorCode.EXTERNAL_REQUIRES_NAME,
        message: 'EXTERNAL 家族案件では external_primary_name が必須です',
      })
    }
    const extEx = visaCaseImportLocalParseOptionalDate(obj.external_primary_expire_date)
    if (extEx === 'INVALID') {
      errors.push({
        code: VisaCaseImportPreviewErrorCode.INVALID_DATE,
        message: 'external_primary_expire_date の形式が無効です',
      })
    }
    const relRaw = visaCaseImportLocalPickEnum(
      obj.external_primary_relation_to_applicant,
      FamilyRelation,
      true,
    )
    if (relRaw === 'INVALID') {
      errors.push({
        code: VisaCaseImportPreviewErrorCode.INVALID_ENUM,
        message:
          'external_primary_relation_to_applicant が無効です（SPOUSE/CHILD/PARENT/OTHER または空）',
      })
    }
  }

  const cs = visaCaseImportLocalPickEnum(obj.case_status, VisaCaseStatus, true)
  if (cs === 'INVALID') {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_ENUM,
      message: 'case_status が無効です',
    })
  }

  const ms = visaCaseImportLocalPickEnum(obj.material_status, MaterialStatus, true)
  if (ms === 'INVALID') {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_ENUM,
      message: 'material_status が無効です',
    })
  }

  const fs = visaCaseImportLocalPickEnum(obj.fee_status, VisaCaseFeeStatus, true)
  if (fs === 'INVALID') {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_ENUM,
      message: 'fee_status が無効です',
    })
  }

  const expireDate = visaCaseImportLocalParseOptionalDate(obj.expire_date)
  if (expireDate === 'INVALID') {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_DATE,
      message: 'expire_date の形式が無効です',
    })
  }

  const nextFollowUpAt = visaCaseImportLocalParseOptionalDateTime(obj.next_follow_up_at)
  if (nextFollowUpAt === 'INVALID') {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_DATE,
      message: 'next_follow_up_at の形式が無効です',
    })
  }

  const assignedRaw = obj.assigned_to?.trim() ?? ''
  if (assignedRaw && !VISA_CASE_IMPORT_LOCAL_UUID_RE.test(assignedRaw)) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_UUID,
      message: 'assigned_to の UUID 形式が無効です',
    })
  }

  if (blockingDuplicateLegacy && legacyRef) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.DUPLICATE_LEGACY_REF_IN_FILE,
      message: 'CSV 内 legacy_case_ref 重複のため本行は無効です',
    })
  }
}

/**
 * 校验 FAMILY_MEMBER 行（legacy、orphan、成员客户、角色、布尔、表示名）。
 *
 * @param ctx - 家属行校验上下文
 * @param ctx.obj - 列名到小写后的字段映射
 * @param ctx.serviceCustomerKey - 本地客户键（UUID 小写或 code: 前缀）
 * @param ctx.legacyRef - legacy ref 或 null
 * @param ctx.caseGroups - 本文件内 CASE 组集合
 * @param ctx.errors - 行级错误收集数组
 */
function validateFamilyRowLocal(ctx: {
  obj: Record<string, string>
  serviceCustomerKey: string
  legacyRef: string | null
  caseGroups: ReadonlySet<string>
  errors: Array<{ code: string; message: string }>
}): void {
  const { obj, serviceCustomerKey, legacyRef, caseGroups, errors } = ctx

  if (!legacyRef) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.LEGACY_REF_REQUIRED,
      message: 'FAMILY_MEMBER 行では legacy_case_ref が必須です',
    })
  } else if (!caseGroups.has(`${serviceCustomerKey}\t${legacyRef}`)) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.ORPHAN_FAMILY_ROW,
      message: '同一 CSV 内に対応する CASE 行がありません',
    })
  }

  const mId = obj.member_customer_id?.trim() ?? ''
  const mCode = obj.member_customer_code?.trim() ?? ''
  if (!mId && !mCode) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.MEMBER_CUSTOMER_REQUIRED,
      message: 'member_customer_id または member_customer_code が必要です',
    })
  }

  if (mId && !VISA_CASE_IMPORT_LOCAL_UUID_RE.test(mId)) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_UUID,
      message: 'member_customer_id が無効です',
    })
  }

  const role = visaCaseImportLocalPickEnum(obj.member_role, VisaCaseMemberRole, false)
  if (role === 'INVALID' || role === '') {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_ENUM,
      message: 'member_role が無効です',
    })
  }

  const isPrimaryRaw = visaCaseImportLocalParseBool(obj.is_primary)
  if (isPrimaryRaw === null && (obj.is_primary ?? '').trim() !== '') {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_BOOLEAN,
      message: 'is_primary が無効です',
    })
  }

  const displayName = obj.display_name_snapshot?.trim() ?? ''
  if (!displayName) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.DISPLAY_NAME_REQUIRED,
      message: 'display_name_snapshot が必須です',
    })
  }
}

/**
 * 校验 FILE_PATH 行（路径必填、orphan、path_type、文件内重复警告）。
 *
 * @param ctx - 资料路径行校验上下文
 * @param ctx.obj - 列名到小写后的字段映射
 * @param ctx.serviceCustomerKey - 本地客户键
 * @param ctx.legacyRef - legacy ref 或 null（空表示客户级路径）
 * @param ctx.caseGroups - CASE 组集合
 * @param ctx.filePathKeys - 路径重复计数 Map
 * @param ctx.errors - 行级错误收集数组
 * @param ctx.warnings - 行级警告收集数组
 */
function validateFilePathRowLocal(ctx: {
  obj: Record<string, string>
  serviceCustomerKey: string
  legacyRef: string | null
  caseGroups: ReadonlySet<string>
  filePathKeys: Map<string, number>
  errors: Array<{ code: string; message: string }>
  warnings: Array<{ code: string; message: string }>
}): void {
  const { obj, serviceCustomerKey, legacyRef, caseGroups, filePathKeys, errors, warnings } =
    ctx

  const filePath = obj.file_path?.trim() ?? ''
  if (!filePath) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.FILE_PATH_REQUIRED,
      message: 'file_path が必須です',
    })
  }

  if (legacyRef && !caseGroups.has(`${serviceCustomerKey}\t${legacyRef}`)) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.ORPHAN_FILE_PATH_ROW,
      message: '案件スコープのパスに対応する CASE 行がありません',
    })
  }

  const pathTypeRaw = visaCaseImportLocalPickEnum(obj.path_type, FilePathType, true)
  if (pathTypeRaw === 'INVALID') {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_ENUM,
      message: 'path_type が無効です',
    })
  }

  const fpKey = `${serviceCustomerKey}\t${legacyRef ?? ''}\t${filePath}`
  const prev = filePathKeys.get(fpKey) ?? 0
  if (prev >= 1 && filePath) {
    warnings.push({
      code: VisaCaseImportPreviewWarningCode.FILE_PATH_DUPLICATE_IN_FILE,
      message: '同一顧客・案件キー・file_path の行が CSV 内に重複しています',
    })
  }
  if (filePath) {
    filePathKeys.set(fpKey, prev + 1)
  }
}

/**
 * 校验 CASE_LOG 行（legacy、orphan、log_type、正文、跟进时间）。
 *
 * @param ctx - 案件日志行校验上下文
 * @param ctx.obj - 列名到小写后的字段映射
 * @param ctx.serviceCustomerKey - 本地客户键
 * @param ctx.legacyRef - legacy ref 或 null
 * @param ctx.caseGroups - CASE 组集合
 * @param ctx.errors - 行级错误收集数组
 */
function validateCaseLogRowLocal(ctx: {
  obj: Record<string, string>
  serviceCustomerKey: string
  legacyRef: string | null
  caseGroups: ReadonlySet<string>
  errors: Array<{ code: string; message: string }>
}): void {
  const { obj, serviceCustomerKey, legacyRef, caseGroups, errors } = ctx

  if (!legacyRef) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.LEGACY_REF_REQUIRED,
      message: 'CASE_LOG 行では legacy_case_ref が必須です',
    })
  } else if (!caseGroups.has(`${serviceCustomerKey}\t${legacyRef}`)) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.ORPHAN_LOG_ROW,
      message: '同一 CSV 内に対応する CASE 行がありません',
    })
  }

  const logType = visaCaseImportLocalPickEnum(obj.log_type, VisaCaseLogType, false)
  if (logType === 'INVALID' || logType === '') {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.LOG_TYPE_REQUIRED,
      message: 'log_type が無効または空です',
    })
  }

  const content = obj.log_content?.trim() ?? obj.content?.trim() ?? ''
  if (!content) {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.LOG_CONTENT_REQUIRED,
      message: 'log_content（または content）が必須です',
    })
  }

  const nextFollowUpAt = visaCaseImportLocalParseOptionalDateTime(obj.log_next_follow_up_at)
  if (nextFollowUpAt === 'INVALID') {
    errors.push({
      code: VisaCaseImportPreviewErrorCode.INVALID_DATE,
      message: 'log_next_follow_up_at の形式が無効です',
    })
  }
}
