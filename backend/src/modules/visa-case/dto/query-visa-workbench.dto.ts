import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { VisaDataScope } from '../../../common/constants/enums';

/**
 * 签证工作台只读聚合查询参数：`stats` 与 `/visa-cases/stats` 一致支持负责人收窄；
 * `reminderPreviews` 每桶 Top N 与 `/visa-reminders` 分类与排序语义一致。
 */
export class QueryVisaWorkbenchDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: '按负责人筛选统计与预览范围',
  })
  @IsOptional()
  @IsUUID('4', { message: '担当者IDの形式が無効です' })
  assignedTo?: string;

  @ApiPropertyOptional({
    enum: VisaDataScope,
    description: '与 `/visa-cases/stats` 及提醒预览一致的数据范围；缺省 all',
  })
  @IsOptional()
  @IsEnum(VisaDataScope)
  dataScope?: VisaDataScope;

  @ApiPropertyOptional({
    description:
      '每桶返回的提醒预览条数上限，0 表示不加载预览（仅返回 stats）；默认 5，最大 20',
    minimum: 0,
    maximum: 20,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'previewLimit は整数である必要があります' })
  @Min(0, { message: 'previewLimit は 0 以上である必要があります' })
  @Max(20, { message: 'previewLimit は 20 以下である必要があります' })
  previewLimit?: number = 5;
}
