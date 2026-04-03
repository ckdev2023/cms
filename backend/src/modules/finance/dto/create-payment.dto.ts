import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaymentMethod } from '../../../common/constants/enums';

/**
 * 定义单笔入金分配到请求书时使用的分录入参契约。
 *
 * 该 DTO 约束充当目标请求书与对应的充当金额，供收款分摊计算使用。
 */
export class CreatePaymentAllocationDto {
  @ApiProperty({ format: 'uuid', description: '請求書ID' })
  @IsUUID('4', { message: '請求書IDの形式が無効です' })
  invoiceId: string;

  @ApiProperty({ description: '充当金額', example: 5000 })
  @IsNumber({}, { message: '充当金額は数値で入力してください' })
  @Min(0.01, { message: '充当金額は0より大きい値にしてください' })
  allocatedAmount: number;
}

/**
 * 定义登记客户入金并分配到请求书时提交的入参契约。
 *
 * 该 DTO 约束客户、入金日期、入金方式、备注与至少一条充当分录。
 */
export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid', description: '顧客ID' })
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId: string;

  @ApiProperty({ example: '2026-03-20', description: '入金日' })
  @IsDateString({}, { message: '入金日の形式が無効です' })
  paymentDate: string;

  @ApiProperty({ description: '入金金額', example: 10000 })
  @IsNumber({}, { message: '入金金額は数値で入力してください' })
  @Min(0.01, { message: '入金金額は0より大きい値にしてください' })
  paymentAmount: number;

  @ApiProperty({ enum: PaymentMethod, description: '入金方法' })
  @IsEnum(PaymentMethod, { message: '入金方法が無効です' })
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ maxLength: 500, description: '備考' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiProperty({
    type: [CreatePaymentAllocationDto],
    description: '入金充当明細一覧',
  })
  @IsArray()
  @ArrayMinSize(1, { message: '充当先は1件以上必要です' })
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentAllocationDto)
  allocations: CreatePaymentAllocationDto[];
}
