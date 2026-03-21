import { IsOptional, IsEnum } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { PaginationDto } from '../../../common/dto/pagination.dto'
import { NoteType } from '../../../common/constants/enums'

export class QueryNoteDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NoteType })
  @IsOptional()
  @IsEnum(NoteType)
  noteType?: NoteType
}
