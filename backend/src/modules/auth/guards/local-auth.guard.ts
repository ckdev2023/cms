import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  /**
   * 将本地用户名密码校验结果统一转换为登录失败异常。
   *
   * @param err - Passport Local 策略返回的底层异常
   * @param user - 用户名密码匹配成功后返回的用户对象
   * @returns 当前登录请求匹配到的用户对象
   * @throws {UnauthorizedException} 用户名不存在或密码校验失败时
   */
  handleRequest<TUser>(
    err: Error | null,
    user: TUser | null | undefined,
  ): TUser {
    if (err || !user) {
      throw (
        err ??
        new UnauthorizedException(
          'ユーザー名またはパスワードが正しくありません',
        )
      );
    }

    return user;
  }
}
