import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateInterviewDto {
  @ApiProperty({ example: '2026-03-19' })
  @IsDateString({}, { message: '日付の形式が無効です' })
  interviewDate: string

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  interviewLocation?: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: '面談内容は必須です' })
  content: string

  @ApiPropertyOptional({ format: 'uuid', description: '顧客ID（案件の顧客と異なる場合）' })
  @IsOptional()
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId?: string
}
