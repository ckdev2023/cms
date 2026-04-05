import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { MaterialItemStatus } from '../../../common/constants/enums';

/**
 * 案件材料实例更新请求，支持勾选状态变更、备注修改与排序调整。
 */
export class UpdateVisaCaseMaterialItemDto {
  @ApiPropertyOptional({
    enum: MaterialItemStatus,
    description: '材料收集状态',
  })
  @IsOptional()
  @IsEnum(MaterialItemStatus, { message: 'ステータスが無効です' })
  itemStatus?: MaterialItemStatus;

  @ApiPropertyOptional({ maxLength: 2000, description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remark?: string;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
