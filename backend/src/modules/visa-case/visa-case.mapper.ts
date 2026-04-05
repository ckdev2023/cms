import { Note } from '../customer/entities/note.entity';
import { CustomerFilePath } from './entities/customer-file-path.entity';
import { MaterialTemplate } from './entities/material-template.entity';
import { VisaCase } from './entities/visa-case.entity';
import { VisaCaseFamilyMember } from './entities/visa-case-family-member.entity';
import { VisaCaseMaterialItem } from './entities/visa-case-material-item.entity';
import type {
  CustomerFilePathResponseDto,
  MaterialTemplateResponseDto,
  VisaCaseLogResponseDto,
  VisaCaseMaterialItemResponseDto,
  VisaCaseResponseDto,
} from './visa-case.types';

/**
 * 将案件日志实体映射为列表与详情接口使用的响应结构。
 *
 * @param note - 已加载创建人关联信息的 notes 行
 * @returns 含创建人展示名的日志 DTO
 */
export function mapNoteToVisaCaseLogResponseDto(
  note: Note,
): VisaCaseLogResponseDto {
  return {
    id: note.id,
    visaCaseId: note.visaCaseId!,
    customerId: note.customerId,
    logType: note.logType!,
    content: note.content,
    submittedItems: note.submittedItems,
    missingItems: note.missingItems,
    nextAction: note.nextAction,
    nextFollowUpAt: note.nextFollowUpAt,
    createdBy: note.createdBy,
    creatorName: note.creator?.displayName ?? null,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

/**
 * 将资料路径实体映射为台账接口使用的响应结构。
 *
 * @param fp - 已加载创建人关联信息的 customer_file_paths 行
 * @returns 含路径类型与创建人展示名的 DTO
 */
export function mapCustomerFilePathToResponseDto(
  fp: CustomerFilePath,
): CustomerFilePathResponseDto {
  return {
    id: fp.id,
    customerId: fp.customerId,
    visaCaseId: fp.visaCaseId,
    pathType: fp.pathType,
    filePath: fp.filePath,
    displayName: fp.displayName,
    remark: fp.remark,
    createdBy: fp.createdBy,
    creatorName: fp.creator?.displayName ?? null,
    createdAt: fp.createdAt,
    updatedAt: fp.updatedAt,
  };
}

/**
 * 将签证案件实体映射为详情与列表项使用的响应结构（含家属列表）。
 *
 * @param vc - 已加载负责人、创建人、主申请人与家属关联信息的案件行
 * @returns 扁平案件 DTO
 */
export function mapVisaCaseToResponseDto(vc: VisaCase): VisaCaseResponseDto {
  const customer = vc.customer;
  return {
    id: vc.id,
    customerId: vc.customerId,
    caseType: vc.caseType,
    caseStatus: vc.caseStatus,
    isFamilyCase: vc.isFamilyCase,
    familyLinkMode: vc.familyLinkMode,
    internalPrimaryCustomerId: vc.internalPrimaryCustomerId,
    internalPrimaryCustomerName:
      vc.internalPrimaryCustomer?.customerName ?? null,
    externalPrimaryName: vc.externalPrimaryName,
    externalPrimaryCaseType: vc.externalPrimaryCaseType,
    externalPrimaryExpireDate: vc.externalPrimaryExpireDate,
    externalPrimaryRelationToApplicant: vc.externalPrimaryRelationToApplicant,
    assignedTo: vc.assignedTo,
    assigneeName: vc.assignee?.displayName ?? null,
    expireDate: vc.expireDate,
    nextFollowUpAt: vc.nextFollowUpAt,
    materialStatus: vc.materialStatus,
    feeStatus: vc.feeStatus,
    memo: vc.memo,
    createdBy: vc.createdBy,
    creatorName: vc.creator?.displayName ?? null,
    createdAt: vc.createdAt,
    updatedAt: vc.updatedAt,
    familyMembers: (vc.familyMembers ?? []).map((fm: VisaCaseFamilyMember) => ({
      id: fm.id,
      customerId: fm.customerId,
      customerName: fm.customer?.customerName ?? null,
      memberRole: fm.memberRole,
      isPrimary: fm.isPrimary,
      displayNameSnapshot: fm.displayNameSnapshot,
    })),
    customerName: customer?.customerName ?? undefined,
    customerCode: customer?.customerCode ?? undefined,
  };
}

/**
 * 将材料模板实体映射为含子项列表的响应结构。
 *
 * @param tpl - 已加载 items 关联的模板行
 * @returns 含模板项排序后的响应 DTO
 */
export function mapMaterialTemplateToResponseDto(
  tpl: MaterialTemplate,
): MaterialTemplateResponseDto {
  return {
    id: tpl.id,
    caseType: tpl.caseType,
    displayName: tpl.displayName,
    isActive: tpl.isActive,
    items: (tpl.items ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        groupName: item.groupName,
        itemName: item.itemName,
        scope: item.scope,
        sortOrder: item.sortOrder,
        isRequired: item.isRequired,
      })),
    createdAt: tpl.createdAt,
    updatedAt: tpl.updatedAt,
  };
}

