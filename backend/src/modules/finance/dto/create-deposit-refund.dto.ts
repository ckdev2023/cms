import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * 定义从客户预り金余额发起退款时提交的入参契约。
 *
 * 该 DTO 约束退款金额、退款原因与备注，避免退款流水缺少业务说明。
 */
export class CreateDepositRefundDto {
  @ApiProperty({ description: '顧客ID', format: 'uuid' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: '返金金額', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: '返金理由' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: '備考', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
