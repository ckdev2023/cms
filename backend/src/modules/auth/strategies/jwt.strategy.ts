import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type {
  JwtAuthenticatedUser,
  JwtPayload,
} from '../interfaces/jwt-payload.interface';

/**
 * 优先从 Bearer Token 读取 JWT，并兼容查询参数中的 token 回退。
 *
 * @param req - 当前进入 Passport 鉴权流程的请求对象
 * @returns 可用于 JWT 校验的令牌字符串；未携带令牌时返回 null
 */
function extractJwtFromRequest(req: Request): string | null {
  const tokenFromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);

  if (tokenFromHeader) {
    return tokenFromHeader;
  }

  if (req.query?.token && typeof req.query.token === 'string') {
    return req.query.token;
  }

  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const jwtSecret = configService.get<string>('JWT_SECRET', 'default-secret');

    super({
      jwtFromRequest: extractJwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * 将 JWT 载荷转换为挂载到请求对象上的认证用户概要。
   *
   * @param payload - 已通过签名和过期时间校验的 JWT 载荷
   * @returns 供后续守卫和控制器读取的当前用户标识信息
   */
  validate(payload: JwtPayload): JwtAuthenticatedUser {
    return { id: payload.sub, username: payload.username };
  }
}
