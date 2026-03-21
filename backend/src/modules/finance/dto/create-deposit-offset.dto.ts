import { IsUUID, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateDepositOffsetDto {
  @ApiProperty({ description: '顧客ID', format: 'uuid' })
  @IsUUID()
  customerId: string

  @ApiProperty({ description: '充当先請求書ID', format: 'uuid' })
  @IsUUID()
  invoiceId: string

  @ApiProperty({ description: '充当金額', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number

  @ApiPropertyOptional({ description: '備考', maxLength: 500 })
  @IsOptional()
  @IsString()
  remark?: string
}
