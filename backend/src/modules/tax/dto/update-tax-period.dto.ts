import { PartialType } from '@nestjs/swagger';

import { CreateTaxPeriodDto } from './create-tax-period.dto';

/**
 * 定义编辑税务月度期间时允许局部更新的字段，复用新增期间的业务校验约束。
 */
export class UpdateTaxPeriodDto extends PartialType(CreateTaxPeriodDto) {}
