import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * 定义新增请求书时单条明细行的入参契约。
 *
 * 该 DTO 约束服务说明、数量、单价与排序号，供开票明细汇总金额使用。
 */
export class CreateInvoiceItemDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @IsNotEmpty({ message: '明細の説明は必須です' })
  @MaxLength(500)
  description: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt({ message: '数量は整数で入力してください' })
  @Min(1, { message: '数量は1以上で入力してください' })
  quantity?: number;

  @ApiProperty({ minimum: 0, description: '単価' })
  @IsNumber({}, { message: '単価は数値で入力してください' })
  @Min(0, { message: '単価は0以上で入力してください' })
  unitPrice: number;

  @ApiPropertyOptional({ default: 0, description: '表示順' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
