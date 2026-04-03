import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { InvoiceStatus, InvoiceType } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义查询请求书列表时可用的筛选入参契约。
 *
 * 该 DTO 支持按状态、请求类型、客户与日期区间组合过滤分页结果。
 */
export class QueryInvoiceDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InvoiceStatus, description: '請求状態' })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ enum: InvoiceType, description: '請求タイプ' })
  @IsOptional()
  @IsEnum(InvoiceType)
  invoiceType?: InvoiceType;

  @ApiPropertyOptional({ format: 'uuid', description: '顧客ID' })
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: '支払期日の範囲開始',
  })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: '支払期日の範囲終了',
  })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: '作成日の範囲開始',
  })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: '作成日の範囲終了',
  })
  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
