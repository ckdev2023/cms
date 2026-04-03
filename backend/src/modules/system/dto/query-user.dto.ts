import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { UserStatus } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义分页查询系统用户列表时可用的筛选条件，统一约束状态与角色编码过滤参数。
 */
export class QueryUserDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleCode?: string;
}
