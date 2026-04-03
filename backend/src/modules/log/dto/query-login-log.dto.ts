import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

import { LoginType, OperationResult } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义登录日志列表查询支持的筛选入参，覆盖登录人、登录动作、结果与发生时间范围。
 */
export class QueryLoginLogDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'ユーザーID' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({ description: 'ユーザー名' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({
    enum: LoginType,
    description: 'ログインタイプ',
  })
  @IsOptional()
  @IsEnum(LoginType)
  loginType?: LoginType;

  @ApiPropertyOptional({
    enum: OperationResult,
    description: '操作結果',
  })
  @IsOptional()
  @IsEnum(OperationResult)
  result?: OperationResult;

  @ApiPropertyOptional({
    example: '2026-01-01T00:00:00.000Z',
    description: '開始日時 (ISO8601)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.999Z',
    description: '終了日時 (ISO8601)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
