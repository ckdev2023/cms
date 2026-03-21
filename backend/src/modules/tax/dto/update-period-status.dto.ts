import { IsEnum } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { MonthlyStatus } from '../../../common/constants/enums'

export class UpdatePeriodStatusDto {
  @ApiProperty({ enum: MonthlyStatus })
  @IsEnum(MonthlyStatus, { message: '月次ステータスが無効です' })
  monthlyStatus: MonthlyStatus
}
