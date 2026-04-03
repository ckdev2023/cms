import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * 定义当前登录用户提交密码变更请求时使用的入参结构。
 *
 * 该 DTO 仅承载旧密码校验和新密码强度校验所需字段，需与认证模块的修改密码接口保持一致。
 */
export class ChangePasswordDto {
  @ApiProperty({
    description: '用于校验身份的当前密码',
    example: 'currentPass123',
  })
  @IsString()
  @IsNotEmpty({ message: '現在のパスワードを入力してください' })
  oldPassword: string;

  @ApiProperty({
    description: '用于更新账户凭证的新密码，至少 6 位',
    example: 'newPass123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: '新しいパスワードを入力してください' })
  @MinLength(6, { message: '新しいパスワードは6文字以上で入力してください' })
  newPassword: string;
}
