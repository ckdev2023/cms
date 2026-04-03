import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';

import { AuthService } from '../auth.service';
import type { User } from '../entities/user.entity';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'username', passwordField: 'password' });
  }

  /**
   * 校验本地登录凭证并返回通过认证的用户实体。
   *
   * @param username - 用户输入的登录账号
   * @param password - 用户输入的明文密码
   * @returns 通过账号密码校验的用户实体
   * @throws {UnauthorizedException} 账号不存在或密码不匹配时抛出未授权异常
   */
  async validate(username: string, password: string): Promise<User> {
    const user = await this.authService.validateUser(username, password);

    if (!user) {
      throw new UnauthorizedException(
        'ユーザー名またはパスワードが正しくありません',
      );
    }

    return user;
  }
}
