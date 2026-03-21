import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  IsEmail,
  MaxLength,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  CustomerType,
  ServiceType,
} from '../../../common/constants/enums'

export class CompanyInfoDto {
  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  corporationNumber?: string

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalMonth?: number

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  representativeName?: string
}

export class PersonInfoDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  residenceStatus?: string

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  residenceExpireDate?: string
}

export class CreateCustomerDto {
  @ApiProperty({ enum: CustomerType })
  @IsEnum(CustomerType, { message: '顧客タイプが無効です' })
  customerType: CustomerType

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: '顧客名は必須です' })
  @MaxLength(200)
  customerName: string

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsEmail({}, { message: 'メールアドレスの形式が正しくありません' })
  @MaxLength(120)
  email?: string

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string

  @ApiProperty({ enum: ServiceType })
  @IsEnum(ServiceType, { message: 'サービスタイプが無効です' })
  serviceType: ServiceType

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: '担当者IDの形式が無効です' })
  ownerUserId?: string

  @ApiPropertyOptional({ type: CompanyInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompanyInfoDto)
  companyInfo?: CompanyInfoDto

  @ApiPropertyOptional({ type: PersonInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonInfoDto)
  personInfo?: PersonInfoDto
}
