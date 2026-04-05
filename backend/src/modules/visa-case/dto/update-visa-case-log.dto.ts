import { PartialType } from '@nestjs/swagger';

import { CreateVisaCaseLogDto } from './create-visa-case-log.dto';

/**
 * 定义签证案件日志编辑请求，复用新增日志字段并支持局部修改。
 */
export class UpdateVisaCaseLogDto extends PartialType(CreateVisaCaseLogDto) {}
