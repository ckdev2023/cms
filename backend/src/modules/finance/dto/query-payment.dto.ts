import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'
import { PaymentStatus, PaymentMethod } from '../../../common/constants/enums'

export class QueryPaymentDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PaymentStatus })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  customerId?: string

  @ApiPropertyOptional({ format: 'uuid', description: '関連請求書ID' })
  @IsOptional()
  @IsString()
  invoiceId?: string

  @ApiPropertyOptional({ example: '2026-01-01', description: '入金日の範囲開始' })
  @IsOptional()
  @IsDateString()
  paymentDateFrom?: string

  @ApiPropertyOptional({ example: '2026-12-31', description: '入金日の範囲終了' })
  @IsOptional()
  @IsDateString()
  paymentDateTo?: string

  @ApiPropertyOptional({ example: '2026-01-01', description: '作成日の範囲開始' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string

  @ApiPropertyOptional({ example: '2026-12-31', description: '作成日の範囲終了' })
  @IsOptional()
  @IsDateString()
  createdTo?: string
}
