import { IsString, IsNotEmpty, IsEnum, IsOptional, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { NoteType } from '../../../common/constants/enums'

export class CreateNoteDto {
  @ApiProperty({ maxLength: 5000, description: 'メモ内容' })
  @IsString()
  @IsNotEmpty({ message: '内容を入力してください' })
  @MaxLength(5000)
  content: string

  @ApiPropertyOptional({ enum: NoteType, default: NoteType.GENERAL })
  @IsOptional()
  @IsEnum(NoteType, { message: 'メモタイプが無効です' })
  noteType?: NoteType
}
