import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 定义更新案件书类关联信息时允许修改的字段，保持文档标签与备注的格式约束一致。
 */
export class UpdateAdminCaseDocumentDto {
  @ApiPropertyOptional({ description: '書類タイプ' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentType?: string;

  @ApiPropertyOptional({ description: '備考' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
