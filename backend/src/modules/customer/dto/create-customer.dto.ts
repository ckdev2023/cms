import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import {
  CustomerType,
  FamilyRelation,
  ServiceType,
} from '../../../common/constants/enums';

/**
 * 定义客户新增请求中的公司补充信息，统一约束法人编号、决算月与代表者姓名等字段。
 */
export class CompanyInfoDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  corporationNumber?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalMonth?: number;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  representativeName?: string;
}

/**
 * 定义个人客户的补充身份信息，统一约束国籍、在留资格、在留期限与家族成员字段。
 */
export class PersonInfoDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  residenceStatus?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: '在留期限日' })
  @IsOptional()
  @IsDateString({}, { message: '在留期限日の形式が無効です' })
  residenceExpireDate?: string;

  @ApiPropertyOptional({ description: '家族成員フラグ' })
  @IsOptional()
  @IsBoolean()
  isFamilyMember?: boolean;

  @ApiPropertyOptional({
    enum: FamilyRelation,
    description: '家族関係（isFamilyMember=true 時必須）',
  })
  @ValidateIf((o: { isFamilyMember?: boolean }) => o.isFamilyMember === true)
  @IsNotEmpty({ message: '家族関係は家族成員の場合に必須です' })
  @IsEnum(FamilyRelation, { message: '家族関係の値が無効です' })
  @IsOptional()
  familyRelation?: FamilyRelation;

  @ApiPropertyOptional({
    format: 'uuid',
    description: '主顧客ID（家族成員の場合に参照先）',
  })
  @IsOptional()
  @IsUUID('4', { message: '主顧客IDの形式が無効です' })
  primaryCustomerId?: string;

  @ApiPropertyOptional({ description: '事前通知日数（本期統一90日）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  remindDaysBefore?: number;
}

/**
 * 定义新增客户时允许提交的基础资料，统一承载客户类型、服务归属与补充档案信息。
 */
export class CreateCustomerDto {
  @ApiProperty({ enum: CustomerType })
  @IsEnum(CustomerType, { message: '顧客タイプが無効です' })
  customerType: CustomerType;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: '顧客名は必須です' })
  @MaxLength(200)
  customerName: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsEmail({}, { message: 'メールアドレスの形式が正しくありません' })
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType, { message: 'サービスタイプが無効です' })
  serviceType: ServiceType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: '担当者IDの形式が無効です' })
  ownerUserId?: string;

  @ApiPropertyOptional({ type: CompanyInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompanyInfoDto)
  companyInfo?: CompanyInfoDto;

  @ApiPropertyOptional({ type: PersonInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonInfoDto)
  personInfo?: PersonInfoDto;
}
