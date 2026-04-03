import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import { UserStatus } from '../../../common/constants/enums';

/**
 * 定义编辑系统用户时允许局部更新的资料字段，统一约束展示信息、状态与角色绑定集合。
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

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

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'ロールIDの形式が無効です' })
  roleIds?: string[];
}

/**
 * 定义后台重置用户密码时允许提交的新密码字段，沿用账号安全长度约束避免弱密码写入。
 */
export class ResetPasswordDto {
  @ApiPropertyOptional({ minLength: 6, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'パスワードは6文字以上必要です' })
  @MaxLength(50)
  newPassword?: string;
}
