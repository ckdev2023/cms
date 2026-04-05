import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

import {
  VisaDataScope,
  VisaReminderType,
} from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义签证提醒列表查询条件，支持按提醒桶类型与负责人筛选。
 *
 * 提醒桶优先级：补件提醒 > 今日待跟进 > 7天内到期 > 2个月内到期。
 * 同一案件命中多个桶时按此优先级去重，已过期案件归入"7天内到期"桶并标记最高紧急度。
 */
export class QueryVisaReminderDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: VisaReminderType,
    description: '按提醒桶类型筛选',
  })
  @IsOptional()
  @IsEnum(VisaReminderType)
  reminderType?: VisaReminderType;

  @ApiPropertyOptional({ format: 'uuid', description: '按负责人筛选' })
  @IsOptional()
  @IsUUID('4', { message: '担当者IDの形式が無効です' })
  assignedTo?: string;

  @ApiPropertyOptional({
    enum: VisaDataScope,
    description: '签证域数据范围（docs/21 §18）；缺省 all',
  })
  @IsOptional()
  @IsEnum(VisaDataScope)
  dataScope?: VisaDataScope;
}
