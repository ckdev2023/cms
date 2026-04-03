import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { BusinessType } from '../../../common/constants/enums';

/**
 * 定义文件元数据更新接口允许提交的可编辑字段。
 */
export class UpdateFileDto {
  @ApiPropertyOptional({ description: '更新后的文件名。' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @ApiPropertyOptional({ description: '更新后的文件说明。' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: '更新后的关联业务类型。',
    enum: BusinessType,
  })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;
}
