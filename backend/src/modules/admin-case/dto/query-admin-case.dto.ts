import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { AdminCaseStatus } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义行政案件列表查询条件，统一承载状态、归属人与期限区间等筛选参数。
 */
export class QueryAdminCaseDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AdminCaseStatus })
  @IsOptional()
  @IsEnum(AdminCaseStatus, { message: 'ステータスが無効です' })
  status?: AdminCaseStatus;

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
    description: '期限日の範囲開始',
  })
  @IsOptional()
  @IsDateString({}, { message: '日付の形式が無効です' })
  expireDateFrom?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: '期限日の範囲終了',
  })
  @IsOptional()
  @IsDateString({}, { message: '日付の形式が無効です' })
  expireDateTo?: string;
}
