import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateInvoiceItemDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty({ message: '明細の説明は必須です' })
  @MaxLength(500)
  description: string

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt({ message: '数量は整数で入力してください' })
  @Min(1, { message: '数量は1以上で入力してください' })
  quantity?: number

  @ApiProperty({ minimum: 0, description: '単価' })
  @IsNumber({}, { message: '単価は数値で入力してください' })
  @Min(0, { message: '単価は0以上で入力してください' })
  unitPrice: number

  @ApiPropertyOptional({ default: 0, description: '表示順' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number
}
