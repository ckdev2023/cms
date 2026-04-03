import { PartialType } from '@nestjs/swagger';

import { CreateNoteDto } from './create-note.dto';

/**
 * 定义客户备注更新请求，复用新增备注字段并支持局部修改。
 */
export class UpdateNoteDto extends PartialType(CreateNoteDto) {}
