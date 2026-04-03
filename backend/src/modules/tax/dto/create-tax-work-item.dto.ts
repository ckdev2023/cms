import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * 定义新增税务作业项时允许提交的字段，统一校验作业名称、完成状态与显示顺序。
 */
export class CreateTaxWorkItemDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: '作業項目名は必須です' })
  @MaxLength(200)
  itemName: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
