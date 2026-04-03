import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { NoteType } from '../../../common/constants/enums';

/**
 * 定义客户备注新增请求，统一约束备注内容与备注分类字段。
 */
export class CreateNoteDto {
  @ApiProperty({ maxLength: 5000, description: 'メモ内容' })
  @IsString()
  @IsNotEmpty({ message: '内容を入力してください' })
  @MaxLength(5000)
  content: string;

  @ApiPropertyOptional({ enum: NoteType, default: NoteType.GENERAL })
  @IsOptional()
  @IsEnum(NoteType, { message: 'メモタイプが無効です' })
  noteType?: NoteType;
}
