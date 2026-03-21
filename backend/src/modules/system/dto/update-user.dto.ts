import {
  IsString,
  IsOptional,
  IsEmail,
  IsArray,
  IsUUID,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import { UserStatus } from '../../../common/constants/enums'

export class UpdateUserDto {
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsEmail({}, { message: 'メールアドレスの形式が正しくありません' })
  @MaxLength(120)
  email?: string

  @ApiPropertyOptional({ maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'ロールIDの形式が無効です' })
  roleIds?: string[]
}

export class ResetPasswordDto {
  @ApiPropertyOptional({ minLength: 6, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'パスワードは6文字以上必要です' })
  @MaxLength(50)
  newPassword?: string
}
