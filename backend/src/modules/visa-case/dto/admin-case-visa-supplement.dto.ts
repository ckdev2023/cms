import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

import { ADMIN_CASE_VISA_SUPPLEMENT_MAX_IDS } from '../admin-case-visa-supplement.constants';

/**
 * 行政案件 ID 列表请求体，供补录预览与提交端点校验入参边界。
 */
export class AdminCaseVisaSupplementRequestDto {
  @ApiProperty({
    type: [String],
    description:
      '行政案件 UUID 列表（服务端去重后按字典序稳定哈希；与 visa_cases.import_reference=admin:{id} 幂等）',
  })
  @IsArray()
  @ArrayMinSize(1, { message: '少なくとも1件の行政案件IDが必要です' })
  @ArrayMaxSize(ADMIN_CASE_VISA_SUPPLEMENT_MAX_IDS)
  @IsUUID('4', { each: true, message: '行政案件IDの形式が無効です' })
  adminCaseIds: string[];
}
