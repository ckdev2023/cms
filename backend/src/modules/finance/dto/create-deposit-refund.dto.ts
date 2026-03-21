import { IsUUID, IsNumber, IsString, IsOptional, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateDepositRefundDto {
  @ApiProperty({ description: '顧客ID', format: 'uuid' })
  @IsUUID()
  customerId: string

  @ApiProperty({ description: '返金金額', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number

  @ApiProperty({ description: '返金理由' })
  @IsString()
  reason: string

  @ApiPropertyOptional({ description: '備考', maxLength: 500 })
  @IsOptional()
  @IsString()
  remark?: string
}
