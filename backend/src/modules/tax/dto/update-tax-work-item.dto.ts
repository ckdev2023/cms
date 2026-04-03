import { PartialType } from '@nestjs/swagger';

import { CreateTaxWorkItemDto } from './create-tax-work-item.dto';

/**
 * 定义编辑税务作业项时允许局部更新的字段，复用新增作业项的字段校验约束。
 */
export class UpdateTaxWorkItemDto extends PartialType(CreateTaxWorkItemDto) {}
