import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import {
  FamilyLinkMode,
  MaterialStatus,
  VisaCaseFeeStatus,
  VisaCaseStatus,
  VisaDataScope,
  VisaReminderType,
} from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 将查询字符串中的重复键或逗号分隔值规范为字符串数组，供多选枚举筛选使用。
 *
 * @param value - 原始查询值
 * @returns 去空后的字符串数组，未提供时返回 `undefined`
 */
function toOptionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const v of value) {
      if (typeof v === 'string') {
        const t = v.trim();
        if (t) out.push(t);
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        out.push(String(v));
      }
    }
    return out.length ? out : undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const parts = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

/**
 * 跨客户签证案件分页列表查询条件，承载 S4a 冻結筛选维度与分页上限（单页最大 100 条）。
 */
export class QueryGlobalVisaCaseListDto extends PaginationDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  override pageSize?: number = 20;

  @ApiPropertyOptional({
    format: 'uuid',
    description: '服务上下文客户 ID（精确）',
  })
  @IsOptional()
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId?: string;

  @ApiPropertyOptional({
    description: '客户名称或 customer_code 模糊匹配（ILIKE）',
  })
  @IsOptional()
  @IsString()
  customerKeyword?: string;

  @ApiPropertyOptional({
    enum: VisaCaseStatus,
    isArray: true,
    description: '案件状态多选，可重复 query 或逗号分隔',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalStringArray(value))
  @IsEnum(VisaCaseStatus, { each: true, message: '案件ステータスが無効です' })
  caseStatuses?: VisaCaseStatus[];

  @ApiPropertyOptional({
    format: 'uuid',
    isArray: true,
    description: '负责人多选',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalStringArray(value))
  @IsUUID('4', { each: true, message: '担当者IDの形式が無効です' })
  assignedToIds?: string[];

  @ApiPropertyOptional({ description: '仅未指定负责人的案件' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  unassignedOnly?: boolean;

  @ApiPropertyOptional({
    enum: MaterialStatus,
    isArray: true,
    description: '材料摘要状态多选',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalStringArray(value))
  @IsEnum(MaterialStatus, { each: true, message: '材料ステータスが無効です' })
  materialStatuses?: MaterialStatus[];

  @ApiPropertyOptional({
    enum: VisaCaseFeeStatus,
    isArray: true,
    description: '费用状态多选',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalStringArray(value))
  @IsEnum(VisaCaseFeeStatus, {
    each: true,
    message: '費用ステータスが無効です',
  })
  feeStatuses?: VisaCaseFeeStatus[];

  @ApiPropertyOptional({ description: '到期日下限（含），YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  expireDateFrom?: string;

  @ApiPropertyOptional({ description: '到期日上限（含），YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  expireDateTo?: string;

  @ApiPropertyOptional({
    description: '案件字段 next_follow_up_at 下限（ISO 日期时间）',
  })
  @IsOptional()
  @IsDateString()
  nextFollowUpAtFrom?: string;

  @ApiPropertyOptional({
    description: '案件字段 next_follow_up_at 上限（ISO 日期时间）',
  })
  @IsOptional()
  @IsDateString()
  nextFollowUpAtTo?: string;

  @ApiPropertyOptional({ description: '是否家族签案件' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  isFamilyCase?: boolean;

  @ApiPropertyOptional({ enum: FamilyLinkMode })
  @IsOptional()
  @IsEnum(FamilyLinkMode)
  familyLinkMode?: FamilyLinkMode;

  @ApiPropertyOptional({
    description:
      '补件相关：case_status=SUPPLEMENT 或最新日志命中补件规则（与 /visa-reminders 补件桶判定一致）',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === '') return undefined;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return undefined;
  })
  @IsBoolean()
  supplementRelated?: boolean;

  @ApiPropertyOptional({
    enum: VisaReminderType,
    description:
      '按 P0 提醒去重后的主桶筛选（排除 COMPLETED/CANCELLED）；与列表排序优先级一致',
  })
  @IsOptional()
  @IsEnum(VisaReminderType)
  reminderBucket?: VisaReminderType;

  @ApiPropertyOptional({
    enum: VisaDataScope,
    description:
      '签证域数据范围（docs/21 §18）；缺省 all。越宽请求需对应 `visaCase:dataScopeMine` / `dataScopeTeam` / `dataScopeAll` 权限（P2-S2d）；与负责人多选筛选取交集',
  })
  @IsOptional()
  @IsEnum(VisaDataScope)
  dataScope?: VisaDataScope;
}
