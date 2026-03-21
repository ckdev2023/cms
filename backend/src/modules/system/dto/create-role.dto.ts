import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateRoleDto {
  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: 'ロール名は必須です' })
  @MaxLength(50)
  roleName: string

  @ApiProperty({ maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: 'ロールコードは必須です' })
  @MaxLength(50)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'ロールコードは英大文字・数字・アンダースコアのみ使用可能です',
  })
  roleCode: string

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: '権限IDの形式が無効です' })
  permissionIds?: string[]
}