/**
 * 将案件材料实例实体映射为 checklist 列表使用的响应结构。
 *
 * @param item - 可能已加载 familyMember 关联的实例行
 * @returns 含家属归属展示名的材料项 DTO
 */
export function mapMaterialItemToResponseDto(
  item: VisaCaseMaterialItem,
): VisaCaseMaterialItemResponseDto {
  return {
    id: item.id,
    visaCaseId: item.visaCaseId,
    templateItemId: item.templateItemId,
    visaCaseFamilyMemberId: item.visaCaseFamilyMemberId,
    familyMemberName: item.familyMember?.displayNameSnapshot ?? null,
    groupName: item.groupName,
    itemName: item.itemName,
    itemStatus: item.itemStatus,
    sortOrder: item.sortOrder,
    remark: item.remark,
    collectedAt: item.collectedAt,
    createdBy: item.createdBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

const DATE_ONLY_YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 将 pg `date` 常见的 YYYY-MM-DD 字符串或 Date 转为本地日历日运算用的 Date（避免 UTC 解析导致日界偏移）。
 *
 * @param value - TypeORM 或 node-pg 返回的日期时刻
 * @returns 可用于 getFullYear/getMonth/getDate 的 Date
 * @throws {TypeError} 无法解析或为 Invalid Date 时
 */
function coerceToLocalCalendarDate(value: Date | string): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new TypeError('Invalid Date');
    }
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const m = DATE_ONLY_YMD.exec(trimmed);
    if (m) {
      const y = Number(m[1]);
      const monthIndex = Number(m[2]) - 1;
      const day = Number(m[3]);
      return new Date(y, monthIndex, day);
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new TypeError(`Invalid date string: ${trimmed}`);
    }
    return parsed;
  }
  throw new TypeError('Expected Date or date string');
}

/**
 * 将日期按本地日历格式化为 YYYY-MM-DD，避免 toISOString 的 UTC 日界偏差。
 *
 * @param d - 待格式化的时刻（含 pg `date` 常见的 YYYY-MM-DD 字符串）
 * @returns 本地日历日期的连字符字符串
 */
export function formatLocalDateYyyyMmDd(d: Date | string): string {
  const x = coerceToLocalCalendarDate(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 在本地日历上对基准日增加若干自然日。
 *
 * @param base - 基准日期（含 pg `date` 常见的 YYYY-MM-DD 字符串）
 * @param days - 增加的天数（可为负）
 * @returns 运算后的日期对象
 */
export function addLocalCalendarDays(base: Date | string, days: number): Date {
  const b = coerceToLocalCalendarDate(base);
  const d = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * 计算目标日期相对基准日的自然日差（按 UTC 日界对齐到日历日）。
 *
 * @param target - 目标日期（含 pg `date` 常见的 YYYY-MM-DD 字符串）
 * @param from - 基准日期，默认当天
 * @returns 未到期为正、已过期为负的整天差
 */
export function calendarDaysUntil(
  target: Date | string,
  from: Date | string = new Date(),
): number {
  const t = coerceToLocalCalendarDate(target);
  const f = coerceToLocalCalendarDate(from);
  const tu = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  const fu = Date.UTC(f.getFullYear(), f.getMonth(), f.getDate());
  return Math.round((tu - fu) / 86_400_000);
}
