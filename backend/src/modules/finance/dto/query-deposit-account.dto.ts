import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义查询客户预り金账户列表时可用的筛选入参契约。
 *
 * 该 DTO 继承分页参数，并支持按客户和是否存在余额过滤账户结果集。
 */
export class QueryDepositAccountDto extends PaginationDto {
  @ApiPropertyOptional({ description: '顧客ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: '残高ありのみ', type: Boolean })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }): boolean =>
      value === 'true' || value === true,
  )
  @IsBoolean()
  hasBalance?: boolean;
}
