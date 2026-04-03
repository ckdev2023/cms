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
 * 定义将客户预り金余额充当到指定请求书时提交的入参契约。
 *
 * 该 DTO 约束充当目标、充当金额与附加备注，避免账务抵扣缺少来源说明。
 */
export class CreateDepositOffsetDto {
  @ApiProperty({ description: '顧客ID', format: 'uuid' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: '充当先請求書ID', format: 'uuid' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ description: '充当金額', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: '備考', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
