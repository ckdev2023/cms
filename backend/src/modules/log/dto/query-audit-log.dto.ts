import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'

export class QueryAuditLogDto extends PaginationDto {
  @ApiPropertyOptional({ description: '操作ユーザーID' })
  @IsOptional()
  @IsUUID()
  userId?: string

  @ApiPropertyOptional({ description: '操作タイプ (CREATE, UPDATE, DELETE, ...)' })
  @IsOptional()
  @IsString()
  actionType?: string

  @ApiPropertyOptional({ description: '対象タイプ (CUSTOMER, ADMIN_CASE, ...)' })
  @IsOptional()
  @IsString()
  targetType?: string

  @ApiPropertyOptional({ description: '対象エンティティID' })
  @IsOptional()
  @IsUUID()
  targetId?: string

  @ApiPropertyOptional({ description: '開始日時 (ISO8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiPropertyOptional({ description: '終了日時 (ISO8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string

  @ApiPropertyOptional({ description: '操作結果 (SUCCESS, FAILURE)' })
  @IsOptional()
  @IsString()
  result?: string
}
