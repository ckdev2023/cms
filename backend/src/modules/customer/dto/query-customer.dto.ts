import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  CustomerStatus,
  CustomerType,
  FamilyLinkMode,
  ServiceType,
  VisaCaseStatus,
  VisaDataScope,
  VisaReminderType,
} from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义客户列表查询条件，统一承载客户类型、服务线、状态、联系方式、负责人与签证案件类目等筛选参数。
 */
export class QueryCustomerDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CustomerType })
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsOptional()
  @IsEnum(ServiceType)
  serviceType?: ServiceType;

  @ApiPropertyOptional({
    maxLength: 100,
    description:
      '签证案件类目 `visa_cases.case_type` 部分一致（ILIKE）；仅匹配客户名下未软删案件',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  visaCaseTypeKeyword?: string;

  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: '担当者IDの形式が無効です' })
  ownerUserId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      '随附家属列表：仅返回 `person_info.primary_customer_id` 等于该 UUID 且 `person_info.is_family_member = true` 的客户（编辑主档时拉取家属行）',
  })
  @IsOptional()
  @IsUUID('4', { message: '主客户IDの形式が無効です' })
  primaryCustomerId?: string;

  @ApiPropertyOptional({
    maxLength: 50,
    description: '微信 ID 部分一致（ILIKE）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  wechatId?: string;

  @ApiPropertyOptional({
    maxLength: 50,
    description: 'LINE ID 部分一致（ILIKE）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineId?: string;

  @ApiPropertyOptional({
    enum: VisaCaseStatus,
    description:
      '主展示案件状态筛选：按 docs/17 §1.11 在「当前 dataScope 可见案件集」内 DISTINCT ON 选取的主行 `case_status` 等于该值（与列表摘要列同源）',
  })
  @IsOptional()
  @IsEnum(VisaCaseStatus)
  listPrimaryVisaCaseStatus?: VisaCaseStatus;

  @ApiPropertyOptional({
    description:
      '主展示案件是否家族签：true=摘要行 is_family_case；false=摘要行非家族签；与 DISTINCT ON 选取规则及 dataScope 一致',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (value === true || value === 'true' || value === '1' || value === 1) {
      return true;
    }
    if (value === false || value === 'false' || value === '0' || value === 0) {
      return false;
    }
    return undefined;
  })
  @IsBoolean()
  listPrimaryIsFamilyCase?: boolean;

  @ApiPropertyOptional({
    enum: FamilyLinkMode,
    description:
      '主展示案件家族签主申模式：INTERNAL / EXTERNAL；与摘要 family_link_mode 及 dataScope 一致',
  })
  @IsOptional()
  @IsEnum(FamilyLinkMode)
  listPrimaryFamilyLinkMode?: FamilyLinkMode;

  @ApiPropertyOptional({
    enum: VisaReminderType,
    description:
      '签证派生风险桶筛选（与 docs/25 §4.4、全局案件 reminderBucket 语义一致；EXISTS 子查询，不落库）',
  })
  @IsOptional()
  @IsEnum(VisaReminderType)
  visaReminderBucket?: VisaReminderType;

  @ApiPropertyOptional({
    enum: VisaDataScope,
    description:
      '签证派生风险 EXISTS 与 `visaDerivedRisk` 聚合与 `GET /visa-cases` 一致的数据范围；缺省 all',
  })
  @IsOptional()
  @IsEnum(VisaDataScope)
  dataScope?: VisaDataScope;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 3660,
    description:
      '主档在留期限 person_info.residence_expire_date が「一覧クエリ基準日」から N 自然日以内（含む）の顧客のみ。未指定時は条件なし。案件 visa_cases 到期提醒とは独立（docs/21 §6.4）。',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3660)
  residenceExpireWithinDays?: number;
}
