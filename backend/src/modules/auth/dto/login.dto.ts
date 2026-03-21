import { IsString, IsNotEmpty, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'ユーザー名' })
  @IsString()
  @IsNotEmpty({ message: 'ユーザー名を入力してください' })
  username: string

  @ApiProperty({ example: 'admin123', description: 'パスワード' })
  @IsString()
  @IsNotEmpty({ message: 'パスワードを入力してください' })
  @MinLength(6, { message: 'パスワードは6文字以上で入力してください' })
  password: string
}
