import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { MaterialItemScope } from '../../../common/constants/enums';

/**
 * 模板材料项的创建参数，嵌入模板创建请求中批量提交。
 */
export class CreateMaterialTemplateItemDto {
  @ApiProperty({ maxLength: 100, description: '分组名（如"基本書類"）' })
  @IsString()
  @IsNotEmpty({ message: 'グループ名を入力してください' })
  @MaxLength(100)
  groupName: string;

  @ApiProperty({
    maxLength: 200,
    description: '材料名（如"パスポートコピー"）',
  })
  @IsString()
  @IsNotEmpty({ message: '材料名を入力してください' })
  @MaxLength(200)
  itemName: string;

  @ApiPropertyOptional({
    enum: MaterialItemScope,
    default: MaterialItemScope.CASE,
    description: '归属维度：CASE=案件级 MEMBER=成员级',
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
 * 材料模板创建请求，包含案件类型、模板名称及批量材料项定义。
 *
 * 同一 `caseType` 下只允许存在一个活跃模板（由数据库部分唯一索引保证）。
 */
export class CreateMaterialTemplateDto {
  @ApiProperty({
    maxLength: 100,
    description: '签证案件类型（如 WORK / FAMILY）',
  })
  @IsString()
  @IsNotEmpty({ message: '案件タイプを入力してください' })
  @MaxLength(100)
  caseType: string;

  @ApiProperty({ maxLength: 200, description: '模板显示名称' })
  @IsString()
  @IsNotEmpty({ message: '表示名を入力してください' })
  @MaxLength(200)
  displayName: string;

  @ApiProperty({
    type: [CreateMaterialTemplateItemDto],
    description: '模板材料项列表',
  })
  @IsArray()
  @ArrayMinSize(1, { message: '材料項目は最低1つ必要です' })
  @ValidateNested({ each: true })
  @Type(() => CreateMaterialTemplateItemDto)
  items: CreateMaterialTemplateItemDto[];
}
