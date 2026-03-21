import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  MaxLength,
  IsNumber,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentMethod } from '../../../common/constants/enums'

export class CreatePaymentAllocationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: '請求書IDの形式が無効です' })
  invoiceId: string

  @ApiProperty({ description: '充当金額', example: 5000 })
  @IsNumber({}, { message: '充当金額は数値で入力してください' })
  @Min(0.01, { message: '充当金額は0より大きい値にしてください' })
  allocatedAmount: number
}

export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId: string

  @ApiProperty({ example: '2026-03-20' })
  @IsDateString({}, { message: '入金日の形式が無効です' })
  paymentDate: string

  @ApiProperty({ description: '入金金額', example: 10000 })
  @IsNumber({}, { message: '入金金額は数値で入力してください' })
  @Min(0.01, { message: '入金金額は0より大きい値にしてください' })
  paymentAmount: number

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod, { message: '入金方法が無効です' })
  paymentMethod: PaymentMethod

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string

  @ApiProperty({ type: [CreatePaymentAllocationDto] })
  @IsArray()
  @ArrayMinSize(1, { message: '充当先は1件以上必要です' })
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentAllocationDto)
  allocations: CreatePaymentAllocationDto[]
}
