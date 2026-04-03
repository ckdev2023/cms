import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { PaymentMethod } from '../../../common/constants/enums';

/**
 * 定义为客户预り金账户执行充值入账时提交的入参契约。
 *
 * 该 DTO 约束充值金额、入金方式与备注，确保预收余额来源可追踪。
 */
export class CreateDepositRechargeDto {
  @ApiProperty({ description: '顧客ID', format: 'uuid' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'チャージ金額', minimum: 0.01 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: '入金方法', enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: '備考', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
