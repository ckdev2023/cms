import { PartialType } from '@nestjs/swagger';

import { CreateVisaCaseDto } from './create-visa-case.dto';

/**
 * 定义签证案件编辑请求，复用新增案件全量字段并支持局部修改。
 *
 * `customerId` 在创建后不可变更，由控制器层忽略。
 */
export class UpdateVisaCaseDto extends PartialType(CreateVisaCaseDto) {}
