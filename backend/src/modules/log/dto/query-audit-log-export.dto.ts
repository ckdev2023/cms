import {
  ApiPropertyOptional,
  IntersectionType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { QueryAuditLogDto } from './query-audit-log.dto';

/**
 * 定义操作审计日志 CSV 导出查询参数：与列表页相同的筛选维度，另附单次导出行数上限。
 */
export class QueryAuditLogExportDto extends IntersectionType(
  PickType(QueryAuditLogDto, [
    'userId',
    'actionType',
    'targetType',
    'targetId',
    'startDate',
    'endDate',
    'result',
  ] as const),
  PickType(PaginationDto, ['keyword', 'sortBy', 'sortOrder'] as const),
) {
  @ApiPropertyOptional({
    default: 2000,
    maximum: 5000,
    description: '単次エクスポート最大行数（1〜5000）',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  limit?: number = 2000;
}
