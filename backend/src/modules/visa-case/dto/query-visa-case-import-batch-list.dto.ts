import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsPositive, Max } from 'class-validator';

/**
 * 历史签证导入成功批次只读列表的分页参数，与全局 `GET /visa-cases` 筛选 DTO 分离实现。
 */
export class QueryVisaCaseImportBatchListDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Max(100)
  pageSize?: number = 20;
}
