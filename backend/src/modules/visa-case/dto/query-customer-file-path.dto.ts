import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { FilePathType } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义资料路径列表查询条件，统一承载路径类型筛选与分页参数。
 */
export class QueryCustomerFilePathDto extends PaginationDto {
  @ApiPropertyOptional({ enum: FilePathType })
  @IsOptional()
  @IsEnum(FilePathType)
  pathType?: FilePathType;
}
