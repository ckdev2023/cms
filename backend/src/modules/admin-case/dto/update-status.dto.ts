import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { AdminCaseStatus } from '../../../common/constants/enums';

/**
 * 定义行政案件状态流转时允许提交的目标状态，统一约束状态码来源于案件状态枚举。
 */
export class UpdateAdminCaseStatusDto {
  @ApiProperty({ enum: AdminCaseStatus })
  @IsEnum(AdminCaseStatus, { message: 'ステータスが無効です' })
  status: AdminCaseStatus;
}
