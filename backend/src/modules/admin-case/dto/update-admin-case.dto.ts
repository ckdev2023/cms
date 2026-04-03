import { PartialType } from '@nestjs/swagger';

import { CreateAdminCaseDto } from './create-admin-case.dto';

/**
 * 定义更新行政案件时允许按需覆盖的字段，沿用新增案件 DTO 的校验约束并全部转为可选。
 */
export class UpdateAdminCaseDto extends PartialType(CreateAdminCaseDto) {}
