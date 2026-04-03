import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  /**
   * 根据路由的公开访问元数据决定是否跳过 JWT 鉴权。
   *
   * 标记为 `@Public()` 的处理器或控制器将直接放行，其余路由继续走 Passport JWT 校验链路。
   *
   * @param context - NestJS 执行上下文，用于读取控制器和处理器元数据
   * @returns 公开路由返回 true，其余场景返回 Passport 的鉴权结果
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * 将 Passport 的 JWT 校验结果统一转换为业务可识别的未认证异常。
   *
   * @param err - Passport 校验链路抛出的底层异常
   * @param user - JWT 解析成功后注入到请求中的用户对象
   * @returns 当前请求对应的已认证用户对象
   * @throws {UnauthorizedException} 未携带有效登录态或令牌解析失败时
   */
  handleRequest<TUser>(
    err: Error | null,
    user: TUser | null | undefined,
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('認証が必要です');
    }

    return user;
  }
}
