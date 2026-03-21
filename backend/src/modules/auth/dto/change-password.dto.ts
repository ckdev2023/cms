import { IsString, IsNotEmpty, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class ChangePasswordDto {
  @ApiProperty({ description: '現在のパスワード' })
  @IsString()
  @IsNotEmpty({ message: '現在のパスワードを入力してください' })
  oldPassword: string

  @ApiProperty({ description: '新しいパスワード（6文字以上）' })
  @IsString()
  @IsNotEmpty({ message: '新しいパスワードを入力してください' })
  @MinLength(6, { message: '新しいパスワードは6文字以上で入力してください' })
  newPassword: string
}
