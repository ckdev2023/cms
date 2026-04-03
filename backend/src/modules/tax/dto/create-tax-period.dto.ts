import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

import { MaterialStatus, MonthlyStatus } from '../../../common/constants/enums';

/**
 * 定义新增税务月度期间时允许提交的字段，统一校验年月格式、申告期限与资料状态。
 */
export class CreateTaxPeriodDto {
  @ApiProperty({ example: '2026-04', description: '期間（YYYY-MM形式）' })
  @IsString()
  @IsNotEmpty({ message: '期間は必須です' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: '期間はYYYY-MM形式で入力してください',
  })
  periodYm: string;

  @ApiPropertyOptional({ example: '2026-05-10' })
  @IsOptional()
  @IsDateString({}, { message: '申告期限の形式が無効です' })
  declarationDeadline?: string;

  @ApiPropertyOptional({
    enum: MonthlyStatus,
    default: MonthlyStatus.NOT_STARTED,
  })
  @IsOptional()
  @IsEnum(MonthlyStatus, { message: '月次ステータスが無効です' })
  monthlyStatus?: MonthlyStatus;

  @ApiPropertyOptional({
    enum: MaterialStatus,
    default: MaterialStatus.NOT_RECEIVED,
  })
  @IsOptional()
  @IsEnum(MaterialStatus, { message: '資料ステータスが無効です' })
  materialStatus?: MaterialStatus;
}
