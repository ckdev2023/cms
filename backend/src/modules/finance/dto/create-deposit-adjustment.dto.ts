import { IsUUID, IsNumber, IsString, IsOptional } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateDepositAdjustmentDto {
  @ApiProperty({ description: '顧客ID', format: 'uuid' })
  @IsUUID()
  customerId: string

  @ApiProperty({ description: '調整金額（正: 加算、負: 減算）' })
  @IsNumber()
  amount: number

  @ApiProperty({ description: '調整理由' })
  @IsString()
  reason: string

  @ApiPropertyOptional({ description: '備考', maxLength: 500 })
  @IsOptional()
  @IsString()
  remark?: string
}
