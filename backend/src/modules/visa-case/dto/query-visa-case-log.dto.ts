import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { VisaCaseLogType } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义签证案件日志列表查询条件，统一承载日志类型筛选与分页参数。
 */
export class QueryVisaCaseLogDto extends PaginationDto {
  @ApiPropertyOptional({ enum: VisaCaseLogType })
  @IsOptional()
  @IsEnum(VisaCaseLogType)
  logType?: VisaCaseLogType;
}
