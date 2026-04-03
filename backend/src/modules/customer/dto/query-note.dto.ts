import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

import { NoteType } from '../../../common/constants/enums';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/**
 * 定义客户备注列表查询条件，统一承载备注类型筛选与分页参数。
 */
export class QueryNoteDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NoteType })
  @IsOptional()
  @IsEnum(NoteType)
  noteType?: NoteType;
}
