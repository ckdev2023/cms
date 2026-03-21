import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'
import { InvoiceStatus, InvoiceType } from '../../../common/constants/enums'

export class QueryInvoiceDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus

  @ApiPropertyOptional({ enum: InvoiceType })
  @IsOptional()
  @IsEnum(InvoiceType)
  invoiceType?: InvoiceType

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  customerId?: string

  @ApiPropertyOptional({ example: '2026-01-01', description: '支払期日の範囲開始' })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string

  @ApiPropertyOptional({ example: '2026-12-31', description: '支払期日の範囲終了' })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string

  @ApiPropertyOptional({ example: '2026-01-01', description: '作成日の範囲開始' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string

  @ApiPropertyOptional({ example: '2026-12-31', description: '作成日の範囲終了' })
  @IsOptional()
  @IsDateString()
  createdTo?: string
}
