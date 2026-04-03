import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/**
 * 定义新增系统角色时允许提交的基础权限模型字段，统一约束角色标识、描述信息与权限集合。
 */
export class CreateRoleDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: 'ロール名は必須です' })
  @MaxLength(50)
  roleName: string;

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: 'ロールコードは必須です' })
  @MaxLength(50)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'ロールコードは英大文字・数字・アンダースコアのみ使用可能です',
  })
  roleCode: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: '権限IDの形式が無効です' })
  permissionIds?: string[];
}
