import { IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { AdminCaseStatus } from '../../../common/constants/enums'

export class UpdateAdminCaseStatusDto {
  @ApiProperty({ enum: AdminCaseStatus })
  @IsEnum(AdminCaseStatus, { message: 'ステータスが無効です' })
  status: AdminCaseStatus
}
