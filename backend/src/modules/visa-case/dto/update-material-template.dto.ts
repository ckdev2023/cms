import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { MaterialItemScope } from '../../../common/constants/enums';

/**
 * 模板材料项的更新参数，支持新增（无 id）与修改（有 id）两种模式。
 *
 * 不在 `items` 数组中出现的已有项会被物理删除（全量替换语义）。
 */
export class UpdateMaterialTemplateItemDto {
  @ApiPropertyOptional({ description: '已有项的 ID，新增项不传' })
  @IsOptional()
  @IsUUID('4', { message: '材料項目IDの形式が無効です' })
  id?: string;

  @ApiProperty({ maxLength: 100, description: '分组名' })
  @IsString()
  @IsNotEmpty({ message: 'グループ名を入力してください' })
  @MaxLength(100)
  groupName: string;

  @ApiProperty({ maxLength: 200, description: '材料名' })
  @IsString()
  @IsNotEmpty({ message: '材料名を入力してください' })
  @MaxLength(200)
  itemName: string;

  @ApiPropertyOptional({
    enum: MaterialItemScope,
    default: MaterialItemScope.CASE,
    description: '归属维度',
  })
  @IsOptional()
  @IsEnum(MaterialItemScope, { message: 'スコープが無効です' })
  scope?: MaterialItemScope;

  @ApiPropertyOptional({ default: 0, description: '组内排序' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ default: true, description: '是否必需项' })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

/**
 * 材料模板更新请求，支持修改模板名称与全量替换模板项。
 */
export class UpdateMaterialTemplateDto {
  @ApiPropertyOptional({ maxLength: 200, description: '模板显示名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @ApiPropertyOptional({
    type: [UpdateMaterialTemplateItemDto],
    description: '全量替换的模板材料项列表',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateMaterialTemplateItemDto)
  items?: UpdateMaterialTemplateItemDto[];
}
