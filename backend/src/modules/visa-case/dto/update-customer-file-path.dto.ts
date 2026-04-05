import { PartialType } from '@nestjs/swagger';

import { CreateCustomerFilePathDto } from './create-customer-file-path.dto';

/**
 * 定义资料路径编辑请求，复用新增路径字段并支持局部修改。
 *
 * `customerId` 在创建后不可变更，由控制器层忽略。
 */
export class UpdateCustomerFilePathDto extends PartialType(
  CreateCustomerFilePathDto,
) {}
