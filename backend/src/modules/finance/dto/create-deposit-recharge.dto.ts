import { IsUUID, IsNumber, IsOptional, IsString, IsEnum, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentMethod } from '../../../common/constants/enums'

export class CreateDepositRechargeDto {
  @ApiProperty({ description: '顧客ID', format: 'uuid' })
  @IsUUID()
  customerId: string

  @ApiProperty({ description: 'チャージ金額', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number

  @ApiPropertyOptional({ description: '入金方法', enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod

  @ApiPropertyOptional({ description: '備考', maxLength: 500 })
  @IsOptional()
  @IsString()
  remark?: string
}
