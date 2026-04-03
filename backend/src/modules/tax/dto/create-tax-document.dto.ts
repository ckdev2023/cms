import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * 定义新增税务资料清单项时允许提交的字段，统一约束资料名称、关联文件与备注长度。
 */
export class CreateTaxDocumentDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty({ message: '資料名は必須です' })
  @MaxLength(200)
  documentName: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'ファイルIDの形式が無効です' })
  fileId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  received?: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
