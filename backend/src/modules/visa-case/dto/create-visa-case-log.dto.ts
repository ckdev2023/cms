import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { VisaCaseLogType } from '../../../common/constants/enums';

/**
 * 定义签证案件日志新增请求，约束日志类型、内容与结构化跟进字段。
 *
 * 案件日志必须挂载到具体签证案件（visa_case_id 由路由参数提供），
 * `logType` 为必填字段以区别于客户备注。
 */
export class CreateVisaCaseLogDto {
  @ApiProperty({ enum: VisaCaseLogType, description: '案件日志类型' })
  @IsEnum(VisaCaseLogType, { message: 'ログタイプが無効です' })
  logType: VisaCaseLogType;

  @ApiProperty({ maxLength: 5000, description: '日志内容' })
  @IsString()
  @IsNotEmpty({ message: '内容を入力してください' })
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ maxLength: 2000, description: '已提交材料清单' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  submittedItems?: string;

  @ApiPropertyOptional({ maxLength: 2000, description: '缺失材料清单' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  missingItems?: string;

  @ApiPropertyOptional({ maxLength: 1000, description: '下一步动作' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nextAction?: string;

  @ApiPropertyOptional({
    example: '2026-04-10T09:00:00.000Z',
    description: '下次跟进时间',
  })
  @IsOptional()
  @IsDateString({}, { message: '日付の形式が無効です' })
  nextFollowUpAt?: string;
}
