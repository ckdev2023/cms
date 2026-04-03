import { PartialType } from '@nestjs/swagger';

import { CreateCustomerDto } from './create-customer.dto';

/**
 * 定义客户更新请求，复用新增客户字段并允许按需提交局部变更。
 */
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
