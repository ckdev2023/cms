import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import {
  FamilyLinkMode,
  FamilyRelation,
  MaterialStatus,
  VisaCaseFeeStatus,
  VisaCaseStatus,
} from '../../../common/constants/enums';

/**
 * 定义新增签证案件时允许提交的全量字段，包含案件归属、类型、状态、家族签建模、
 * 负责人、到期/跟进时间与 P0 摘要字段。
 *
 * - 家族签 (`isFamilyCase = true`) 时 `familyLinkMode` 必填。
 * - `INTERNAL` 模式下 `internalPrimaryCustomerId` 必填。
 * - `EXTERNAL` 模式下 `externalPrimaryName` 必填。
 * - `externalPrimaryRelationToApplicant` 仅在 EXTERNAL 家族签语义下使用，与 `person_info.family_relation` 枚举口径一致。
 *   **若产品坚持改为自由文本 string**：需新迁移将 `visa_cases.external_primary_relation_to_applicant`
 *   从枚举列改为 `varchar`（或并行新列 + 回填）、同步调整 `CreateVisaCaseDto`/`UpdateVisaCaseDto` 校验、
 *   `visa-case-import-preview` CSV 解析、前端向导与 `CustomerVisaCaseDialog`、以及 docs/23 导入口径与现有 spec；
 *   在明确产品决策前保持 `FamilyRelation` 枚举，UI 以说明文案对齐设计稿表述。
 * - `importReference` 仅用于历史 CSV 导入幂等，与 `legacy_case_ref` 对应。
 */
export class CreateVisaCaseDto {
  @ApiProperty({ format: 'uuid', description: '案件归属客户ID' })
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId: string;

  @ApiPropertyOptional({ maxLength: 100, description: '案件类型（签证种类）' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  caseType?: string;

  @ApiPropertyOptional({
    enum: VisaCaseStatus,
    default: VisaCaseStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(VisaCaseStatus, { message: '案件ステータスが無効です' })
  caseStatus?: VisaCaseStatus;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: '家族案件フラグはブール値が必要です' })
  isFamilyCase?: boolean;

  @ApiPropertyOptional({ enum: FamilyLinkMode })
  @ValidateIf((o: CreateVisaCaseDto) => o.isFamilyCase === true)
  @IsEnum(FamilyLinkMode, { message: '家族紐付けモードが無効です' })
  familyLinkMode?: FamilyLinkMode;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'INTERNAL模式下的系统内主申请人ID',
  })
  @ValidateIf(
    (o: CreateVisaCaseDto) => o.familyLinkMode === FamilyLinkMode.INTERNAL,
  )
  @IsUUID('4', { message: '主申請者IDの形式が無効です' })
  internalPrimaryCustomerId?: string;

  @ApiPropertyOptional({
    maxLength: 200,
    description: 'EXTERNAL模式下的外部主申请人姓名',
  })
  @ValidateIf(
    (o: CreateVisaCaseDto) => o.familyLinkMode === FamilyLinkMode.EXTERNAL,
  )
  @IsString()
  @MaxLength(200)
  externalPrimaryName?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'EXTERNAL模式下的外部主申请人案件类型',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  externalPrimaryCaseType?: string;

  @ApiPropertyOptional({
    example: '2027-06-30',
    description: 'EXTERNAL模式下的外部主申请人到期日',
  })
  @IsOptional()
  @IsDateString({}, { message: '日付の形式が無効です' })
  externalPrimaryExpireDate?: string;

  @ApiPropertyOptional({
    enum: FamilyRelation,
    description: 'EXTERNAL 模式下外部主申请人相对本案申请人的家属关系',
  })
  @IsOptional()
  @IsEnum(FamilyRelation, { message: '家族関係が無効です' })
  externalPrimaryRelationToApplicant?: FamilyRelation;

  @ApiPropertyOptional({ format: 'uuid', description: '案件负责人用户ID' })
  @IsOptional()
  @IsUUID('4', { message: '担当者IDの形式が無効です' })
  assignedTo?: string;

  @ApiPropertyOptional({
    example: '2027-06-30',
    description: '签证到期日（提醒计算基准）',
  })
  @IsOptional()
  @IsDateString({}, { message: '日付の形式が無効です' })
  expireDate?: string;

  @ApiPropertyOptional({
    example: '2026-04-10T09:00:00.000Z',
    description: '下次跟进时间',
  })
  @IsOptional()
  @IsDateString({}, { message: '日付の形式が無効です' })
  nextFollowUpAt?: string;

  @ApiPropertyOptional({
    enum: MaterialStatus,
    description: 'P0 材料状態摘要（手工维护）',
  })
  @IsOptional()
  @IsEnum(MaterialStatus, { message: '資料ステータスが無効です' })
  materialStatus?: MaterialStatus;

  @ApiPropertyOptional({
    enum: VisaCaseFeeStatus,
    description: '费用状態',
  })
  @IsOptional()
  @IsEnum(VisaCaseFeeStatus, { message: '費用ステータスが無効です' })
  feeStatus?: VisaCaseFeeStatus;

  @ApiPropertyOptional({ maxLength: 5000, description: '案件备注' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  memo?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: '历史导入幂等键（对应 CSV legacy_case_ref）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  importReference?: string;
}
