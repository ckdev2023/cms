import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * 定义认证模块接收登录凭证时使用的请求体结构。
 *
 * 该 DTO 用于约束用户名和密码字段的必填与最小长度规则，需与登录接口文档和前端表单保持一致。
 */
export class LoginDto {
  @ApiProperty({
    example: 'admin',
    description: '用于身份认证的登录用户名',
  })
  @IsString()
  @IsNotEmpty({ message: 'ユーザー名を入力してください' })
  username: string;

  @ApiProperty({
    example: 'admin123',
    description: '用于身份认证的登录密码，至少 6 位',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'パスワードを入力してください' })
  @MinLength(6, { message: 'パスワードは6文字以上で入力してください' })
  password: string;
}
