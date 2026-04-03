import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * 定义行政案件新增面谈记录时的业务入参，统一约束面谈日期、地点与纪要内容。
 */
export class CreateInterviewDto {
  @ApiProperty({ example: '2026-03-19' })
  @IsDateString({}, { message: '日付の形式が無効です' })
  interviewDate: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  interviewLocation?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: '面談内容は必須です' })
  content: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: '顧客ID（案件の顧客と異なる場合）',
  })
  @IsOptional()
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId?: string;
}
