import { PartialType } from '@nestjs/swagger';

import { CreateTaxDocumentDto } from './create-tax-document.dto';

/**
 * 定义编辑税务资料清单项时允许局部更新的字段，沿用资料新增场景的校验规则。
 */
export class UpdateTaxDocumentDto extends PartialType(CreateTaxDocumentDto) {}
