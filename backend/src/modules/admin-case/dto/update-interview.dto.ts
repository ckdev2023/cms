import { PartialType } from '@nestjs/swagger';

import { CreateInterviewDto } from './create-interview.dto';

/**
 * 定义更新面谈记录时允许按需覆盖的字段，沿用新增面谈 DTO 的校验规则并全部转为可选。
 */
export class UpdateInterviewDto extends PartialType(CreateInterviewDto) {}
