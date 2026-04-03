import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义分页查询系统角色列表时可用的筛选条件，统一约束角色编码过滤参数。
 */
export class QueryRoleDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleCode?: string;
}
