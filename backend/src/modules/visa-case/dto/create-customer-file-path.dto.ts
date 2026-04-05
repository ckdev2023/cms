import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { FilePathType } from '../../../common/constants/enums';

/**
 * 定义新增客户/案件维度资料路径的入参结构，约束路径类型、服务器路径与展示名称。
 *
 * `customerId` 由路由参数或上下文提供时可省略；`visaCaseId` 可选，为空时归属客户级路径。
 */
export class CreateCustomerFilePathDto {
  @ApiProperty({ format: 'uuid', description: '归属客户ID' })
  @IsUUID('4', { message: '顧客IDの形式が無効です' })
  customerId: string;

  @ApiPropertyOptional({ format: 'uuid', description: '关联签证案件ID' })
  @IsOptional()
  @IsUUID('4', { message: '案件IDの形式が無効です' })
  visaCaseId?: string;

  @ApiPropertyOptional({
    enum: FilePathType,
    default: FilePathType.OTHER,
    description: '路径分类',
  })
  @IsOptional()
  @IsEnum(FilePathType, { message: 'パスタイプが無効です' })
  pathType?: FilePathType;

  @ApiProperty({ description: '服务器上的文件路径' })
  @IsString()
  @IsNotEmpty({ message: 'ファイルパスを入力してください' })
  filePath: string;

  @ApiPropertyOptional({ maxLength: 200, description: '人类可读的展示名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @ApiPropertyOptional({ maxLength: 2000, description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remark?: string;
}
