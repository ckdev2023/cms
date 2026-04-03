import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * 定义手工调整客户预り金余额时提交的入参契约。
 *
 * 该 DTO 用于记录正向补录或负向扣减的调整金额、调整原因与备注信息。
 */
export class CreateDepositAdjustmentDto {
  @ApiProperty({ description: '顧客ID', format: 'uuid' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: '調整金額（正: 加算、負: 減算）' })
  @IsNumber()
  amount: number;

  @ApiProperty({ description: '調整理由' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: '備考', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
