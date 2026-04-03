import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * 定义新增系统用户时允许提交的基础账号字段，统一约束登录信息、显示资料与角色绑定集合。
 */
export class CreateUserDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: 'ユーザー名は必須です' })
  @MaxLength(50)
  username: string;

  @ApiProperty({ minLength: 6, maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: 'パスワードは必須です' })
  @MinLength(6, { message: 'パスワードは6文字以上必要です' })
  @MaxLength(50)
  password: string;

  @ApiProperty({ maxLength: 100 })
  @IsString()
  @IsNotEmpty({ message: '表示名は必須です' })
  @MaxLength(100)
  displayName: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsEmail({}, { message: 'メールアドレスの形式が正しくありません' })
  @MaxLength(120)
  email?: string;

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'ロールIDの形式が無効です' })
  roleIds?: string[];
}
