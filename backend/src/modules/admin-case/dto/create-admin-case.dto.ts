import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  MaxLength,
  IsDateString,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { AdminCaseStatus } from '../../../common/constants/enums'

export class CreateAdminCaseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId: string

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: '案件名は必須です' })
  @MaxLength(200)
  caseName: string

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  applicantName?: string

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  residenceStatus?: string

  @ApiPropertyOptional({ enum: AdminCaseStatus, default: AdminCaseStatus.DRAFT })
  @IsOptional()
  @IsEnum(AdminCaseStatus, { message: 'ステータスが無効です' })
  status?: AdminCaseStatus

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: '日付の形式が無効です' })
  expireDate?: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: '担当者IDの形式が無効です' })
  ownerUserId?: string
}
