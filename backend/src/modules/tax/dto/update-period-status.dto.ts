import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { MonthlyStatus } from '../../../common/constants/enums';

/**
 * 定义税务月度期间状态更新请求体，确保月次进度只能使用系统约定的状态枚举。
 */
export class UpdatePeriodStatusDto {
  @ApiProperty({ enum: MonthlyStatus })
  @IsEnum(MonthlyStatus, { message: '月次ステータスが無効です' })
  monthlyStatus: MonthlyStatus;
}
