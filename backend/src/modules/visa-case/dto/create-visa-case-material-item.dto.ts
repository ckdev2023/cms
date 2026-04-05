import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { MaterialItemScope } from '../../../common/constants/enums';

/**
 * 案件材料实例手动新增请求，用于操作员在模板项之外自由添加材料条目。
 *
 * 手动新增的项不关联 `template_item_id`，可指定案件级或成员级归属。
 */
export class CreateVisaCaseMaterialItemDto {
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

  @ApiPropertyOptional({
    description: '成员级材料归属的家属成员 ID，案件级留空',
  })
  @IsOptional()
  @IsUUID('4', { message: '家族メンバーIDの形式が無効です' })
  visaCaseFamilyMemberId?: string;

  @ApiPropertyOptional({ default: 0, description: '排序' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ maxLength: 2000, description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remark?: string;
}
