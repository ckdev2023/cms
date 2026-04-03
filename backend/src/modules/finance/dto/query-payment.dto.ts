import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { PaymentMethod, PaymentStatus } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义查询入金记录列表时可用的筛选入参契约。
 *
 * 该 DTO 支持按入金状态、入金方式、客户、关联请求书与日期区间过滤结果。
 */
export class QueryPaymentDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PaymentStatus, description: '入金状態' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ enum: PaymentMethod, description: '入金方法' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ format: 'uuid', description: '顧客ID' })
  @IsOptional()
  @IsUUID('4')
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: '関連請求書ID' })
  @IsOptional()
  @IsUUID('4')
  invoiceId?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: '入金日の範囲開始',
  })
  @IsOptional()
  @IsDateString()
  paymentDateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: '入金日の範囲終了',
  })
  @IsOptional()
  @IsDateString()
  paymentDateTo?: string;

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
