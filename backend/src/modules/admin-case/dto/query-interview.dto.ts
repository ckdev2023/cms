import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义案件面谈记录列表的查询条件，统一约束面谈日期区间与分页参数。
 */
export class QueryInterviewDto extends PaginationDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: '日付の形式が無効です' })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: '日付の形式が無効です' })
  dateTo?: string;
}
