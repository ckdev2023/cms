import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

/**
 * 定义批量生成年月期间的输入参数，统一约束起止月份范围与默认申告期限日。
 */
export class GeneratePeriodsDto {
  @ApiProperty({ example: '2026-04', description: '開始期間（YYYY-MM）' })
  @IsString()
  @IsNotEmpty({ message: '開始期間は必須です' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: '開始期間はYYYY-MM形式で入力してください',
  })
  startYm: string;

  @ApiProperty({ example: '2027-03', description: '終了期間（YYYY-MM）' })
  @IsString()
  @IsNotEmpty({ message: '終了期間は必須です' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: '終了期間はYYYY-MM形式で入力してください',
  })
  endYm: string;

  @ApiPropertyOptional({
    example: 10,
    description: '申告期限の日（翌月の指定日）',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  deadlineDay?: number;
}
