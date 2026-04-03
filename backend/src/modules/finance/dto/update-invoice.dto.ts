import { OmitType, PartialType } from '@nestjs/swagger';

import { CreateInvoiceDto } from './create-invoice.dto';

/**
 * 定义更新既有请求书时提交的入参契约。
 *
 * 该 DTO 复用创建请求书的大部分字段，但禁止通过更新接口直接改写归属客户。
 */
export class UpdateInvoiceDto extends PartialType(
  OmitType(CreateInvoiceDto, ['customerId'] as const),
) {}
