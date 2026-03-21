import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'
import {
  MonthlyStatus,
  MaterialStatus,
} from '../../../common/constants/enums'

export class QueryTaxPeriodDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MonthlyStatus })
  @IsOptional()
  @IsEnum(MonthlyStatus)
  monthlyStatus?: MonthlyStatus

  @ApiPropertyOptional({ enum: MaterialStatus })
  @IsOptional()
  @IsEnum(MaterialStatus)
  materialStatus?: MaterialStatus

  @ApiPropertyOptional({ example: '2026-01', description: '期間の範囲開始' })
  @IsOptional()
  @IsString()
  periodYmFrom?: string

  @ApiPropertyOptional({ example: '2026-12', description: '期間の範囲終了' })
  @IsOptional()
  @IsString()
  periodYmTo?: string

  @ApiPropertyOptional({ description: '申告期限の範囲開始' })
  @IsOptional()
  @IsDateString()
  deadlineFrom?: string

  @ApiPropertyOptional({ description: '申告期限の範囲終了' })
  @IsOptional()
  @IsDateString()
  deadlineTo?: string
}
