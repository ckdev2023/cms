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
} from 'class-validator'
import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { InvoiceType, BusinessType } from '../../../common/constants/enums'
import { CreateInvoiceItemDto } from './create-invoice-item.dto'

export class CreateInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId: string

  @ApiProperty({ enum: InvoiceType })
  @IsEnum(InvoiceType, { message: '請求タイプが無効です' })
  invoiceType: InvoiceType

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  @IsDateString({}, { message: '支払期日の形式が無効です' })
  dueDate?: string

  @ApiPropertyOptional({ format: 'uuid', description: '関連案件/契約ID' })
  @IsOptional()
  @IsUUID('4', { message: '関連IDの形式が無効です' })
  relatedId?: string

  @ApiPropertyOptional({ enum: BusinessType })
  @IsOptional()
  @IsEnum(BusinessType, { message: '関連タイプが無効です' })
  relatedType?: BusinessType

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string

  @ApiProperty({ type: [CreateInvoiceItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: '明細は1件以上必要です' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[]
}
