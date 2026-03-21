import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  MaxLength,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  TaxContractStatus,
  BillingCycle,
} from '../../../common/constants/enums'

export class CreateTaxContractDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId: string

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: '契約名は必須です' })
  @MaxLength(200)
  contractName: string

  @ApiPropertyOptional({
    enum: TaxContractStatus,
    default: TaxContractStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(TaxContractStatus, { message: '契約ステータスが無効です' })
  contractStatus?: TaxContractStatus

  @ApiPropertyOptional({ enum: BillingCycle, default: BillingCycle.MONTHLY })
  @IsOptional()
  @IsEnum(BillingCycle, { message: '請求サイクルが無効です' })
  billingCycle?: BillingCycle

  @ApiProperty({ example: '2026-04-01' })
  @IsDateString({}, { message: '開始日の形式が無効です' })
  startDate: string

  @ApiPropertyOptional({ example: '2027-03-31' })
  @IsOptional()
  @IsDateString({}, { message: '終了日の形式が無効です' })
  endDate?: string

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '月額報酬は数値で入力してください' })
  @Min(0, { message: '月額報酬は0以上で入力してください' })
  monthlyFee?: number

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: '担当者IDの形式が無効です' })
  ownerUserId?: string
}
