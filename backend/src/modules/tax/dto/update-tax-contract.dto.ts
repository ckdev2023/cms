import { PartialType } from '@nestjs/swagger';

import { CreateTaxContractDto } from './create-tax-contract.dto';

/**
 * 定义编辑税务顾问契约时允许局部更新的字段，复用新增契约的校验规则并放宽必填限制。
 */
export class UpdateTaxContractDto extends PartialType(CreateTaxContractDto) {}
