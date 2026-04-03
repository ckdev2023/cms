import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

import {
  AuditActionType,
  AuditTargetType,
  OperationResult,
} from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义审计日志列表查询支持的筛选入参，统一约束操作人、动作类型、目标对象与时间范围。
 */
export class QueryAuditLogDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid', description: '操作ユーザーID' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({
    enum: AuditActionType,
    description: '操作タイプ',
  })
  @IsOptional()
  @IsEnum(AuditActionType)
  actionType?: AuditActionType;

  @ApiPropertyOptional({
    enum: AuditTargetType,
    description: '対象タイプ',
  })
  @IsOptional()
  @IsEnum(AuditTargetType)
  targetType?: AuditTargetType;

  @ApiPropertyOptional({ format: 'uuid', description: '対象エンティティID' })
  @IsOptional()
  @IsUUID('4')
  targetId?: string;

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

  @ApiPropertyOptional({
    enum: OperationResult,
    description: '操作結果',
  })
  @IsOptional()
  @IsEnum(OperationResult)
  result?: OperationResult;
}
