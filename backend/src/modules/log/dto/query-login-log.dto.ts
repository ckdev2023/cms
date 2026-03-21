import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'

export class QueryLoginLogDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'ユーザーID' })
  @IsOptional()
  @IsUUID()
  userId?: string

  @ApiPropertyOptional({ description: 'ユーザー名' })
  @IsOptional()
  @IsString()
  username?: string

  @ApiPropertyOptional({ description: 'ログインタイプ (LOGIN, LOGOUT)' })
  @IsOptional()
  @IsString()
  loginType?: string

  @ApiPropertyOptional({ description: '操作結果 (SUCCESS, FAILURE)' })
  @IsOptional()
  @IsString()
  result?: string

  @ApiPropertyOptional({ description: '開始日時 (ISO8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string

  @ApiPropertyOptional({ description: '終了日時 (ISO8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string
}
