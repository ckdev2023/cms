import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'
import { AdminCaseStatus } from '../../../common/constants/enums'

export class QueryAdminCaseDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AdminCaseStatus })
  @IsOptional()
  @IsEnum(AdminCaseStatus)
  status?: AdminCaseStatus

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  customerId?: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  ownerUserId?: string

  @ApiPropertyOptional({ example: '2026-01-01', description: '期限日の範囲開始' })
  @IsOptional()
  @IsDateString()
  expireDateFrom?: string

  @ApiPropertyOptional({ example: '2026-12-31', description: '期限日の範囲終了' })
  @IsOptional()
  @IsDateString()
  expireDateTo?: string
}
