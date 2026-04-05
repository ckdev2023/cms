import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { NoteType } from '../../../common/constants/enums';

/**
 * 将空串规范为 undefined，避免误入日期格式校验；其余值原样传递。
 *
 * @param value - 请求体中的原始字段值
 * @returns 空串时为 undefined，否则为原值
 */
function noteNextFollowUpTransform(value: unknown): unknown {
  return value === '' ? undefined : value;
}

/**
 * 定义客户备注新增请求，统一约束备注内容、备注分类与可选结构化跟进字段。
 *
 * 结构化字段与签证案件日志（`CreateVisaCaseLogDto`）对齐，便于客户级轻量备忘；
 * 正式案件跟进仍应写入挂载具体案件的日志，避免与客户备注双写混淆。
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

  @ApiPropertyOptional({
    maxLength: 2000,
    description: '提出済み資料リスト（任意）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  submittedItems?: string;

  @ApiPropertyOptional({
    maxLength: 2000,
    description: '不足資料リスト（任意）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  missingItems?: string;

  @ApiPropertyOptional({
    maxLength: 1000,
    description: '次のアクション（任意）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  nextAction?: string;

  @ApiPropertyOptional({
    example: '2026-04-10T09:00:00.000Z',
    description: '次回フォロー日時（任意）',
  })
  @IsOptional()
  @Transform(({ value }) => noteNextFollowUpTransform(value))
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @IsDateString({}, { message: '日付の形式が無効です' })
  nextFollowUpAt?: string | null;
}
