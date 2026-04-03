import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, Matches } from 'class-validator';

import { MaterialStatus, MonthlyStatus } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义税务月度期间列表查询条件，统一承载年月范围、截止日区间与状态筛选参数。
 */
export class QueryTaxPeriodDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MonthlyStatus })
  @IsOptional()
  @IsEnum(MonthlyStatus)
  monthlyStatus?: MonthlyStatus;

  @ApiPropertyOptional({ enum: MaterialStatus })
  @IsOptional()
  @IsEnum(MaterialStatus)
  materialStatus?: MaterialStatus;

  @ApiPropertyOptional({ example: '2026-01', description: '期間の範囲開始' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: '期間開始はYYYY-MM形式で入力してください',
  })
  periodYmFrom?: string;

  @ApiPropertyOptional({ example: '2026-12', description: '期間の範囲終了' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: '期間終了はYYYY-MM形式で入力してください',
  })
  periodYmTo?: string;

  @ApiPropertyOptional({ description: '申告期限の範囲開始' })
  @IsOptional()
  @IsDateString()
  deadlineFrom?: string;

  @ApiPropertyOptional({ description: '申告期限の範囲終了' })
  @IsOptional()
  @IsDateString()
  deadlineTo?: string;
}
