import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { InvoiceStatus } from '../../../common/constants/enums';

/**
 * 定义单独变更请求书状态时提交的入参契约。
 *
 * 该 DTO 用于限制状态流转接口只能接收受控的请求状态枚举值。
 */
export class UpdateInvoiceStatusDto {
  @ApiProperty({ enum: InvoiceStatus, description: '請求状態' })
  @IsEnum(InvoiceStatus, { message: 'ステータスが無効です' })
  status: InvoiceStatus;
}
