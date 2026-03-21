import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  Matches,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  MonthlyStatus,
  MaterialStatus,
} from '../../../common/constants/enums'

export class CreateTaxPeriodDto {
  @ApiProperty({ example: '2026-04', description: '期間（YYYY-MM形式）' })
  @IsString()
  @IsNotEmpty({ message: '期間は必須です' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: '期間はYYYY-MM形式で入力してください',
  })
  periodYm: string

  @ApiPropertyOptional({ example: '2026-05-10' })
  @IsOptional()
  @IsDateString({}, { message: '申告期限の形式が無効です' })
  declarationDeadline?: string

  @ApiPropertyOptional({
    enum: MonthlyStatus,
    default: MonthlyStatus.NOT_STARTED,
  })
  @IsOptional()
  @IsEnum(MonthlyStatus, { message: '月次ステータスが無効です' })
  monthlyStatus?: MonthlyStatus

  @ApiPropertyOptional({
    enum: MaterialStatus,
    default: MaterialStatus.NOT_RECEIVED,
  })
  @IsOptional()
  @IsEnum(MaterialStatus, { message: '資料ステータスが無効です' })
  materialStatus?: MaterialStatus
}
