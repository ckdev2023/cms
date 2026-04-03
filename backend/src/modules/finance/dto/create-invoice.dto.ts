import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { BusinessType, InvoiceType } from '../../../common/constants/enums';
import { CreateInvoiceItemDto } from './create-invoice-item.dto';

/**
 * 定义创建请求书时提交的主表入参契约。
 *
 * 该 DTO 约束客户、请求类型、关联业务对象、备注与至少一条开票明细。
 */
export class CreateInvoiceDto {
  @ApiProperty({ format: 'uuid', description: '顧客ID' })
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId: string;

  @ApiProperty({ enum: InvoiceType, description: '請求タイプ' })
  @IsEnum(InvoiceType, { message: '請求タイプが無効です' })
  invoiceType: InvoiceType;

  @ApiPropertyOptional({ example: '2026-04-30', description: '支払期日' })
  @IsOptional()
  @IsDateString({}, { message: '支払期日の形式が無効です' })
  dueDate?: string;

  @ApiPropertyOptional({ format: 'uuid', description: '関連案件/契約ID' })
  @IsOptional()
  @IsUUID('4', { message: '関連IDの形式が無効です' })
  relatedId?: string;

  @ApiPropertyOptional({ enum: BusinessType, description: '関連業務種別' })
  @IsOptional()
  @IsEnum(BusinessType, { message: '関連タイプが無効です' })
  relatedType?: BusinessType;

  @ApiPropertyOptional({ maxLength: 500, description: '備考' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiProperty({ type: [CreateInvoiceItemDto], description: '請求明細一覧' })
  @IsArray()
  @ArrayMinSize(1, { message: '明細は1件以上必要です' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}
