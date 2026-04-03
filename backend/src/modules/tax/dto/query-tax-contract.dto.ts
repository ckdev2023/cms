import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import {
  BillingCycle,
  TaxContractStatus,
} from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义税务顾问契约列表查询条件，统一承载状态、负责人和开始日区间等筛选参数。
 */
export class QueryTaxContractDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TaxContractStatus })
  @IsOptional()
  @IsEnum(TaxContractStatus)
  contractStatus?: TaxContractStatus;

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: '担当者IDの形式が無効です' })
  ownerUserId?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: '開始日の範囲開始',
  })
  @IsOptional()
  @IsDateString()
  startDateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: '開始日の範囲終了',
  })
  @IsOptional()
  @IsDateString()
  startDateTo?: string;
}
