import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * 定义为行政案件关联既有文件时的入参结构，约束文件标识、文档类型与备注信息。
 */
export class CreateAdminCaseDocumentDto {
  @ApiProperty({ description: 'ファイルID', format: 'uuid' })
  @IsUUID('4', { message: 'ファイルIDの形式が無効です' })
  fileId: string;

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
