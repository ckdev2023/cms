import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import { ExportType, OperationResult } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义导出日志列表查询支持的筛选入参，约束操作者、导出类型、结果与时间范围。
 */
export class QueryExportLogDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid', description: '操作ユーザーID' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({
    enum: ExportType,
    description: 'エクスポート種別',
  })
  @IsOptional()
  @IsEnum(ExportType)
  exportType?: ExportType;

  @ApiPropertyOptional({
    enum: OperationResult,
    description: '記録ステータス',
  })
  @IsOptional()
  @IsEnum(OperationResult)
  status?: OperationResult;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: '開始日時 (ISO8601)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.999Z',
    description: '終了日時 (ISO8601)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
